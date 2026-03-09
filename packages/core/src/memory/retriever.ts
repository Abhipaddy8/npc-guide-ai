/**
 * Memory Retriever — semantic search with keyword fallback.
 * Tries cosine similarity via embeddings first. If no API key or it fails,
 * falls back to token-overlap keyword scoring.
 */

import { MemoryItem } from '../types.js';
import { EmbeddingProvider, searchMemories } from './embeddings.js';

export interface RetrievalResult {
  item: MemoryItem;
  score: number;
  method: 'embedding' | 'keyword';
}

export async function retrieveRelevantMemories(
  query: string,
  items: MemoryItem[],
  embedder: EmbeddingProvider | null,
  topN: number = 10,
  threshold: number = 0.2
): Promise<RetrievalResult[]> {
  if (items.length === 0) return [];

  // Try embeddings first
  if (embedder) {
    try {
      const results = await searchMemories(query, items, embedder, topN, threshold);
      if (results.length > 0) {
        return results.map(r => ({ item: r.item, score: r.score, method: 'embedding' as const }));
      }
    } catch {
      // Embedding API failed — fall through to keyword
    }
  }

  // Keyword fallback
  return keywordSearch(query, items, topN);
}

function keywordSearch(query: string, items: MemoryItem[], topN: number): RetrievalResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored: RetrievalResult[] = [];

  for (const item of items) {
    const itemTokens = tokenize(item.content);
    if (itemTokens.length === 0) continue;

    // Count matching tokens
    let matches = 0;
    for (const qt of queryTokens) {
      if (itemTokens.some(it => it.includes(qt) || qt.includes(it))) {
        matches++;
      }
    }

    let score = matches / queryTokens.length;

    // Boost for category relevance
    if (query.toLowerCase().includes('decision') && item.category === 'decision') score *= 1.3;
    if (query.toLowerCase().includes('architect') && item.category === 'architecture') score *= 1.3;
    if (query.toLowerCase().includes('mission') && item.category === 'progress') score *= 1.3;

    // Boost for recency (newer items score slightly higher)
    if (item.status === 'new') score *= 1.1;

    if (score > 0.1) {
      scored.push({ item, score: Math.min(score, 1), method: 'keyword' });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'also', 'that', 'this', 'these', 'those',
  'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my', 'your',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}
