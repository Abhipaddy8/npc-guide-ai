import { ParsedBrief, InferredStack } from '../types.js';

const STACK_SIGNALS: Record<string, Partial<InferredStack>> = {
  'react': { framework: 'React' },
  'next': { framework: 'Next.js' },
  'vue': { framework: 'Vue' },
  'svelte': { framework: 'SvelteKit' },
  'express': { framework: 'Express' },
  'fastify': { framework: 'Fastify' },
  'supabase': { database: 'Supabase (Postgres)', auth: 'Supabase Auth' },
  'postgres': { database: 'PostgreSQL' },
  'mongo': { database: 'MongoDB' },
  'sqlite': { database: 'SQLite' },
  'firebase': { database: 'Firebase', auth: 'Firebase Auth' },
  'tailwind': { styling: 'Tailwind CSS' },
  'typescript': { language: 'TypeScript' },
  'python': { language: 'Python' },
  'rust': { language: 'Rust' },
  'go': { language: 'Go' },
  'vercel': { deployment: 'Vercel' },
  'railway': { deployment: 'Railway' },
  'docker': { deployment: 'Docker' },
  'aws': { deployment: 'AWS' },
  'clerk': { auth: 'Clerk' },
  'auth0': { auth: 'Auth0' },
  'stripe': { extras: ['Stripe'] },
  'openai': { extras: ['OpenAI'] },
  'anthropic': { extras: ['Anthropic'] },
};

export function parseBrief(raw: string): ParsedBrief {
  const lower = raw.toLowerCase();
  const words = lower.split(/\s+/);

  const stack = inferStack(lower);
  const features = extractFeatures(raw);
  const complexity = inferComplexity(features, stack);
  const projectName = inferProjectName(raw);

  return {
    raw,
    projectName,
    description: raw.slice(0, 200),
    stack,
    complexity,
    features,
    constraints: extractConstraints(raw),
  };
}

function inferStack(text: string): InferredStack {
  const stack: InferredStack = {
    language: 'TypeScript',
    framework: null,
    database: null,
    auth: null,
    styling: null,
    deployment: null,
    extras: [],
  };

  for (const [signal, overrides] of Object.entries(STACK_SIGNALS)) {
    if (text.includes(signal)) {
      if (overrides.language) stack.language = overrides.language;
      if (overrides.framework) stack.framework = overrides.framework;
      if (overrides.database) stack.database = overrides.database;
      if (overrides.auth) stack.auth = overrides.auth;
      if (overrides.styling) stack.styling = overrides.styling;
      if (overrides.deployment) stack.deployment = overrides.deployment;
      if (overrides.extras) stack.extras.push(...overrides.extras);
    }
  }

  return stack;
}

function extractFeatures(text: string): string[] {
  const features: string[] = [];
  const featurePatterns = [
    /(?:build|create|make|add|implement|need|want)\s+(?:a\s+)?(.+?)(?:\.|,|$)/gi,
    /(?:should|must|needs to)\s+(.+?)(?:\.|,|$)/gi,
    /(?:with|including|plus)\s+(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of featurePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const feature = match[1].trim();
      if (feature.length > 3 && feature.length < 100) {
        features.push(feature);
      }
    }
  }

  return [...new Set(features)].slice(0, 15);
}

function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  const constraintPatterns = [
    /(?:don't|do not|no|avoid|never|without)\s+(.+?)(?:\.|,|$)/gi,
    /(?:must be|has to be|needs to be)\s+(.+?)(?:\.|,|$)/gi,
  ];

  for (const pattern of constraintPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      constraints.push(match[1].trim());
    }
  }

  return constraints.slice(0, 10);
}

function inferComplexity(features: string[], stack: InferredStack): 'simple' | 'moderate' | 'complex' {
  let score = features.length;
  if (stack.database) score += 2;
  if (stack.auth) score += 2;
  if (stack.extras.length > 1) score += 2;

  if (score <= 3) return 'simple';
  if (score <= 7) return 'moderate';
  return 'complex';
}

function inferProjectName(text: string): string {
  // Try to find a quoted name
  const quoted = text.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];

  // Try "called X" or "named X"
  const named = text.match(/(?:called|named)\s+(\S+)/i);
  if (named) return named[1];

  // Fall back to first few meaningful words
  const words = text.split(/\s+/).filter(w => w.length > 2).slice(0, 3);
  return words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'project';
}
