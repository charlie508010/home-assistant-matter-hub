export interface MatterReadEndpointDiagnostic {
  endpointId: number;
  endpointName: string;
  entityId?: string;
  name?: string;
  friendlyName?: string;
  registryName?: string;
  deviceTypeList?: unknown;
}

interface MatterReadDiagnosticsState {
  bridges: Record<string, Record<string, MatterReadEndpointDiagnostic>>;
}

const GLOBAL_KEY = "__HAMH_MATTER_READ_DIAGNOSTICS__";

function state(): MatterReadDiagnosticsState {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: MatterReadDiagnosticsState;
  };

  globalObject[GLOBAL_KEY] ??= { bridges: {} };
  return globalObject[GLOBAL_KEY];
}

export function setMatterReadEndpointDiagnostics(
  bridgeId: string,
  entries: MatterReadEndpointDiagnostic[],
): void {
  const byEndpoint: Record<string, MatterReadEndpointDiagnostic> = {};

  for (const entry of entries) {
    byEndpoint[String(entry.endpointId)] = entry;
  }

  state().bridges[bridgeId] = byEndpoint;
}

export function clearMatterReadEndpointDiagnostics(bridgeId: string): void {
  delete state().bridges[bridgeId];
}
