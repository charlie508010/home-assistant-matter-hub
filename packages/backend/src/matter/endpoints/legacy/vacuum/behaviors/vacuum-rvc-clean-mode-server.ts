import type { VacuumDeviceAttributes } from "@home-assistant-matter-hub/common";
import { Logger } from "@matter/general";
import type { Agent } from "@matter/main";
import { RvcCleanMode } from "@matter/main/clusters";
import { EntityStateProvider } from "../../../../../services/bridges/entity-state-provider.js";
import { HomeAssistantEntityBehavior } from "../../../../behaviors/home-assistant-entity-behavior.js";
import {
  RvcCleanModeServer,
  type RvcCleanModeServerInitialState,
} from "../../../../behaviors/rvc-clean-mode-server.js";
import {
  isDreameVacuum,
  isEcovacsVacuum,
} from "../utils/parse-vacuum-rooms.js";

const logger = Logger.get("VacuumRvcCleanModeServer");

// ---------------------------------------------------------------------------
// Mode IDs — flat structure matching the pattern Apple Home expects.
// Cleaning-type modes and fan-speed modes are siblings, NOT cross-products.
// Apple Home groups modes by their tags:
//   • Cleaning types (Vacuum / Mop / Vacuum+Mop / VacuumThenMop) appear
//     in the main mode selector.
//   • Fan-speed modes that share the Vacuum tag but add Quiet / Max
//     appear in the "extra features" panel.
// ---------------------------------------------------------------------------

const MODE_VACUUM = 0;
const MODE_VACUUM_AND_MOP = 1;
const MODE_MOP = 2;
const MODE_QUIET = 3;
const MODE_STANDARD = 4;
const MODE_STRONG = 5;
const MODE_VACUUM_THEN_MOP = 6;

enum CleanType {
  Sweeping = 0,
  Mopping = 1,
  SweepingAndMopping = 2,
  MoppingAfterSweeping = 3,
}

// ---------------------------------------------------------------------------
// Supported mode lists
// ---------------------------------------------------------------------------

function buildSupportedModes(hasFanSpeed: boolean): RvcCleanMode.ModeOption[] {
  const modes: RvcCleanMode.ModeOption[] = [
    {
      label: "Vacuum",
      mode: MODE_VACUUM,
      modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
    },
    {
      label: "Vacuum & Mop",
      mode: MODE_VACUUM_AND_MOP,
      modeTags: [
        { value: RvcCleanMode.ModeTag.Vacuum },
        { value: RvcCleanMode.ModeTag.Mop },
      ],
    },
    {
      label: "Mop",
      mode: MODE_MOP,
      modeTags: [{ value: RvcCleanMode.ModeTag.Mop }],
    },
  ];

  if (hasFanSpeed) {
    // Fan-speed modes share the Vacuum tag so Apple Home shows them
    // as "extra features" when the Vacuum cleaning type is active.
    modes.push(
      {
        label: "Quiet",
        mode: MODE_QUIET,
        modeTags: [
          { value: RvcCleanMode.ModeTag.Vacuum },
          { value: RvcCleanMode.ModeTag.Quiet },
        ],
      },
      {
        label: "Standard",
        mode: MODE_STANDARD,
        modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
      },
      {
        label: "Strong",
        mode: MODE_STRONG,
        modeTags: [
          { value: RvcCleanMode.ModeTag.Vacuum },
          { value: RvcCleanMode.ModeTag.Max },
        ],
      },
    );
  }

  // VacuumThenMop always last — uses DeepClean + Vacuum + Mop tags
  modes.push({
    label: "Vacuum Then Mop",
    mode: MODE_VACUUM_THEN_MOP,
    modeTags: [
      { value: RvcCleanMode.ModeTag.DeepClean },
      { value: RvcCleanMode.ModeTag.Vacuum },
      { value: RvcCleanMode.ModeTag.Mop },
    ],
  });

  return modes;
}

// ---------------------------------------------------------------------------
// Cleaning mode aliases (HA select entity option names → our CleanType)
// ---------------------------------------------------------------------------

const CLEANING_MODE_ALIASES: Record<CleanType, string[]> = {
  [CleanType.Sweeping]: [
    "Sweeping",
    "Vacuum",
    "Vacuuming",
    "Sweep",
    "vacuum",
    "sweeping",
  ],
  [CleanType.Mopping]: ["Mopping", "Mop", "mopping", "mop", "wet_mop"],
  [CleanType.SweepingAndMopping]: [
    "Sweeping and mopping",
    "Vacuum and mop",
    "Vacuum & Mop",
    "Vacuum & mop",
    "vacuum_and_mop",
    "sweeping_and_mopping",
  ],
  [CleanType.MoppingAfterSweeping]: [
    "Mopping after sweeping",
    "mopping_after_sweeping",
    "Vacuum then mop",
    "Mop after vacuum",
    "vacuum_then_mop",
    "mop_after_vacuum",
  ],
};

const CLEAN_TYPE_LABELS: Record<CleanType, string> = {
  [CleanType.Sweeping]: "Sweeping",
  [CleanType.Mopping]: "Mopping",
  [CleanType.SweepingAndMopping]: "Sweeping and mopping",
  [CleanType.MoppingAfterSweeping]: "Mopping after sweeping",
};

// ---------------------------------------------------------------------------
// Fan speed aliases
// ---------------------------------------------------------------------------

const FAN_QUIET_ALIASES = ["quiet", "silent", "low", "eco", "gentle"];
const FAN_MAX_ALIASES = [
  "turbo",
  "max",
  "strong",
  "boost",
  "power",
  "high",
  "full",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCleanType(modeString: string | undefined): CleanType {
  if (!modeString) return CleanType.Sweeping;
  const s = modeString.toLowerCase();
  if (s.includes("mopping after") || s.includes("after sweeping")) {
    return CleanType.MoppingAfterSweeping;
  }
  if (s.includes("and") || s.includes("sweeping and mopping")) {
    return CleanType.SweepingAndMopping;
  }
  if (s === "mopping" || s.includes("mop")) {
    return CleanType.Mopping;
  }
  return CleanType.Sweeping;
}

function cleanTypeToModeId(ct: CleanType): number {
  switch (ct) {
    case CleanType.Sweeping:
      return MODE_VACUUM;
    case CleanType.Mopping:
      return MODE_MOP;
    case CleanType.SweepingAndMopping:
      return MODE_VACUUM_AND_MOP;
    case CleanType.MoppingAfterSweeping:
      return MODE_VACUUM_THEN_MOP;
  }
}

function modeIdToCleanType(mode: number): CleanType {
  switch (mode) {
    case MODE_MOP:
      return CleanType.Mopping;
    case MODE_VACUUM_AND_MOP:
      return CleanType.SweepingAndMopping;
    case MODE_VACUUM_THEN_MOP:
      return CleanType.MoppingAfterSweeping;
    default:
      return CleanType.Sweeping;
  }
}

function fanSpeedToModeId(speed: string | undefined): number | undefined {
  if (!speed) return undefined;
  const s = speed.toLowerCase();
  for (const a of FAN_QUIET_ALIASES) {
    if (s === a || s.includes(a)) return MODE_QUIET;
  }
  for (const a of FAN_MAX_ALIASES) {
    if (s === a || s.includes(a)) return MODE_STRONG;
  }
  // Standard / Medium / Auto → MODE_STANDARD
  return MODE_STANDARD;
}

function findMatchingCleanOption(
  ct: CleanType,
  availableOptions: string[] | undefined,
): string {
  const aliases = CLEANING_MODE_ALIASES[ct];
  if (!availableOptions || availableOptions.length === 0) return aliases[0];

  for (const alias of aliases) {
    const match = availableOptions.find(
      (o) => o.toLowerCase() === alias.toLowerCase(),
    );
    if (match) return match;
  }
  for (const alias of aliases) {
    const match = availableOptions.find((o) =>
      o.toLowerCase().includes(alias.toLowerCase()),
    );
    if (match) return match;
  }
  logger.warn(
    `No match for ${CLEAN_TYPE_LABELS[ct]} in [${availableOptions.join(", ")}]`,
  );
  return aliases[0];
}

function findFanSpeedOption(
  mode: number,
  availableOptions: string[] | undefined,
): string | undefined {
  if (!availableOptions || availableOptions.length === 0) return undefined;
  const aliases = mode === MODE_QUIET ? FAN_QUIET_ALIASES : FAN_MAX_ALIASES;
  for (const a of aliases) {
    const m = availableOptions.find((o) => o.toLowerCase() === a.toLowerCase());
    if (m) return m;
  }
  for (const a of aliases) {
    const m = availableOptions.find((o) => o.toLowerCase().includes(a));
    if (m) return m;
  }
  if (mode === MODE_QUIET) return availableOptions[0];
  return availableOptions[availableOptions.length - 1];
}

/**
 * Derive the cleaning mode select entity ID from the vacuum entity ID.
 */
function deriveCleaningModeSelectEntity(vacuumEntityId: string): string {
  const vacuumName = vacuumEntityId.replace("vacuum.", "");
  return `select.${vacuumName}_cleaning_mode`;
}

function getCleaningModeSelectEntity(agent: Agent): string {
  const ha = agent.get(HomeAssistantEntityBehavior);
  const mapping = ha.state.mapping;
  if (mapping?.cleaningModeEntity) return mapping.cleaningModeEntity;
  return deriveCleaningModeSelectEntity(ha.entityId);
}

function readSelectEntity(
  entityId: string,
  agent: Agent,
): { state?: string; options?: string[] } {
  const stateProvider = agent.env.get(EntityStateProvider);
  const entityState = stateProvider.getState(entityId);
  if (!entityState) return {};
  const attrs = entityState.attributes as { options?: string[] } | undefined;
  return {
    state: entityState.state as string | undefined,
    options: attrs?.options,
  };
}

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

function createCleanModeConfig(hasFanSpeed: boolean) {
  return {
    getCurrentMode: (entity: { attributes: unknown }, agent: Agent): number => {
      const attributes = entity.attributes as VacuumDeviceAttributes & {
        cleaning_mode?: string;
      };

      // Determine cleaning type from select entity or vacuum attribute
      let cleanType: CleanType;
      if (attributes.cleaning_mode) {
        cleanType = parseCleanType(attributes.cleaning_mode);
      } else {
        const selectEntityId = getCleaningModeSelectEntity(agent);
        const { state } = readSelectEntity(selectEntityId, agent);
        cleanType = parseCleanType(state);
      }

      // Without fan speed, simply return the cleaning type mode
      if (!hasFanSpeed) return cleanTypeToModeId(cleanType);

      // With fan speed: if the cleaning type is vacuum (sweeping),
      // check the fan speed to pick the correct intensity mode.
      // Fan-speed modes only apply to Vacuum mode (matching Apple Home UX).
      if (cleanType === CleanType.Sweeping) {
        // Try suctionLevelEntity first, then vacuum fan_speed attribute
        const mapping = agent.get(HomeAssistantEntityBehavior).state.mapping;
        let speedState: string | undefined;

        if (mapping?.suctionLevelEntity) {
          const { state } = readSelectEntity(mapping.suctionLevelEntity, agent);
          speedState = state;
        } else {
          speedState =
            (attributes.fan_speed as string | undefined) ?? undefined;
        }

        const speedMode = fanSpeedToModeId(speedState);
        if (speedMode !== undefined) {
          logger.debug(
            `Current mode: Vacuum + fan_speed="${speedState}" -> mode ${speedMode}`,
          );
          return speedMode;
        }
      }

      return cleanTypeToModeId(cleanType);
    },

    getSupportedModes: () => buildSupportedModes(hasFanSpeed),

    setCleanMode: (mode: number, agent: Agent) => {
      const homeAssistant = agent.get(HomeAssistantEntityBehavior);
      const vacuumEntityId = homeAssistant.entityId;

      // Fan-speed modes: set suction/fan speed, not cleaning type
      if (
        hasFanSpeed &&
        (mode === MODE_QUIET || mode === MODE_STANDARD || mode === MODE_STRONG)
      ) {
        const mapping = homeAssistant.state.mapping;

        // Use suctionLevelEntity if configured
        if (mapping?.suctionLevelEntity) {
          const { options } = readSelectEntity(
            mapping.suctionLevelEntity,
            agent,
          );
          if (mode === MODE_STANDARD) {
            // Standard: pick the "standard"/"medium"/"auto" option
            const stdOption = options?.find((o) => {
              const l = o.toLowerCase();
              return (
                l === "standard" ||
                l === "medium" ||
                l === "auto" ||
                l === "normal"
              );
            });
            if (stdOption) {
              logger.info(
                `Setting suction to: ${stdOption} via ${mapping.suctionLevelEntity}`,
              );
              homeAssistant.callAction({
                action: "select.select_option",
                data: { option: stdOption },
                target: mapping.suctionLevelEntity,
              });
            }
          } else {
            const option = findFanSpeedOption(mode, options);
            if (option) {
              logger.info(
                `Setting suction to: ${option} via ${mapping.suctionLevelEntity}`,
              );
              homeAssistant.callAction({
                action: "select.select_option",
                data: { option },
                target: mapping.suctionLevelEntity,
              });
            }
          }
          return undefined;
        }

        // Otherwise use vacuum.set_fan_speed
        const fanSpeedList = (
          homeAssistant.entity.state?.attributes as VacuumDeviceAttributes
        )?.fan_speed_list;

        if (mode === MODE_STANDARD) {
          const stdOption = fanSpeedList?.find((o) => {
            const l = o.toLowerCase();
            return (
              l === "standard" ||
              l === "medium" ||
              l === "auto" ||
              l === "normal"
            );
          });
          if (stdOption) {
            logger.info(
              `Setting fan speed to: ${stdOption} via vacuum.set_fan_speed`,
            );
            return {
              action: "vacuum.set_fan_speed",
              data: { fan_speed: stdOption },
              target: vacuumEntityId,
            };
          }
        } else {
          const option = findFanSpeedOption(mode, fanSpeedList);
          if (option) {
            logger.info(
              `Setting fan speed to: ${option} via vacuum.set_fan_speed`,
            );
            return {
              action: "vacuum.set_fan_speed",
              data: { fan_speed: option },
              target: vacuumEntityId,
            };
          }
        }
        return undefined;
      }

      // Cleaning-type modes: set the cleaning mode select entity
      const cleanType = modeIdToCleanType(mode);
      const selectEntityId = getCleaningModeSelectEntity(agent);
      const { options: availableOptions } = readSelectEntity(
        selectEntityId,
        agent,
      );
      const optionToUse = findMatchingCleanOption(cleanType, availableOptions);

      logger.info(
        `Setting cleaning mode to: ${optionToUse} (mode=${mode}) via ${selectEntityId}`,
      );

      return {
        action: "select.select_option",
        data: { option: optionToUse },
        target: selectEntityId,
      };
    },
  };
}

/**
 * Create a VacuumRvcCleanModeServer with cleaning modes.
 * When hasFanSpeed is true, fan-speed modes (Quiet / Standard / Strong) are
 * added as flat sibling modes — this is the pattern Apple Home expects for
 * its "extra features" panel.
 */
export function createVacuumRvcCleanModeServer(
  _attributes: VacuumDeviceAttributes,
  hasFanSpeed = false,
): ReturnType<typeof RvcCleanModeServer> {
  const supportedModes = buildSupportedModes(hasFanSpeed);

  logger.info(
    `Creating VacuumRvcCleanModeServer with ${supportedModes.length} modes (fanSpeed=${hasFanSpeed})`,
  );
  logger.info(
    `Modes: ${supportedModes.map((m) => `${m.mode}:${m.label}[${m.modeTags.map((t) => t.value).join(",")}]`).join(", ")}`,
  );

  const initialState: RvcCleanModeServerInitialState = {
    supportedModes,
    currentMode: MODE_VACUUM,
  };

  return RvcCleanModeServer(createCleanModeConfig(hasFanSpeed), initialState);
}

/**
 * Create a default RvcCleanMode server with a single "Vacuum" mode.
 * Used for vacuums that don't support multiple cleaning modes
 * (e.g. Roborock via Xiaomi integration, iRobot Roomba, etc.).
 *
 * Alexa probes for RvcCleanMode (0x55) during device discovery.
 * Without it, Alexa may fail to complete CASE session establishment
 * and never subscribe, leaving the vacuum undiscoverable.
 */
export function createDefaultRvcCleanModeServer(): ReturnType<
  typeof RvcCleanModeServer
> {
  const defaultConfig = {
    getCurrentMode: () => 0,
    getSupportedModes: (): RvcCleanMode.ModeOption[] => [
      {
        label: "Vacuum",
        mode: 0,
        modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }],
      },
    ],
    setCleanMode: () => undefined,
  };

  return RvcCleanModeServer(defaultConfig);
}

/**
 * Check if vacuum supports cleaning modes.
 * Dreame and Ecovacs vacuums typically support vacuum/mop/both modes
 * via a separate select entity (e.g., select.vacuum_cleaning_mode).
 */
export function supportsCleaningModes(
  attributes: VacuumDeviceAttributes,
): boolean {
  return isDreameVacuum(attributes) || isEcovacsVacuum(attributes);
}

/**
 * Check if vacuum has fan speed options available.
 * Used to auto-detect fan speed support without requiring manual
 * suctionLevelEntity configuration.
 */
export function hasFanSpeedSupport(
  attributes: VacuumDeviceAttributes,
): boolean {
  return !!attributes.fan_speed_list && attributes.fan_speed_list.length > 1;
}
