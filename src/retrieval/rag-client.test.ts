import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { retrieveContext } from "./rag-client.js";

describe("retrieveContext", () => {
  beforeEach(() => {
    process.env.RAG_API_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RAG_API_TOKEN;
  });

  it("parses rag-system's search response into RetrievedContext[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              chunkId: "chunk-1",
              text: "PTSD involves hypervigilance.",
              document: { title: "PTSD Guide" },
            },
          ],
        }),
      }),
    );

    const context = await retrieveContext("hypervigilance", ["va-corpus"]);

    expect(context).toEqual([
      {
        id: "chunk-1",
        text: "PTSD involves hypervigilance.",
        sourceTitle: "PTSD Guide",
      },
    ]);
  });

  it("throws if RAG_API_TOKEN is not configured", async () => {
    delete process.env.RAG_API_TOKEN;
    await expect(retrieveContext("query", ["source"])).rejects.toThrow(
      "RAG_API_TOKEN environment variable is required",
    );
  });
});
