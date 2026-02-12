import type { HomeAssistantEntityInformation } from "@home-assistant-matter-hub/common";
import { DoorLockServer as Base } from "@matter/main/behaviors";
import { DoorLock } from "@matter/main/clusters";
import { StatusCode, StatusResponseError } from "@matter/main/types";
import { LockCredentialStorage } from "../../services/storage/lock-credential-storage.js";
import { applyPatchState } from "../../utils/apply-patch-state.js";
import { HomeAssistantEntityBehavior } from "./home-assistant-entity-behavior.js";
import type { ValueGetter, ValueSetter } from "./utils/cluster-config.js";

import LockState = DoorLock.LockState;

export interface LockServerConfig {
  getLockState: ValueGetter<LockState>;
  lock: ValueSetter<void>;
  unlock: ValueSetter<void>;
  unlatch?: ValueSetter<void>;
}

// Shared PIN credential helpers (used by both PinCredential variants)
function hasStoredCredentialHelper(
  env: { get: (type: typeof LockCredentialStorage) => LockCredentialStorage },
  entityId: string,
): boolean {
  try {
    const storage = env.get(LockCredentialStorage);
    return storage.hasCredential(entityId);
  } catch {
    return false;
  }
}

function verifyStoredPinHelper(
  env: { get: (type: typeof LockCredentialStorage) => LockCredentialStorage },
  entityId: string,
  pin: string,
): boolean {
  try {
    const storage = env.get(LockCredentialStorage);
    return storage.verifyPin(entityId, pin);
  } catch {
    return false;
  }
}

/**
 * Base DoorLock server - used when no PIN is configured for the entity.
 * This provides basic lock/unlock functionality without PIN requirements.
 */
// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class LockServerBase extends Base {
  declare state: LockServerBase.State;

  override async initialize() {
    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    applyPatchState(this.state, {
      lockState: this.state.config.getLockState(entity.state, this.agent),
      lockType: DoorLock.LockType.DeadBolt,
      operatingMode: DoorLock.OperatingMode.Normal,
      actuatorEnabled: true,
      supportedOperatingModes: {
        noRemoteLockUnlock: false,
        normal: true,
        passage: false,
        privacy: false,
        vacation: false,
      },
    });
  }

  override lockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.lock(void 0, this.agent);
    homeAssistant.callAction(action);
  }

  override unlockDoor() {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.unlock(void 0, this.agent);
    homeAssistant.callAction(action);
  }
}

namespace LockServerBase {
  export class State extends Base.State {
    config!: LockServerConfig;
  }
}

/**
 * Extended DoorLock server with PinCredential feature.
 * This enables requirePinForRemoteOperation which tells Matter controllers
 * (like Google Home) that a PIN is required for remote unlock operations.
 *
 * Google Home will then prompt for PIN in the app before allowing unlock.
 * Note: Voice unlock is still disabled by Google for Matter locks (this is
 * a Google policy, not a Matter limitation).
 */
const PinCredentialBase = Base.with(
  "PinCredential",
  "CredentialOverTheAirAccess",
).set({
  // Required defaults for PinCredential feature
  wrongCodeEntryLimit: 3,
  userCodeTemporaryDisableTime: 10, // seconds
});

// biome-ignore lint/correctness/noUnusedVariables: Biome thinks this is unused, but it's used by the function below
class LockServerWithPinBase extends PinCredentialBase {
  declare state: LockServerWithPinBase.State;

  override async initialize() {
    // Set required PinCredential defaults BEFORE super.initialize() to prevent
    // "Behaviors have errors" validation failures
    if (this.state.numberOfPinUsersSupported === undefined) {
      this.state.numberOfPinUsersSupported = 1;
    }
    if (this.state.maxPinCodeLength === undefined) {
      this.state.maxPinCodeLength = 8;
    }
    if (this.state.minPinCodeLength === undefined) {
      this.state.minPinCodeLength = 4;
    }
    if (this.state.sendPinOverTheAir === undefined) {
      this.state.sendPinOverTheAir = true;
    }
    if (this.state.requirePinForRemoteOperation === undefined) {
      this.state.requirePinForRemoteOperation = false;
    }

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }

    // Check if a PIN credential is configured for this entity
    // Also check if PIN is disabled via entity mapping
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const isPinDisabledByMapping =
      homeAssistant.state.mapping?.disableLockPin === true;
    const hasPinConfigured =
      !isPinDisabledByMapping &&
      this.hasStoredCredential(homeAssistant.entityId);

    applyPatchState(this.state, {
      lockState: this.state.config.getLockState(entity.state, this.agent),
      lockType: DoorLock.LockType.DeadBolt,
      operatingMode: DoorLock.OperatingMode.Normal,
      actuatorEnabled: true,
      supportedOperatingModes: {
        noRemoteLockUnlock: false,
        normal: true,
        passage: false,
        privacy: false,
        vacation: false,
      },
      // PIN credential configuration
      numberOfPinUsersSupported: 1,
      maxPinCodeLength: 8,
      minPinCodeLength: 4,
      // Only require PIN for remote operation if a PIN is actually configured
      // This tells Google Home to prompt for PIN in the app before unlocking
      requirePinForRemoteOperation: hasPinConfigured,
      sendPinOverTheAir: true,
    });
  }

  override lockDoor(request: DoorLock.LockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.lock(void 0, this.agent);

    // Log the lock request for debugging
    const hasPinProvided = !!request.pinCode;
    console.log(
      `[LockServer] lockDoor called for ${homeAssistant.entityId}, PIN provided: ${hasPinProvided}`,
    );

    // Lock does NOT require PIN validation - anyone can lock the door
    // We accept any PIN (or no PIN) and just proceed with the lock action
    // If a PIN was provided, pass it through to Home Assistant (some locks may need it)
    if (request.pinCode) {
      const providedPin = new TextDecoder().decode(request.pinCode);
      action.data = { ...action.data, code: providedPin };
    }

    homeAssistant.callAction(action);
  }

  override unlockDoor(request: DoorLock.UnlockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.unlock(void 0, this.agent);

    // Log the unlock request for debugging
    const hasPinProvided = !!request.pinCode;
    console.log(
      `[LockServer] unlockDoor called for ${homeAssistant.entityId}, PIN provided: ${hasPinProvided}, requirePin: ${this.state.requirePinForRemoteOperation}`,
    );

    // Validate provided PIN against stored hashed PIN
    if (this.state.requirePinForRemoteOperation) {
      if (!request.pinCode) {
        console.log(`[LockServer] unlockDoor REJECTED - no PIN provided`);
        throw new StatusResponseError(
          "PIN code required for remote unlock",
          StatusCode.Failure,
        );
      }
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (!this.verifyStoredPin(homeAssistant.entityId, providedPin)) {
        console.log(`[LockServer] unlockDoor REJECTED - invalid PIN`);
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
      console.log(`[LockServer] unlockDoor PIN verified successfully`);
      // Pass the provided PIN to Home Assistant (for locks that require it)
      action.data = { ...action.data, code: providedPin };
    }

    homeAssistant.callAction(action);
  }

  /**
   * Check if a PIN credential exists and is enabled for an entity
   */
  protected hasStoredCredential(entityId: string): boolean {
    return hasStoredCredentialHelper(this.env, entityId);
  }

  /**
   * Verify a PIN against the stored hashed credential
   */
  protected verifyStoredPin(entityId: string, pin: string): boolean {
    return verifyStoredPinHelper(this.env, entityId, pin);
  }

  /**
   * Set a PIN code for a user slot.
   * The PIN will be hashed before storage.
   */
  override async setPinCode(
    request: DoorLock.SetPinCodeRequest,
  ): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);

    const pinCode = new TextDecoder().decode(request.pin);

    await storage.setCredential({
      entityId: homeAssistant.entityId,
      pinCode,
      name: `User ${request.userId}`,
      enabled: request.userStatus === DoorLock.UserStatus.OccupiedEnabled,
    });
  }

  /**
   * Get a PIN code for a user slot.
   * Note: We cannot return the actual PIN since it's hashed.
   * We return a placeholder to indicate a PIN exists.
   */
  override getPinCode(
    request: DoorLock.GetPinCodeRequest,
  ): DoorLock.GetPinCodeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const hasCredential = this.hasStoredCredential(homeAssistant.entityId);

    if (!hasCredential || request.userId !== 1) {
      return {
        userId: request.userId,
        userStatus: DoorLock.UserStatus.Available,
        userType: null,
        pinCode: null,
      };
    }

    // Cannot return actual PIN since it's hashed - return empty to indicate PIN exists
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: null, // PIN is hashed, cannot be retrieved
    };
  }

  /**
   * Clear a specific PIN code.
   */
  override async clearPinCode(
    request: DoorLock.ClearPinCodeRequest,
  ): Promise<void> {
    if (request.pinSlotIndex === 1) {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const storage = this.env.get(LockCredentialStorage);
      await storage.deleteCredential(homeAssistant.entityId);
    }
  }

  /**
   * Clear all PIN codes.
   */
  override async clearAllPinCodes(): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);
    await storage.deleteCredential(homeAssistant.entityId);
  }
}

namespace LockServerWithPinBase {
  export class State extends PinCredentialBase.State {
    config!: LockServerConfig;
  }
}

/**
 * Creates a basic LockServer without PIN credential support.
 * Use this when no PIN is configured for the entity.
 */
export function LockServer(config: LockServerConfig) {
  return LockServerBase.set({ config });
}

/**
 * Creates a LockServer with PIN credential support.
 * This enables requirePinForRemoteOperation which tells Matter controllers
 * that a PIN is required for remote unlock operations.
 *
 * Note: This enables PIN entry in apps like Google Home, but voice unlock
 * remains disabled by Google's policy for Matter locks.
 */
export function LockServerWithPin(config: LockServerConfig) {
  return LockServerWithPinBase.set({ config });
}

/**
 * Extended DoorLock server with PinCredential + Unbolting features.
 * Adds unboltDoor command (unlatch) in addition to lock/unlock.
 * Used when the HA lock entity supports the OPEN feature.
 *
 * Apple Home shows an "Unlatch" button when this feature is present.
 */
const PinCredentialUnboltBase = Base.with(
  "PinCredential",
  "CredentialOverTheAirAccess",
  "Unbolting",
).set({
  wrongCodeEntryLimit: 3,
  userCodeTemporaryDisableTime: 10,
});

// biome-ignore lint/correctness/noUnusedVariables: Used by the factory function below
class LockServerWithPinAndUnboltBase extends PinCredentialUnboltBase {
  declare state: LockServerWithPinAndUnboltBase.State;

  override async initialize() {
    if (this.state.numberOfPinUsersSupported === undefined) {
      this.state.numberOfPinUsersSupported = 1;
    }
    if (this.state.maxPinCodeLength === undefined) {
      this.state.maxPinCodeLength = 8;
    }
    if (this.state.minPinCodeLength === undefined) {
      this.state.minPinCodeLength = 4;
    }
    if (this.state.sendPinOverTheAir === undefined) {
      this.state.sendPinOverTheAir = true;
    }
    if (this.state.requirePinForRemoteOperation === undefined) {
      this.state.requirePinForRemoteOperation = false;
    }

    await super.initialize();
    const homeAssistant = await this.agent.load(HomeAssistantEntityBehavior);
    this.update(homeAssistant.entity);
    this.reactTo(homeAssistant.onChange, this.update);
  }

  private update(entity: HomeAssistantEntityInformation) {
    if (!entity.state) {
      return;
    }
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const isPinDisabledByMapping =
      homeAssistant.state.mapping?.disableLockPin === true;
    const hasPinConfigured =
      !isPinDisabledByMapping &&
      hasStoredCredentialHelper(this.env, homeAssistant.entityId);

    applyPatchState(this.state, {
      lockState: this.state.config.getLockState(entity.state, this.agent),
      lockType: DoorLock.LockType.DeadBolt,
      operatingMode: DoorLock.OperatingMode.Normal,
      actuatorEnabled: true,
      supportedOperatingModes: {
        noRemoteLockUnlock: false,
        normal: true,
        passage: false,
        privacy: false,
        vacation: false,
      },
      numberOfPinUsersSupported: 1,
      maxPinCodeLength: 8,
      minPinCodeLength: 4,
      requirePinForRemoteOperation: hasPinConfigured,
      sendPinOverTheAir: true,
    });
  }

  override lockDoor(request: DoorLock.LockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.lock(void 0, this.agent);
    const hasPinProvided = !!request.pinCode;
    console.log(
      `[LockServer] lockDoor called for ${homeAssistant.entityId}, PIN provided: ${hasPinProvided}`,
    );
    if (request.pinCode) {
      const providedPin = new TextDecoder().decode(request.pinCode);
      action.data = { ...action.data, code: providedPin };
    }
    homeAssistant.callAction(action);
  }

  override unlockDoor(request: DoorLock.UnlockDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const action = this.state.config.unlock(void 0, this.agent);
    const hasPinProvided = !!request.pinCode;
    console.log(
      `[LockServer] unlockDoor called for ${homeAssistant.entityId}, PIN provided: ${hasPinProvided}, requirePin: ${this.state.requirePinForRemoteOperation}`,
    );
    if (this.state.requirePinForRemoteOperation) {
      if (!request.pinCode) {
        console.log(`[LockServer] unlockDoor REJECTED - no PIN provided`);
        throw new StatusResponseError(
          "PIN code required for remote unlock",
          StatusCode.Failure,
        );
      }
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (
        !verifyStoredPinHelper(this.env, homeAssistant.entityId, providedPin)
      ) {
        console.log(`[LockServer] unlockDoor REJECTED - invalid PIN`);
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
      console.log(`[LockServer] unlockDoor PIN verified successfully`);
      action.data = { ...action.data, code: providedPin };
    }
    homeAssistant.callAction(action);
  }

  override unboltDoor(request: DoorLock.UnboltDoorRequest) {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const unlatchConfig = this.state.config.unlatch;
    if (!unlatchConfig) {
      // Fallback to unlock if unlatch not configured
      const action = this.state.config.unlock(void 0, this.agent);
      homeAssistant.callAction(action);
      return;
    }
    const action = unlatchConfig(void 0, this.agent);
    const hasPinProvided = !!request.pinCode;
    console.log(
      `[LockServer] unboltDoor called for ${homeAssistant.entityId}, PIN provided: ${hasPinProvided}, requirePin: ${this.state.requirePinForRemoteOperation}`,
    );
    if (this.state.requirePinForRemoteOperation) {
      if (!request.pinCode) {
        console.log(`[LockServer] unboltDoor REJECTED - no PIN provided`);
        throw new StatusResponseError(
          "PIN code required for remote unlatch",
          StatusCode.Failure,
        );
      }
      const providedPin = new TextDecoder().decode(request.pinCode);
      if (
        !verifyStoredPinHelper(this.env, homeAssistant.entityId, providedPin)
      ) {
        console.log(`[LockServer] unboltDoor REJECTED - invalid PIN`);
        throw new StatusResponseError("Invalid PIN code", StatusCode.Failure);
      }
      console.log(`[LockServer] unboltDoor PIN verified successfully`);
      action.data = { ...action.data, code: providedPin };
    }
    homeAssistant.callAction(action);
  }

  override async setPinCode(
    request: DoorLock.SetPinCodeRequest,
  ): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);
    const pinCode = new TextDecoder().decode(request.pin);
    await storage.setCredential({
      entityId: homeAssistant.entityId,
      pinCode,
      name: `User ${request.userId}`,
      enabled: request.userStatus === DoorLock.UserStatus.OccupiedEnabled,
    });
  }

  override getPinCode(
    request: DoorLock.GetPinCodeRequest,
  ): DoorLock.GetPinCodeResponse {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const hasCredential = hasStoredCredentialHelper(
      this.env,
      homeAssistant.entityId,
    );
    if (!hasCredential || request.userId !== 1) {
      return {
        userId: request.userId,
        userStatus: DoorLock.UserStatus.Available,
        userType: null,
        pinCode: null,
      };
    }
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.OccupiedEnabled,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: null,
    };
  }

  override async clearPinCode(
    request: DoorLock.ClearPinCodeRequest,
  ): Promise<void> {
    if (request.pinSlotIndex === 1) {
      const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
      const storage = this.env.get(LockCredentialStorage);
      await storage.deleteCredential(homeAssistant.entityId);
    }
  }

  override async clearAllPinCodes(): Promise<void> {
    const homeAssistant = this.agent.get(HomeAssistantEntityBehavior);
    const storage = this.env.get(LockCredentialStorage);
    await storage.deleteCredential(homeAssistant.entityId);
  }
}

namespace LockServerWithPinAndUnboltBase {
  export class State extends PinCredentialUnboltBase.State {
    config!: LockServerConfig;
  }
}

/**
 * Creates a LockServer with PIN credential + Unbolting support.
 * Used when the HA lock entity supports the OPEN feature (unlatch).
 * Apple Home shows an "Unlatch" button when this is enabled.
 */
export function LockServerWithPinAndUnbolt(config: LockServerConfig) {
  return LockServerWithPinAndUnboltBase.set({ config });
}
