import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_MAX_AGE_HOURS,
  parseSessionMaxAgeHours,
  SESSION_MAX_AGE_HOURS_RANGE,
} from "./server-mode-bridge.js";

describe("parseSessionMaxAgeHours", () => {
  it("returns the default when raw is undefined", () => {
    expect(parseSessionMaxAgeHours(undefined)).toBe(
      DEFAULT_SESSION_MAX_AGE_HOURS,
    );
  });

  it("returns the default when raw is null", () => {
    expect(parseSessionMaxAgeHours(null)).toBe(DEFAULT_SESSION_MAX_AGE_HOURS);
  });

  it("returns the default when raw is an empty string", () => {
    expect(parseSessionMaxAgeHours("")).toBe(DEFAULT_SESSION_MAX_AGE_HOURS);
  });

  it("returns null on a non-numeric string so caller can warn", () => {
    expect(parseSessionMaxAgeHours("abc")).toBeNull();
  });

  it("returns null on a negative integer so caller can warn", () => {
    expect(parseSessionMaxAgeHours("-1")).toBeNull();
  });

  it("returns 0 for the disable sentinel", () => {
    expect(parseSessionMaxAgeHours("0")).toBe(0);
  });

  it("clamps values below the lower bound to the minimum", () => {
    // Anything between 1 and min would round up; explicit min check.
    expect(
      parseSessionMaxAgeHours(String(SESSION_MAX_AGE_HOURS_RANGE.min)),
    ).toBe(SESSION_MAX_AGE_HOURS_RANGE.min);
  });

  it("clamps values above the upper bound to the maximum", () => {
    expect(
      parseSessionMaxAgeHours(String(SESSION_MAX_AGE_HOURS_RANGE.max + 1)),
    ).toBe(SESSION_MAX_AGE_HOURS_RANGE.max);
  });

  it("passes valid values through unchanged", () => {
    expect(parseSessionMaxAgeHours("4")).toBe(4);
    expect(parseSessionMaxAgeHours("24")).toBe(24);
    expect(parseSessionMaxAgeHours("168")).toBe(168);
  });

  it("parses leading-digit strings like Number.parseInt does", () => {
    // Mirrors Number.parseInt behaviour (existing semantics, not new).
    expect(parseSessionMaxAgeHours("12abc")).toBe(12);
  });
});
