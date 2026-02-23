import { describe, expect, it } from "bun:test";
import { matchesTraits } from "./targeting";

describe("matchesTraits", () => {
  it("returns true when no target traits are provided", () => {
    expect(matchesTraits(null, { plan: "pro" })).toBe(true);
  });

  it("returns false when target traits exist but user traits are missing", () => {
    expect(matchesTraits({ plan: "pro" }, undefined)).toBe(false);
  });

  it("supports exact key-value matching", () => {
    expect(matchesTraits({ plan: "pro" }, { plan: "pro" })).toBe(true);
    expect(matchesTraits({ plan: "pro" }, { plan: "free" })).toBe(false);
  });

  it("supports array any-of matching", () => {
    expect(matchesTraits({ plan: ["starter", "pro"] }, { plan: "pro" })).toBe(true);
    expect(matchesTraits({ plan: ["starter", "pro"] }, { plan: "growth" })).toBe(false);
  });
});
