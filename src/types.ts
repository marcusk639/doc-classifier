import { z } from "zod";

export const DocumentClassSchema = z.enum(["A", "B", "C", "D"]);
export type DocumentClass = z.infer<typeof DocumentClassSchema>;

export const HandlingRulesSchema = z.object({
  allowedAccessScope: z.enum(["shared", "single-source-only"]),
  retentionRequirements: z.string().optional(),
  requiresContentScanning: z.boolean(),
  permittedForIngestion: z.boolean(),
});
export type HandlingRules = z.infer<typeof HandlingRulesSchema>;

export const ClassificationResultSchema = z.object({
  class: DocumentClassSchema,
  handlingRules: HandlingRulesSchema,
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  retrievedContextIds: z.array(z.string()),
  needsReview: z.boolean(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export interface RetrievedContext {
  id: string;
  text: string;
  sourceTitle: string;
}

export interface PiiFinding {
  entityType: string;
  start: number;
  end: number;
  score: number;
}
