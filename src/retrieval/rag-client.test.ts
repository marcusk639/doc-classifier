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
              text: "Records containing a government-issued ID number are highly sensitive.",
              document: { title: "Sensitivity Reference Guide" },
              chunk: { id: "chunk-1" },
            },
          ],
        }),
      }),
    );

    const context = await retrieveContext("sensitive identifiers", [
      "acme-corp-kb",
    ]);

    expect(context).toEqual([
      {
        id: "chunk-1",
        text: "Records containing a government-issued ID number are highly sensitive.",
        sourceTitle: "Sensitivity Reference Guide",
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
