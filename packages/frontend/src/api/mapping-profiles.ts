import type {
  MappingProfile,
  MappingProfileImportPreview,
  MappingProfileImportResult,
} from "@home-assistant-matter-hub/common";

export async function exportMappingProfile(
  bridgeId: string,
  profileName: string,
): Promise<MappingProfile> {
  const response = await fetch(
    `api/mapping-profiles/export/${bridgeId}?name=${encodeURIComponent(profileName)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to export mapping profile: ${response.statusText}`);
  }
  return response.json();
}

export async function previewMappingProfileImport(
  bridgeId: string,
  profile: MappingProfile,
  availableEntityIds: string[],
): Promise<MappingProfileImportPreview> {
  const response = await fetch(
    `api/mapping-profiles/import/preview/${bridgeId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, availableEntityIds }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to preview import: ${response.statusText}`);
  }
  return response.json();
}

export async function applyMappingProfileImport(
  bridgeId: string,
  profile: MappingProfile,
  selectedEntityIds: string[],
): Promise<MappingProfileImportResult> {
  const response = await fetch(
    `api/mapping-profiles/import/apply/${bridgeId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, selectedEntityIds }),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to apply mapping profile: ${response.statusText}`);
  }
  return response.json();
}
