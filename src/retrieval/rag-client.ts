import type { RetrievedContext } from "../types.js";

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:3000";

interface SearchDocumentsResponse {
  results: Array<{
    text: string;
    document: { title: string };
    chunk: { id: string };
  }>;
}

export async function retrieveContext(
  query: string,
  sourceIds: string[],
  topK = 5,
): Promise<RetrievedContext[]> {
  const token = process.env.RAG_API_TOKEN;
  if (!token) {
    throw new Error(
      "RAG_API_TOKEN environment variable is required to call rag-system's search API",
    );
  }

  const response = await fetch(`${RAG_API_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, sourceIds, topK }),
  });

  if (!response.ok) {
    throw new Error(
      `rag-system search request failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as SearchDocumentsResponse;
  return body.results.map((r) => ({
    id: r.chunk.id,
    text: r.text,
    sourceTitle: r.document.title,
  }));
}
