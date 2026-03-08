import { MemoryItem } from '../types.js';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.status}`);
    }

    const data = await res.json() as any;
    return data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface ScoredMemory {
  item: MemoryItem;
  score: number;
}

export async function searchMemories(
  query: string,
  items: MemoryItem[],
  embedder: EmbeddingProvider,
  topN: number = 10,
  threshold: number = 0.3
): Promise<ScoredMemory[]> {
  if (items.length === 0) return [];

  const [queryEmbedding, ...itemEmbeddings] = await embedder.embedBatch([
    query,
    ...items.map(i => i.content),
  ]);

  const scored: ScoredMemory[] = items.map((item, i) => ({
    item,
    score: cosineSimilarity(queryEmbedding, itemEmbeddings[i]),
  }));

  return scored
    .filter(s => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
