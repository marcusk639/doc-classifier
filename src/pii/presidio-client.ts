import type { PiiFinding } from "../types.js";

const PRESIDIO_ANALYZE_URL =
  process.env.PRESIDIO_URL ?? "http://localhost:5002";

interface PresidioAnalyzeResponse {
  entity_type: string;
  start: number;
  end: number;
  score: number;
}

export async function detectPii(text: string): Promise<PiiFinding[]> {
  const response = await fetch(`${PRESIDIO_ANALYZE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: "en" }),
  });

  if (!response.ok) {
    throw new Error(
      `Presidio analyze request failed: ${response.status} ${response.statusText}`,
    );
  }

  const results = (await response.json()) as PresidioAnalyzeResponse[];
  return results.map((r) => ({
    entityType: r.entity_type,
    start: r.start,
    end: r.end,
    score: r.score,
  }));
}
