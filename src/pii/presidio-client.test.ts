import { describe, it, expect, vi, afterEach } from "vitest";
import { detectPii } from "./presidio-client.js";

describe("detectPii", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses Presidio's analyze response into PiiFinding[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { entity_type: "US_SSN", start: 10, end: 21, score: 0.85 },
        ],
      }),
    );

    const findings = await detectPii("My SSN is 123-45-6789");

    expect(findings).toEqual([
      { entityType: "US_SSN", start: 10, end: 21, score: 0.85 },
    ]);
  });

  it("throws a clear error when the Presidio request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    await expect(detectPii("text")).rejects.toThrow(
      "Presidio analyze request failed: 503 Service Unavailable",
    );
  });
});
