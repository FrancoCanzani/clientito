import { describe, it, expect } from "vitest";
import { appendSignature } from "../../src/worker/lib/email/signature";

describe("appendSignature", () => {
  it("appends signature to body", () => {
    const result = appendSignature("<p>Hello</p>", "Best regards, Franco");
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("Best regards, Franco");
    expect(result).toContain("border-top");
  });

  it("returns body unchanged when signature is null", () => {
    expect(appendSignature("<p>Hello</p>", null)).toBe("<p>Hello</p>");
  });

  it("returns body unchanged when signature is undefined", () => {
    expect(appendSignature("<p>Hello</p>", undefined)).toBe("<p>Hello</p>");
  });

  it("returns body unchanged when signature is empty/whitespace", () => {
    expect(appendSignature("<p>Hello</p>", "   ")).toBe("<p>Hello</p>");
    expect(appendSignature("<p>Hello</p>", "")).toBe("<p>Hello</p>");
  });
});
