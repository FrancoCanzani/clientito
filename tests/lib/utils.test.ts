import { describe, it, expect, vi } from "vitest";
import { chunkArray, withRetry, getDayBoundsUtc } from "../../src/worker/lib/utils";

describe("chunkArray", () => {
  it("splits array into chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns single chunk for small arrays", () => {
    expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });
});

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("logs with label on failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("oops"))
      .mockResolvedValue("ok");

    await withRetry(fn, { maxRetries: 1, baseDelayMs: 1, label: "test-op" });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("test-op"),
    );
    warnSpy.mockRestore();
  });
});

describe("getDayBoundsUtc", () => {
  it("returns start and end of UTC day", () => {
    // 2024-01-15 12:30:00 UTC
    const ts = Date.UTC(2024, 0, 15, 12, 30, 0);
    const { start, end } = getDayBoundsUtc(ts);

    expect(start).toBe(Date.UTC(2024, 0, 15));
    expect(end).toBe(Date.UTC(2024, 0, 16));
    expect(end - start).toBe(86_400_000);
  });
});
