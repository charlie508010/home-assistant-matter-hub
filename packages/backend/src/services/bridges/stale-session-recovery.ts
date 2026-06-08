export interface StaleMatterSessionEvent {
  readonly sessionId: string;
  readonly sourceNodeId?: string;
}

export type StaleMatterSessionRecoveryHandler = (
  event: StaleMatterSessionEvent,
) => void;

interface StaleSessionRecoveryGlobal {
  __HAMH_STALE_SESSION_RECOVERY_HANDLERS__?:
    | Set<StaleMatterSessionRecoveryHandler>
    | undefined;
  __HAMH_ON_STALE_MATTER_SESSION__?:
    | ((event: StaleMatterSessionEvent) => void)
    | undefined;
}

export function registerStaleMatterSessionRecoveryHandler(
  handler: StaleMatterSessionRecoveryHandler,
) {
  const staleSessionGlobal = globalThis as typeof globalThis &
    StaleSessionRecoveryGlobal;

  if (!staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__) {
    staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__ = new Set();
  }

  staleSessionGlobal.__HAMH_ON_STALE_MATTER_SESSION__ = (event) => {
    for (const registeredHandler of [
      ...(staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__ ?? []),
    ]) {
      registeredHandler(event);
    }
  };

  staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__.add(handler);

  return () => {
    staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__?.delete(
      handler,
    );
    if (
      staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__?.size === 0
    ) {
      delete staleSessionGlobal.__HAMH_STALE_SESSION_RECOVERY_HANDLERS__;
      delete staleSessionGlobal.__HAMH_ON_STALE_MATTER_SESSION__;
    }
  };
}
