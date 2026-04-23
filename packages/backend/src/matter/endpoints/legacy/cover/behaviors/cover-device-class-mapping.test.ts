import type { HomeAssistantEntityState } from "@home-assistant-matter-hub/common";
import { WindowCovering } from "@matter/main/clusters";
import { describe, expect, it } from "vitest";
import {
  DEVICE_CLASS_TO_MATTER_TYPE,
  deviceClassMapping,
} from "./cover-window-covering-server.js";

const entity = (
  device_class?: unknown,
  supported_features?: number,
): HomeAssistantEntityState => {
  const attributes: Record<string, unknown> = {};
  if (device_class !== undefined) attributes.device_class = device_class;
  if (supported_features !== undefined)
    attributes.supported_features = supported_features;
  return {
    entity_id: "cover.test",
    state: "open",
    context: { id: "ctx" },
    last_changed: "t",
    last_updated: "t",
    attributes,
  } as unknown as HomeAssistantEntityState;
};

describe("deviceClassMapping", () => {
  it("maps curtain to Drapery + CentralCurtain", () => {
    const mapping = deviceClassMapping(entity("curtain"));
    expect(mapping?.type).toBe(WindowCovering.WindowCoveringType.Drapery);
    expect(mapping?.endProductType).toBe(
      WindowCovering.EndProductType.CentralCurtain,
    );
  });

  it("maps shutter to Shutter + RollerShutter", () => {
    const mapping = deviceClassMapping(entity("shutter"));
    expect(mapping?.type).toBe(WindowCovering.WindowCoveringType.Shutter);
    expect(mapping?.endProductType).toBe(
      WindowCovering.EndProductType.RollerShutter,
    );
  });

  it("maps awning to Awning + AwningTerracePatio", () => {
    const mapping = deviceClassMapping(entity("awning"));
    expect(mapping?.type).toBe(WindowCovering.WindowCoveringType.Awning);
    expect(mapping?.endProductType).toBe(
      WindowCovering.EndProductType.AwningTerracePatio,
    );
  });

  it("is case-insensitive", () => {
    expect(deviceClassMapping(entity("Curtain"))?.type).toBe(
      WindowCovering.WindowCoveringType.Drapery,
    );
  });

  it("returns undefined for missing device_class", () => {
    expect(deviceClassMapping(entity())).toBeUndefined();
  });

  it("returns undefined for unknown device_class", () => {
    expect(deviceClassMapping(entity("spaceship"))).toBeUndefined();
  });

  it("returns undefined for non-string device_class", () => {
    expect(deviceClassMapping(entity(42))).toBeUndefined();
  });

  it("falls back to Rollershade for blind without tilt feature (#312)", () => {
    // supported_features=7 = open + close + set_position (lift only)
    const mapping = deviceClassMapping(entity("blind", 7));
    expect(mapping?.type).toBe(WindowCovering.WindowCoveringType.Rollershade);
    expect(mapping?.endProductType).toBe(
      WindowCovering.EndProductType.InteriorBlind,
    );
  });

  it("keeps TiltBlindTiltOnly for blind with tilt feature", () => {
    // supported_features=7+16=23 includes support_open_tilt
    const mapping = deviceClassMapping(entity("blind", 23));
    expect(mapping?.type).toBe(
      WindowCovering.WindowCoveringType.TiltBlindTiltOnly,
    );
    expect(mapping?.endProductType).toBe(
      WindowCovering.EndProductType.InteriorBlind,
    );
  });

  it("covers every documented key", () => {
    expect(Object.keys(DEVICE_CLASS_TO_MATTER_TYPE).sort()).toEqual([
      "awning",
      "blind",
      "curtain",
      "shade",
      "shutter",
    ]);
  });
});
