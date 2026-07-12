import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { classify } from "../classification/orchestrator.js";
import { loadProductConfig } from "../config/product-config.js";

const ClassifyDocumentInputSchema = {
  documentText: z.string().min(1).describe("The document content to classify."),
  productId: z
    .string()
    .describe(
      "Which product's classification config to use (e.g. 'veteran-claims-app').",
    ),
};

export async function handleClassifyDocument({
  documentText,
  productId,
}: {
  documentText: string;
  productId: string;
}) {
  const configDir = process.env.PRODUCT_CONFIG_DIR ?? "./config";
  const config = loadProductConfig(`${configDir}/${productId}.json`);
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
