/**
 * Memory Retriever — TF-IDF vectors + cosine similarity. Pure math. No API.
 *
 * 1. Tokenize query + all memories
 * 2. Build vocabulary from all documents
 * 3. Compute TF-IDF vectors for each document
 * 4. Cosine similarity between query vector and each memory vector
 * 5. Return top N ranked by score
 */

import { MemoryItem } from '../types.js';

export interface RetrievalResult {
  item: MemoryItem;
  score: number;
}

/**
 * Retrieve memories relevant to a query using TF-IDF cosine similarity.
 * Zero API calls. Runs locally, instantly.
 */
export function retrieveRelevantMemories(
  query: string,
  items: MemoryItem[],
  topN: number = 10,
  threshold: number = 0.05
): RetrievalResult[] {
  if (items.length === 0) return [];

  // Tokenize everything
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const docTokens = items.map(item => tokenize(item.content));

  // Build vocabulary (all unique tokens across query + all docs)
  const vocab = new Set<string>();
  queryTokens.forEach(t => vocab.add(t));
  docTokens.forEach(tokens => tokens.forEach(t => vocab.add(t)));
  const vocabList = [...vocab];
  const vocabIndex = new Map(vocabList.map((w, i) => [w, i]));

  // Compute IDF: log(N / df) where df = number of docs containing the term
  const N = items.length + 1; // +1 for query as a document
  const df = new Map<string, number>();
  for (const word of vocabList) {
    let count = 0;
    if (queryTokens.includes(word)) count++;
    for (const tokens of docTokens) {
      if (tokens.includes(word)) count++;
    }
    df.set(word, count);
  }

  const idf = new Map<string, number>();
  for (const word of vocabList) {
    idf.set(word, Math.log((N + 1) / ((df.get(word) || 0) + 1)) + 1); // smoothed IDF
  }

  // Build TF-IDF vector for a token list
  function toVector(tokens: string[]): number[] {
    const vec = new Array(vocabList.length).fill(0);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [word, count] of tf) {
      const idx = vocabIndex.get(word);
      if (idx !== undefined) {
        vec[idx] = (count / tokens.length) * (idf.get(word) || 1);
      }
    }
    return vec;
  }

  const queryVec = toVector(queryTokens);

  // Score each memory
  const scored: RetrievalResult[] = [];

  for (let i = 0; i < items.length; i++) {
    if (docTokens[i].length === 0) continue;

    const docVec = toVector(docTokens[i]);
    let score = cosineSimilarity(queryVec, docVec);

    // Category boost
    const ql = query.toLowerCase();
    if (ql.includes('decision') && items[i].category === 'decision') score *= 1.2;
    if (ql.includes('architect') && items[i].category === 'architecture') score *= 1.2;
    if (ql.includes('mission') && items[i].category === 'progress') score *= 1.2;

    if (score > threshold) {
      scored.push({ item: items[i], score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Cosine similarity between two vectors. Pure math.
 */
function cosineSimilarity(a: number[], b: number[]): number {
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
