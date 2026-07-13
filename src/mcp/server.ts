import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classify } from "../classification/orchestrator.js";
import {
  loadProductConfigById,
  PRODUCT_ID_PATTERN,
} from "../config/product-config.js";

const ClassifyDocumentInputSchema = {
  documentText: z.string().min(1).describe("The document content to classify."),
  productId: z
    .string()
    .regex(
      PRODUCT_ID_PATTERN,
      "productId must contain only letters, numbers, underscores, and hyphens",
    )
    .describe(
      "Which product's classification config to use (e.g. 'acme-corp').",
    ),
};

export async function handleClassifyDocument({
  documentText,
  productId,
}: {
  documentText: string;
  productId: string;
}) {
  if (!PRODUCT_ID_PATTERN.test(productId)) {
    return {
      content: [
        { type: "text" as const, text: `Invalid productId: ${productId}` },
      ],
      isError: true,
    };
  }

  const configDir = process.env.PRODUCT_CONFIG_DIR ?? "./config";

  let config;
  try {
    config = loadProductConfigById(configDir, productId);
  } catch (err) {
    console.error(
      `[doc-classifier MCP] config load failed for productId=${productId}:`,
      err,
    );
    return {
      content: [
        { type: "text" as const, text: `Unknown productId: ${productId}` },
      ],
      isError: true,
    };
  }

  try {
    const result = await classify(documentText, config);
    return {
      content: [
        {
          type: "text" as const,
          text: `Classified as tier ${result.class}: ${result.rationale}`,
        },
      ],
      structuredContent: result,
    };
  } catch (err) {
    console.error(
      `[doc-classifier MCP] classification failed for productId=${productId}:`,
      err,
    );
    return {
      content: [
        {
          type: "text" as const,
          text: "Classification failed due to a downstream service error",
        },
      ],
      isError: true,
    };
  }
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "doc-classifier", version: "0.1.0" });
  server.tool(
    "classify_document",
    "Classify a document's sensitivity tier using retrieval-grounded LLM classification plus direct-identifier detection.",
    ClassifyDocumentInputSchema,
    handleClassifyDocument,
  );
  return server;
}
