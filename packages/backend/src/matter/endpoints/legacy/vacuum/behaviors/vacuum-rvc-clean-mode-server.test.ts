import { describe, expect, it } from "vitest";
import {
  buildSupportedModes,
  CleanType,
  parseCleanType,
} from "./vacuum-rvc-clean-mode-server.js";

describe("parseCleanType", () => {
  it.each<[string | undefined, CleanType]>([
    [undefined, CleanType.Sweeping],
    ["", CleanType.Sweeping],
    ["Sweep", CleanType.Sweeping],
    ["sweep", CleanType.Sweeping],
    ["Vacuum", CleanType.Sweeping],
    ["Mop", CleanType.Mopping],
    ["mopping", CleanType.Mopping],
    ["Sweep Mop", CleanType.SweepingAndMopping],
    ["sweep_mop", CleanType.SweepingAndMopping],
    ["Vacuum & Mop", CleanType.SweepingAndMopping],
    ["vacuum_and_mop", CleanType.SweepingAndMopping],
    ["sweeping_and_mopping", CleanType.SweepingAndMopping],
    ["Sweep Before Mopping", CleanType.MoppingAfterSweeping],
    ["sweep_before_mopping", CleanType.MoppingAfterSweeping],
    ["Vacuum then mop", CleanType.MoppingAfterSweeping],
    ["vacuum_then_mop", CleanType.MoppingAfterSweeping],
    ["Mop after vacuum", CleanType.MoppingAfterSweeping],
    ["Mopping after sweeping", CleanType.MoppingAfterSweeping],
  ])("parses %j as %i", (input, expected) => {
    expect(parseCleanType(input)).toBe(expected);
  });
});

describe("buildSupportedModes", () => {
  function labels(modes: { label: string }[]): string[] {
    return modes.map((m) => m.label);
  }

  it("derives all four cleaning types from UWANT/Xiaomi labels", () => {
    const modes = buildSupportedModes(undefined, undefined, [
      "Sweep",
      "Mop",
      "Sweep Mop",
      "Sweep Before Mopping",
    ]);
    expect(labels(modes)).toEqual([
      "Vacuum",
      "Vacuum & Mop",
      "Mop",
      "Vacuum Then Mop",
    ]);
  });

  it("derives the same modes from HA snake_case labels", () => {
    const modes = buildSupportedModes(undefined, undefined, [
      "vacuum",
      "mop",
      "vacuum_and_mop",
      "vacuum_then_mop",
    ]);
    expect(labels(modes)).toEqual([
      "Vacuum",
      "Vacuum & Mop",
      "Mop",
      "Vacuum Then Mop",
    ]);
  });

  it("only includes modes the entity actually supports", () => {
    const modes = buildSupportedModes(undefined, undefined, ["Sweep", "Mop"]);
    expect(labels(modes)).toEqual(["Vacuum", "Mop"]);
  });

  it("treats 'Sweep Mop' as combined sweep+mop, not mop-only", () => {
    const modes = buildSupportedModes(undefined, undefined, ["Sweep Mop"]);
    expect(labels(modes)).toContain("Vacuum & Mop");
    expect(labels(modes)).not.toContain("Vacuum Then Mop");
  });

  it("treats 'Sweep Before Mopping' as sequential, not combined", () => {
    const modes = buildSupportedModes(undefined, undefined, [
      "Sweep Before Mopping",
    ]);
    expect(labels(modes)).toContain("Vacuum Then Mop");
    expect(labels(modes)).not.toContain("Vacuum & Mop");
  });
});
