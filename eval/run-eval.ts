import { readFileSync } from "node:fs";
import { classify } from "../src/classification/orchestrator.js";
import { loadProductConfigById } from "../src/config/product-config.js";
import { computeEvalStats, type EvalOutcome } from "./eval-stats.js";

interface GoldenCase {
  documentText: string;
  expectedClass: "A" | "B" | "C" | "D";
  productId: string;
}

async function runEval() {
  const goldenSet: GoldenCase[] = JSON.parse(
    readFileSync(new URL("./golden-set.json", import.meta.url), "utf-8"),
  );

  const outcomes: EvalOutcome[] = [];

  for (const testCase of goldenSet) {
    const config = loadProductConfigById(
      process.env.PRODUCT_CONFIG_DIR ?? "./config",
      testCase.productId,
    );
    const result = await classify(testCase.documentText, config);
    outcomes.push({
      expectedClass: testCase.expectedClass,
      actualClass: result.class,
    });
    console.log(
      `${result.class === testCase.expectedClass ? "PASS" : "FAIL"} expected=${testCase.expectedClass} actual=${result.class} confidence=${result.confidence.toFixed(2)} "${testCase.documentText.slice(0, 50)}..."`,
    );
  }

  const stats = computeEvalStats(outcomes);
  console.log(
    `\nAccuracy: ${(stats.accuracy * 100).toFixed(1)}% (${stats.correct}/${stats.total})`,
  );
  console.log(
    `False negatives (under-classified — the worst error type): ${stats.falseNegatives}`,
  );

  if (stats.falseNegatives > 0) {
    console.error(
      "\nEval failed: false negatives are not acceptable for a fail-conservative classifier.",
    );
    process.exit(1);
  }
}

runEval();
