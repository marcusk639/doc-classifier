import { readFileSync } from "node:fs";
import { z } from "zod";
import { DocumentClassSchema } from "../types.js";

export const ProductClassificationConfigSchema = z.object({
  productId: z.string(),
  referenceSourceId: z.string(),
  classificationPrompt: z.string(),
  model: z.string(),
  conservativeTier: DocumentClassSchema,
  confidenceThreshold: z.number().min(0).max(1),
});
export type ProductClassificationConfig = z.infer<
  typeof ProductClassificationConfigSchema
>;

export const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isValidProductId(productId: string): boolean {
  return PRODUCT_ID_PATTERN.test(productId);
}

export function loadProductConfig(
  configPath: string,
): ProductClassificationConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch (cause) {
    throw new Error(
      `Could not read product classification config at ${configPath}`,
      { cause },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new Error(
      `Invalid product classification config at ${configPath}: not valid JSON`,
      { cause },
    );
  }

  const parsed = ProductClassificationConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Invalid product classification config at ${configPath}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function loadProductConfigById(
  configDir: string,
  productId: string,
): ProductClassificationConfig {
  if (!isValidProductId(productId)) {
    throw new Error(`Invalid productId: ${productId}`);
  }
  return loadProductConfig(`${configDir}/${productId}.json`);
}
