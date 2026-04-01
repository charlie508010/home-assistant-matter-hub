import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import {
  RvcRunModeServer as Base,
  ServiceAreaBehavior,
} from "@matter/main/behaviors";
import { ServiceArea } from "@matter/main/clusters";
import { ModeBase } from "@matter/main/clusters/mode-base";
import { RvcRunMode } from "@matter/main/clusters/rvc-run-mode";
import { EntityStateProvider } from "../../services/bridges/entity-state-provider.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

const logger = Logger.get("RvcRunModeServer");

export enum RvcSupportedRunMode {
  Idle = 0,
  Cleaning = 1,
}

export interface RvcRunModeServerConfig {
  getCurrentMode: ValueGetter<RvcSupportedRunMode>;
  getSupportedModes: ValueGetter<RvcRunMode.ModeOption[]>;

  start: ValueSetter<void>;
  returnToBase: ValueSetter<void>;
  pause: ValueSetter<void>;
  /** Optional: Clean a specific room by mode value */
  cleanRoom?: ValueSetter<number>;
}

export interface RvcRunModeServerInitialState {
  supportedModes: RvcRunMode.ModeOption[];
  currentMode: number;
}

/** Base mode value for room-specific cleaning modes */
export const ROOM_MODE_BASE = 100;

/** Check if a mode value represents a room-specific cleaning mode */
export function isRoomMode(mode: number): boolean {
  return mode >= ROOM_MODE_BASE;
}

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class RvcRunModeServerBase extends Base {
  declare state: RvcRunModeServerBase.State;

  /** Areas that the vacuum has already finished cleaning in this session */
  private completedAreas = new Set<number>();
  /** Last known currentArea — used to detect room transitions */
  private lastCurrentArea: number | null = null;

  override async initialize() {
    // supportedModes and currentMode are set via .set() BEFORE initialize is called
    // This ensures Matter.js has the modes at pairing time
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const previousMode = this.state.currentMode;
    const newMode = this.state.config.getCurrentMode(entity.state, this.agent);

    applyPatchState(this.state, {
      currentMode: newMode,
      supportedModes: this.state.config.getSupportedModes(
        entity.state,
        this.agent,
      ),
    });

    if (previousMode !== newMode) {
      if (newMode === RvcSupportedRunMode.Idle) {
        // Reset currentArea when vacuum transitions to Idle (cleaning finished)
        this.completedAreas.clear();
        this.lastCurrentArea = null;
        this.trySetCurrentArea(null);
      } else if (newMode === RvcSupportedRunMode.Cleaning) {
        // Restore currentArea when HA reports cleaning (e.g. after a brief
        // docked state between command dispatch and vacuum actually starting)
        try {
          const serviceArea = this.agent.get(ServiceAreaBehavior);
          if (
            serviceArea.state.selectedAreas?.length > 0 &&
            serviceArea.state.currentArea === null
          ) {
            this.trySetCurrentArea(serviceArea.state.selectedAreas[0]);
          }
        } catch {
          // ServiceArea not available
        }
      }
    }

    // Dynamic room tracking: when cleaning and a currentRoomEntity is
    // configured, read the sensor to update currentArea in real time.
    if (newMode === RvcSupportedRunMode.Cleaning) {
      this.updateCurrentRoomFromSensor();
    }
  }

  /**
   * Read the currentRoomEntity sensor and update currentArea + progress
   * to reflect which room the vacuum is actually in right now.
   */
  private updateCurrentRoomFromSensor() {
    try {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const currentRoomEntityId =
        homeAssistant.state.mapping?.currentRoomEntity;
      if (!currentRoomEntityId) return;

      const stateProvider = this.agent.env.get(EntityStateProvider);
      const roomState = stateProvider.getState(currentRoomEntityId);
      if (!roomState || !roomState.state) return;

      const serviceArea = this.agent.get(ServiceAreaBehavior);
      const selectedAreas = serviceArea.state.selectedAreas;
      if (!selectedAreas || selectedAreas.length === 0) return;

      // Match by segment_id attribute (numeric, preferred) or by room name
      const segmentId = (roomState.attributes as { segment_id?: number })
        ?.segment_id;
      const roomName = roomState.state;

      let matchedAreaId: number | null = null;
      if (segmentId != null) {
        // segment_id maps directly to areaId for numeric room IDs
        if (selectedAreas.includes(segmentId)) {
          matchedAreaId = segmentId;
        }
      }
      if (matchedAreaId === null && roomName) {
        // Fallback: match by location name in supportedAreas
        const area = serviceArea.state.supportedAreas.find(
          (a) =>
            a.areaInfo.locationInfo?.locationName?.toLowerCase() ===
            roomName.toLowerCase(),
        );
        if (area && selectedAreas.includes(area.areaId)) {
          matchedAreaId = area.areaId;
        }
      }

      if (matchedAreaId === null) return;
      if (matchedAreaId === this.lastCurrentArea) return;

      // Room transition detected — mark previous area as completed
      if (this.lastCurrentArea !== null) {
        this.completedAreas.add(this.lastCurrentArea);
      }
      this.lastCurrentArea = matchedAreaId;

      logger.debug(
        `currentRoom sensor: area ${matchedAreaId} ("${roomName}"), ` +
          `completed: [${[...this.completedAreas].join(", ")}]`,
      );

      this.trySetCurrentArea(matchedAreaId);
    } catch {
      // EntityStateProvider or ServiceArea not available
    }
  }

  /**
   * Safely update ServiceArea.currentArea and progress.
   * When areaId is set, marks it as Operating in progress.
   * When areaId is null (Idle), marks all Operating/Pending as Completed.
   * No-op if ServiceArea is not available on this endpoint.
   */
  private trySetCurrentArea(areaId: number | null) {
    try {
      const serviceArea = this.agent.get(ServiceAreaBehavior);
      if (serviceArea.state.currentArea !== areaId) {
        serviceArea.state.currentArea = areaId;
        logger.debug(`currentArea set to ${areaId}`);
      }
      this.updateProgress(serviceArea, areaId);
    } catch {
      // ServiceArea not available on this endpoint
    }
  }

  /**
   * Update progress entries to reflect the current operating area.
   * - null: mark all areas as Completed (cleaning done)
   * - areaId: mark that area as Operating, others as Pending
   *
   * Rebuilds progress from selectedAreas (plain number array) instead of
   * reading managed state progress entries, which avoids infinite recursion
   * in matter.js property getters during transaction pre-commit.
   */
  private updateProgress(
    serviceArea: InstanceType<typeof ServiceAreaBehavior>,
    areaId: number | null,
  ) {
    const state = serviceArea.state as typeof serviceArea.state & {
      progress?: ServiceArea.Progress[];
    };
    const selectedAreas = serviceArea.state.selectedAreas;
    if (!selectedAreas || selectedAreas.length === 0) return;

    if (areaId === null) {
      // Cleaning finished — mark all selected areas as Completed
      state.progress = selectedAreas.map((id: number) => ({
        areaId: id,
        status: ServiceArea.OperationalStatus.Completed,
      }));
    } else {
      // Mark current area as Operating, completed areas as Completed,
      // remaining areas as Pending.
      state.progress = selectedAreas.map((id: number) => ({
        areaId: id,
        status:
          id === areaId
            ? ServiceArea.OperationalStatus.Operating
            : this.completedAreas.has(id)
              ? ServiceArea.OperationalStatus.Completed
              : ServiceArea.OperationalStatus.Pending,
      }));
    }
  }

  /**
   * Find the ServiceArea area ID that corresponds to a run mode value
   * by matching the mode label to the area location name.
   */
  private findAreaIdForMode(mode: number): number | null {
    try {
      const serviceArea = this.agent.get(ServiceAreaBehavior);
      const modeEntry = this.state.supportedModes.find((m) => m.mode === mode);
      if (!modeEntry) return null;

      const area = serviceArea.state.supportedAreas.find(
        (a) => a.areaInfo.locationInfo?.locationName === modeEntry.label,
      );
      return area?.areaId ?? null;
    } catch {
      return null;
    }
  }

  override changeToMode(
    request: ModeBase.ChangeToModeRequest,
  ): ModeBase.ChangeToModeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const { newMode } = request;

    // Validate mode exists in supportedModes (matches matter.js base behavior)
    if (
      newMode !== this.state.currentMode &&
      !this.state.supportedModes.some((m) => m.mode === newMode)
    ) {
      return {
        status: ModeBase.ModeChangeStatus.UnsupportedMode,
        statusText: `Unsupported mode: ${newMode}`,
      };
    }

    // Check for room-specific cleaning mode
    if (isRoomMode(newMode)) {
      // When selectedAreas exist (e.g. Apple Home sends selectAreas before
      // changeToMode), prefer area-based cleaning over mode-based room selection.
      try {
        const serviceArea = this.agent.get(ServiceAreaBehavior);
        if (serviceArea.state.selectedAreas?.length > 0) {
          this.trySetCurrentArea(serviceArea.state.selectedAreas[0]);
          homeAssistant.callAction(this.state.config.start(void 0, this.agent));
          this.state.currentMode = newMode;
          return {
            status: ModeBase.ModeChangeStatus.Success,
            statusText: "Starting room cleaning",
          };
        }
      } catch {
        // ServiceArea not available, fall through to mode-based room cleaning
      }

      if (this.state.config.cleanRoom) {
        this.trySetCurrentArea(this.findAreaIdForMode(newMode));
        homeAssistant.callAction(
          this.state.config.cleanRoom(newMode, this.agent),
        );
        this.state.currentMode = newMode;
        return {
          status: ModeBase.ModeChangeStatus.Success,
          statusText: "Starting room cleaning",
        };
      }
    }

    switch (newMode) {
      case RvcSupportedRunMode.Cleaning: {
        // Set currentArea from selectedAreas if a controller pre-selected areas
        try {
          const serviceArea = this.agent.get(ServiceAreaBehavior);
          if (serviceArea.state.selectedAreas?.length > 0) {
            this.trySetCurrentArea(serviceArea.state.selectedAreas[0]);
          }
        } catch {
          // ServiceArea not available
        }
        homeAssistant.callAction(this.state.config.start(void 0, this.agent));
        break;
      }
      case RvcSupportedRunMode.Idle:
        this.trySetCurrentArea(null);
        homeAssistant.callAction(
          this.state.config.returnToBase(void 0, this.agent),
        );
        break;
      default:
        homeAssistant.callAction(this.state.config.pause(void 0, this.agent));
        break;
    }
    this.state.currentMode = newMode;
    return {
      status: ModeBase.ModeChangeStatus.Success,
      statusText: "Successfully switched mode",
    };
  }
}

namespace RvcRunModeServerBase {
  export class State extends Base.State {
    config!: RvcRunModeServerConfig;
  }
}

/**
 * Create an RvcRunMode behavior with initial state.
 * The initialState MUST include supportedModes - Matter.js requires this at pairing time.
 */
export function RvcRunModeServer(
  config: RvcRunModeServerConfig,
  initialState?: RvcRunModeServerInitialState,
) {
  const defaultModes: RvcRunMode.ModeOption[] = [
    {
      label: "Idle",
      mode: RvcSupportedRunMode.Idle,
      modeTags: [{ value: RvcRunMode.ModeTag.Idle }],
    },
    {
      label: "Cleaning",
      mode: RvcSupportedRunMode.Cleaning,
      modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }],
    },
  ];

  return RvcRunModeServerBase.set({
    config,
    supportedModes: initialState?.supportedModes ?? defaultModes,
    currentMode: initialState?.currentMode ?? RvcSupportedRunMode.Idle,
  });
}
