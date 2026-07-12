import Fastify from "fastify";
import { z } from "zod";
import { classify } from "./classification/orchestrator.js";
import { loadProductConfig } from "./config/product-config.js";

const ClassifyRequestSchema = z.object({
  documentText: z.string().min(1),
  productId: z.string(),
});

export function buildServer() {
  const app = Fastify();
  const apiToken = process.env.CLASSIFIER_API_TOKEN;
  const configDir = process.env.PRODUCT_CONFIG_DIR ?? "./config";

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

    const config = loadProductConfig(
      `${configDir}/${parsed.data.productId}.json`,
    );
    const result = await classify(parsed.data.documentText, config);
    reply.send(result);
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
