/**
 * Project Scanner — reads existing project files to understand what's already built.
 * No API calls. Pure filesystem reads.
 */

import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';
import { InferredStack } from '../types.js';

export interface ProjectScan {
  hasFiles: boolean;
  packageJson: any | null;
  stack: InferredStack;
  structure: string[];
  summary: string;
}

export async function scanProject(projectRoot: string): Promise<ProjectScan> {
  const scan: ProjectScan = {
    hasFiles: false,
    packageJson: null,
    stack: {
      language: '',
      framework: null,
      database: null,
      auth: null,
      styling: null,
      deployment: null,
      extras: [],
    },
    structure: [],
    summary: '',
  };

  // Read package.json
  try {
    const raw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
    scan.packageJson = JSON.parse(raw);
  } catch {
    scan.summary = 'Empty project (no package.json found)';
    return scan;
  }

  const allDeps = {
    ...(scan.packageJson.dependencies || {}),
    ...(scan.packageJson.devDependencies || {}),
  };

  // Detect language
  if (allDeps['typescript'] || await fileExists(join(projectRoot, 'tsconfig.json'))) {
    scan.stack.language = 'TypeScript';
  } else {
    scan.stack.language = 'JavaScript';
  }

  // Detect framework
  if (allDeps['next']) scan.stack.framework = `Next.js`;
  else if (allDeps['react'] && !allDeps['next']) scan.stack.framework = 'React';
  else if (allDeps['vue']) scan.stack.framework = 'Vue';
  else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) scan.stack.framework = 'SvelteKit';
  else if (allDeps['express']) scan.stack.framework = 'Express';
  else if (allDeps['fastify']) scan.stack.framework = 'Fastify';
  else if (allDeps['hono']) scan.stack.framework = 'Hono';

  // Detect database
  if (allDeps['@supabase/supabase-js']) scan.stack.database = 'Supabase (Postgres)';
  else if (allDeps['pg'] || allDeps['@prisma/client']) scan.stack.database = 'PostgreSQL';
  else if (allDeps['mongoose'] || allDeps['mongodb']) scan.stack.database = 'MongoDB';
  else if (allDeps['better-sqlite3'] || allDeps['sqlite3']) scan.stack.database = 'SQLite';
  else if (allDeps['firebase'] || allDeps['firebase-admin']) scan.stack.database = 'Firebase';
  else if (allDeps['drizzle-orm']) scan.stack.database = 'Drizzle ORM';

  // Detect auth
  if (allDeps['@clerk/nextjs'] || allDeps['@clerk/clerk-sdk-node']) scan.stack.auth = 'Clerk';
  else if (allDeps['next-auth']) scan.stack.auth = 'NextAuth';
  else if (allDeps['@auth0/nextjs-auth0'] || allDeps['auth0']) scan.stack.auth = 'Auth0';
  else if (allDeps['@supabase/supabase-js'] && !scan.stack.auth) scan.stack.auth = 'Supabase Auth';
  else if (allDeps['firebase']) scan.stack.auth = 'Firebase Auth';

  // Detect styling
  if (allDeps['tailwindcss']) scan.stack.styling = 'Tailwind CSS';
  else if (allDeps['styled-components']) scan.stack.styling = 'styled-components';
  else if (allDeps['@emotion/react']) scan.stack.styling = 'Emotion';

  // Detect extras
  if (allDeps['stripe'] || allDeps['@stripe/stripe-js']) scan.stack.extras.push('Stripe');
  if (allDeps['openai']) scan.stack.extras.push('OpenAI');
  if (allDeps['@anthropic-ai/sdk']) scan.stack.extras.push('Anthropic');
  if (allDeps['@modelcontextprotocol/sdk']) scan.stack.extras.push('MCP');
  if (allDeps['zod']) scan.stack.extras.push('Zod');
  if (allDeps['trpc'] || allDeps['@trpc/server']) scan.stack.extras.push('tRPC');

  // Detect deployment
  if (await fileExists(join(projectRoot, 'vercel.json'))) scan.stack.deployment = 'Vercel';
  else if (await fileExists(join(projectRoot, 'railway.json')) || await fileExists(join(projectRoot, 'railway.toml'))) scan.stack.deployment = 'Railway';
  else if (await fileExists(join(projectRoot, 'Dockerfile'))) scan.stack.deployment = 'Docker';

  // Scan folder structure
  scan.structure = await scanStructure(projectRoot);
  scan.hasFiles = scan.structure.length > 0;

  // Build summary
  scan.summary = buildSummary(scan);

  return scan;
}

async function scanStructure(root: string): Promise<string[]> {
  const found: string[] = [];
  const checks = [
    'src', 'src/app', 'src/pages', 'src/components', 'src/lib',
    'app', 'pages', 'components', 'lib', 'utils',
    'server', 'api', 'routes',
    'prisma', 'drizzle', 'migrations',
    'public', 'static', 'assets',
    'tests', '__tests__', 'test', 'spec',
    '.env', '.env.local', '.env.example',
    'middleware.ts', 'middleware.js',
  ];

  for (const check of checks) {
    if (await fileExists(join(root, check))) {
      found.push(check);
    }
  }

  // Count source files roughly
  try {
    const srcDir = await fileExists(join(root, 'src')) ? 'src' : (await fileExists(join(root, 'app')) ? 'app' : null);
    if (srcDir) {
      const count = await countFiles(join(root, srcDir));
      if (count > 0) found.push(`~${count} source files`);
    }
  } catch {}

  return found;
}

async function countFiles(dir: string, depth = 0): Promise<number> {
  if (depth > 3) return 0;
  let count = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isFile() && /\.(ts|tsx|js|jsx|vue|svelte)$/.test(entry.name)) {
        count++;
      } else if (entry.isDirectory()) {
        count += await countFiles(join(dir, entry.name), depth + 1);
      }
    }
  } catch {}
  return count;
}

function buildSummary(scan: ProjectScan): string {
  const parts: string[] = [];

  if (scan.stack.framework) parts.push(scan.stack.framework);
  else if (scan.stack.language) parts.push(scan.stack.language);

  if (scan.stack.database) parts.push(scan.stack.database);
  if (scan.stack.auth) parts.push(scan.stack.auth);
  if (scan.stack.styling) parts.push(scan.stack.styling);
  if (scan.stack.extras.length > 0) parts.push(scan.stack.extras.join(', '));

  if (parts.length === 0) {
    return scan.hasFiles ? 'Project with source files (stack not detected)' : 'Empty project';
  }

  return parts.join(' · ');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function formatScanOutput(scan: ProjectScan): string {
  const lines: string[] = [];
  lines.push('  Detected:');

  if (!scan.hasFiles && !scan.packageJson) {
    lines.push('  └── Empty project (package.json only)');
    return lines.join('\n');
  }

  const items: string[] = [];
  if (scan.stack.framework) items.push(scan.stack.framework);
  if (scan.stack.language && !scan.stack.framework) items.push(scan.stack.language);
  if (scan.stack.language && scan.stack.framework) items.push(scan.stack.language);
  if (scan.stack.database) items.push(scan.stack.database);
  if (scan.stack.auth) items.push(scan.stack.auth);
  if (scan.stack.styling) items.push(scan.stack.styling);
  for (const extra of scan.stack.extras) items.push(extra);
  if (scan.stack.deployment) items.push(`Deploy: ${scan.stack.deployment}`);

  // Show structure highlights
  const structureHighlights = scan.structure.filter(s => !s.startsWith('.') && !s.startsWith('~'));
  const fileCount = scan.structure.find(s => s.startsWith('~'));

  for (let i = 0; i < items.length; i++) {
    const prefix = i < items.length - 1 || structureHighlights.length > 0 || fileCount ? '├──' : '└──';
    lines.push(`  ${prefix} ${items[i]}`);
  }

  if (fileCount) {
    const prefix = structureHighlights.length > 0 ? '├──' : '└──';
    lines.push(`  ${prefix} ${fileCount}`);
  }

  if (structureHighlights.length > 0) {
    const key = structureHighlights.slice(0, 5);
    lines.push(`  └── Folders: ${key.join(', ')}`);
  }

  return lines.join('\n');
}
