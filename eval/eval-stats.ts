const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export interface EvalOutcome {
  expectedClass: "A" | "B" | "C" | "D";
  actualClass: "A" | "B" | "C" | "D";
}

export interface EvalStats {
  accuracy: number;
  correct: number;
  total: number;
  falseNegatives: number;
}

export function computeEvalStats(outcomes: EvalOutcome[]): EvalStats {
  let correct = 0;
  let falseNegatives = 0;

  for (const outcome of outcomes) {
    const isMatch = outcome.actualClass === outcome.expectedClass;
    if (isMatch) correct++;
    if (
      !isMatch &&
      TIER_ORDER[outcome.actualClass] < TIER_ORDER[outcome.expectedClass]
    ) {
      falseNegatives++;
    }
  }

  return {
    accuracy: correct / outcomes.length,
    correct,
    total: outcomes.length,
    falseNegatives,
  };
}
