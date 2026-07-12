import { describe, it, expect } from "vitest";
import { computeEvalStats } from "./eval-stats.js";

describe("computeEvalStats", () => {
  it("counts a lower-than-expected tier as a false negative", () => {
    const stats = computeEvalStats([{ expectedClass: "D", actualClass: "B" }]);
    expect(stats.falseNegatives).toBe(1);
    expect(stats.accuracy).toBe(0);
  });

  it("does not count an over-classification as a false negative", () => {
    const stats = computeEvalStats([{ expectedClass: "B", actualClass: "D" }]);
    expect(stats.falseNegatives).toBe(0);
    expect(stats.accuracy).toBe(0);
  });

  it("computes 100% accuracy when every case matches", () => {
    const stats = computeEvalStats([
      { expectedClass: "B", actualClass: "B" },
      { expectedClass: "D", actualClass: "D" },
    ]);
    expect(stats.accuracy).toBe(1);
    expect(stats.falseNegatives).toBe(0);
  });
});
