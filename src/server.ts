import Fastify from "fastify";
import { z } from "zod";
import { classify } from "./classification/orchestrator.js";
import { loadProductConfig } from "./config/product-config.js";

const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const ClassifyRequestSchema = z.object({
  documentText: z.string().min(1),
  productId: z
    .string()
    .regex(
      PRODUCT_ID_PATTERN,
      "productId must contain only letters, numbers, underscores, and hyphens",
    ),
});

export function buildServer() {
  const app = Fastify();
  const apiToken = process.env.CLASSIFIER_API_TOKEN;
  const configDir = process.env.PRODUCT_CONFIG_DIR ?? "./config";

  if (!apiToken && process.env.NODE_ENV === "production") {
    throw new Error(
      "CLASSIFIER_API_TOKEN must be set when NODE_ENV=production — refusing to start unauthenticated in production.",
    );
  }
  if (!apiToken) {
    app.log.warn(
      "CLASSIFIER_API_TOKEN is not set — /classify is running WITHOUT authentication. This is intended for local development only.",
    );
  }

  app.addHook("onRequest", async (request, reply) => {
    if (!apiToken) return;
    const header = request.headers.authorization;
    if (header !== `Bearer ${apiToken}`) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.post("/classify", async (request, reply) => {
    const parsed = ClassifyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: parsed.error.message });
      return;
    }

    let config;
    try {
      config = loadProductConfig(`${configDir}/${parsed.data.productId}.json`);
    } catch {
      reply
        .code(404)
        .send({ error: `Unknown productId: ${parsed.data.productId}` });
      return;
    }

    try {
      const result = await classify(parsed.data.documentText, config);
      reply.send(result);
    } catch (err) {
      request.log.error(err, "classification failed");
      reply
        .code(502)
        .send({
          error: "Classification failed due to a downstream service error",
        });
    }
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildServer();
  app.listen(
    { port: Number(process.env.PORT ?? 3100), host: "0.0.0.0" },
    (err, address) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
      app.log.info(`doc-classifier listening at ${address}`);
    },
  );
}
