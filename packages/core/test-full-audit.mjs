#!/usr/bin/env node

/**
 * NPC Guide — Full Feature Audit
 * Tests every claimed feature against a real project setup.
 * Run: node test-full-audit.mjs
 */

import { readFile, writeFile, mkdir, rm, access } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const TEST_DIR = '/tmp/npc-audit-project';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const DIM = '\x1b[90m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${name}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${name} ${DIM}${detail}${RESET}`);
    failed++;
    failures.push({ name, detail });
  }
}

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function readText(path) {
  return readFile(path, 'utf-8');
}

// ============================================================
// SETUP — Create a realistic project
// ============================================================

console.log(`\n${BOLD}Setting up test project...${RESET}\n`);

await rm(TEST_DIR, { recursive: true, force: true });
await mkdir(TEST_DIR, { recursive: true });

// Simulate a real Next.js + Supabase + Tailwind project
await writeFile(join(TEST_DIR, 'package.json'), JSON.stringify({
  name: 'test-saas-app',
  version: '1.0.0',
  type: 'module',
  dependencies: {
    next: '^14.0.0',
    react: '^18.0.0',
    '@supabase/supabase-js': '^2.0.0',
    '@clerk/nextjs': '^5.0.0',
    stripe: '^14.0.0',
    zod: '^3.22.0',
  },
  devDependencies: {
    typescript: '^5.4.0',
    tailwindcss: '^3.4.0',
  },
}, null, 2));

// Create project structure
await mkdir(join(TEST_DIR, 'src', 'app', 'dashboard'), { recursive: true });
await mkdir(join(TEST_DIR, 'src', 'components'), { recursive: true });
await mkdir(join(TEST_DIR, 'src', 'lib'), { recursive: true });
await mkdir(join(TEST_DIR, 'prisma'), { recursive: true });
await writeFile(join(TEST_DIR, 'tsconfig.json'), '{}');
await writeFile(join(TEST_DIR, 'vercel.json'), '{}');
await writeFile(join(TEST_DIR, 'src', 'app', 'page.tsx'), 'export default function Home() {}');
await writeFile(join(TEST_DIR, 'src', 'app', 'dashboard', 'page.tsx'), 'export default function Dash() {}');
await writeFile(join(TEST_DIR, 'src', 'components', 'Sidebar.tsx'), 'export function Sidebar() {}');
await writeFile(join(TEST_DIR, 'src', 'lib', 'supabase.ts'), 'export const supabase = null;');
await writeFile(join(TEST_DIR, 'middleware.ts'), 'export function middleware() {}');

console.log(`  Project: ${TEST_DIR}`);
console.log(`  Stack: Next.js + Supabase + Clerk + Tailwind + Stripe + Zod`);
console.log(`  Files: 4 source files, prisma/, vercel.json, middleware.ts\n`);

// ============================================================
// INSTALL — Test postinstall
// ============================================================

console.log(`${BOLD}═══ PHASE 1: POSTINSTALL (npm install) ═══${RESET}\n`);

const corePath = '/Users/equipp/npc-guide-ai/packages/core';
execSync(`cd ${TEST_DIR} && npm install ${corePath} --save 2>&1`, { encoding: 'utf-8' });

// Test 1: .ai-guide/ folder structure
assert('1. .ai-guide/ created', await fileExists(join(TEST_DIR, '.ai-guide')));
assert('1a. sessions/ created', await fileExists(join(TEST_DIR, '.ai-guide', 'sessions')));
assert('1b. sessions/archive/ created', await fileExists(join(TEST_DIR, '.ai-guide', 'sessions', 'archive')));
assert('1c. memory/ created', await fileExists(join(TEST_DIR, '.ai-guide', 'memory')));

// Test 2: memory-table.json initialized empty
const memTable = await readJson(join(TEST_DIR, '.ai-guide', 'memory', 'memory-table.json'));
assert('2. memory-table.json exists', !!memTable);
assert('2a. memory-table version = 1', memTable.version === 1);
assert('2b. memory-table items seeded from scan', Array.isArray(memTable.items) && memTable.items.length > 0,
  `Got ${memTable.items.length} items`);
assert('2c. memory-table windowSize = 15', memTable.windowSize === 15);

// Test 3: Claude Code hooks
assert('3. .claude/ created', await fileExists(join(TEST_DIR, '.claude')));
const settings = await readJson(join(TEST_DIR, '.claude', 'settings.json'));
assert('3a. settings.json has hooks', !!settings.hooks);
assert('3b. SessionStart hook exists', Array.isArray(settings.hooks?.SessionStart) && settings.hooks.SessionStart.length > 0);
assert('3c. SessionEnd hook exists', Array.isArray(settings.hooks?.SessionEnd) && settings.hooks.SessionEnd.length > 0);
const startCmd = settings.hooks?.SessionStart?.[0]?.hooks?.[0]?.command || '';
assert('3d. SessionStart points to npc-guide', startCmd.includes('npc-guide') && startCmd.includes('session-start.js'),
  `Got: ${startCmd}`);
const endCmd = settings.hooks?.SessionEnd?.[0]?.hooks?.[0]?.command || '';
assert('3e. SessionEnd points to npc-guide', endCmd.includes('npc-guide') && endCmd.includes('session-end.js'),
  `Got: ${endCmd}`);

// Test 4: .cursorrules
const cursorRules = await readText(join(TEST_DIR, '.cursorrules'));
assert('4. .cursorrules created', cursorRules.length > 0);
assert('4a. Contains NPC Guide reference', cursorRules.includes('NPC Guide'));
assert('4b. References missions.md', cursorRules.includes('missions.md'));
assert('4c. References architecture.md', cursorRules.includes('architecture.md'));

// Test 5: CLAUDE.md
const claudeMd = await readText(join(TEST_DIR, 'CLAUDE.md'));
assert('5. CLAUDE.md created', claudeMd.length > 0);
assert('5a. Contains mission instructions', claudeMd.includes('ACTIVE mission'));
assert('5b. Contains CRITICAL RULES', claudeMd.includes('CRITICAL RULES'));
assert('5c. References decisions.md', claudeMd.includes('decisions.md'));

// Test 6: .gitignore
const gitignore = await readText(join(TEST_DIR, '.gitignore'));
assert('6. .gitignore updated', gitignore.includes('.ai-guide/sessions'));

// Test 7: Zero dependencies
const installedPkg = await readJson(join(TEST_DIR, 'node_modules', 'npc-guide', 'package.json'));
assert('7. Zero runtime dependencies', Object.keys(installedPkg.dependencies || {}).length === 0);

// Test 8: No missions yet (postinstall should NOT generate missions)
assert('8. No missions.md yet (postinstall only)', !(await fileExists(join(TEST_DIR, '.ai-guide', 'missions.md'))));
assert('8a. No architecture.md yet', !(await fileExists(join(TEST_DIR, '.ai-guide', 'architecture.md'))));

// Test 8b: Memory SEEDED by postinstall scanner
const memPostInstall = await readJson(join(TEST_DIR, '.ai-guide', 'memory', 'memory-table.json'));
assert('8b. Memory seeded by postinstall (not empty)', memPostInstall.items.length > 0,
  `Got ${memPostInstall.items.length} items`);
assert('8c. Memory has Framework entry', memPostInstall.items.some(m => m.content.includes('Framework: Next.js')),
  `Items: ${memPostInstall.items.map(m => m.content).join(' | ')}`);
assert('8d. Memory has Database entry', memPostInstall.items.some(m => m.content.includes('Database: Supabase')));
assert('8e. Memory has Auth entry', memPostInstall.items.some(m => m.content.includes('Auth: Clerk')));
assert('8f. Memory has Styling entry', memPostInstall.items.some(m => m.content.includes('Styling: Tailwind')));
assert('8g. Memory has Stripe entry', memPostInstall.items.some(m => m.content.includes('Integration: Stripe')));
assert('8h. Memory has Zod entry', memPostInstall.items.some(m => m.content.includes('Integration: Zod')));
assert('8i. Memory has Deployment entry', memPostInstall.items.some(m => m.content.includes('Deployment: Vercel')));
assert('8j. Memory has structure entry', memPostInstall.items.some(m => m.content.includes('Project structure')));
assert('8k. All entries are architecture or context', memPostInstall.items.every(m => m.category === 'architecture' || m.category === 'context'));

console.log('');

// ============================================================
// INIT — Test project scanner + brief → missions
// ============================================================

console.log(`${BOLD}═══ PHASE 2: INIT (npx npc-guide init) ═══${RESET}\n`);

const initOutput = execSync(
  `cd ${TEST_DIR} && echo "Build a SaaS dashboard with team billing and usage analytics" | node node_modules/npc-guide/dist/hooks/init.js 2>&1`,
  { encoding: 'utf-8' }
);

// Test 9: Scanner detects stack
assert('9. Scanner ran', initOutput.includes('Detected'));
assert('9a. Detected Next.js', initOutput.includes('Next.js'));
assert('9b. Detected TypeScript', initOutput.includes('TypeScript'));
assert('9c. Detected Supabase', initOutput.includes('Supabase'));

// Test 10: Init generates missions
assert('10. Missions generated', initOutput.includes('missions'));
assert('10a. Mission 1 active (▶)', initOutput.includes('▶'));

// Test 11: architecture.md written
const arch = await readText(join(TEST_DIR, '.ai-guide', 'architecture.md'));
assert('11. architecture.md created', arch.length > 0);
assert('11a. Contains project name', arch.includes('Project'));
assert('11b. Contains framework', arch.includes('Next.js'));
assert('11c. Contains database', arch.includes('Supabase'));
assert('11d. Contains auth', arch.includes('Clerk'));
assert('11e. Contains styling', arch.includes('Tailwind'));

// Test 12: missions.md written
const missions = await readText(join(TEST_DIR, '.ai-guide', 'missions.md'));
assert('12. missions.md created', missions.length > 0);
assert('12a. Has active mission (▶️)', missions.includes('▶️'));
assert('12b. Has locked missions (🔒)', missions.includes('🔒'));
assert('12c. Mission 1 is Foundation', missions.includes('Foundation'));

// Test 13: Memory seeded with atomic entries (not one blob)
const memAfterInit = await readJson(join(TEST_DIR, '.ai-guide', 'memory', 'memory-table.json'));
assert('13. Memory has multiple entries after init', memAfterInit.items.length >= 5,
  `Got ${memAfterInit.items.length} items`);
assert('13a. Has project identity entry', memAfterInit.items.some(m => m.content.includes('Project:') && m.content.includes('Intent:')));
assert('13b. Has Framework entry', memAfterInit.items.some(m => m.content === 'Framework: Next.js'));
assert('13c. Has Database entry', memAfterInit.items.some(m => m.content.includes('Database: Supabase')));
assert('13d. Has Auth entry', memAfterInit.items.some(m => m.content.includes('Auth: Clerk')));
assert('13e. Has structure context', memAfterInit.items.some(m => m.content.includes('Project structure')));
assert('13f. No single blob entry', !memAfterInit.items.some(m => m.content.length > 150),
  `Longest: ${Math.max(...memAfterInit.items.map(m => m.content.length))} chars`);

// Test 13g: TF-IDF can now isolate individual facts
const { retrieveRelevantMemories: initRetriever } = await import(join(corePath, 'dist', 'memory', 'retriever.js'));
const initR1 = initRetriever('what auth provider are we using', memAfterInit.items, 1, 0.01);
assert('13g. TF-IDF on init memory: "auth" → hits Auth entry', initR1[0]?.item.content.includes('Auth:'),
  `Got: ${initR1[0]?.item.content} (score: ${initR1[0]?.score?.toFixed(3)})`);
const initR2 = initRetriever('database setup', memAfterInit.items, 1, 0.01);
assert('13h. TF-IDF on init memory: "database" → hits Database entry', initR2[0]?.item.content.includes('Database:'),
  `Got: ${initR2[0]?.item.content} (score: ${initR2[0]?.score?.toFixed(3)})`);

console.log('');

// ============================================================
// PHASE 3: SCANNER DEEP TEST
// ============================================================

console.log(`${BOLD}═══ PHASE 3: PROJECT SCANNER (dep detection) ═══${RESET}\n`);

// We test by importing the module directly
const { scanProject } = await import(join(corePath, 'dist', 'project-scanner', 'index.js'));
const scan = await scanProject(TEST_DIR);

assert('14. Scanner detects hasFiles', scan.hasFiles === true);
assert('14a. Language = TypeScript', scan.stack.language === 'TypeScript');
assert('14b. Framework = Next.js', scan.stack.framework === 'Next.js');
assert('14c. Database = Supabase', scan.stack.database === 'Supabase (Postgres)',
  `Got: ${scan.stack.database}`);
assert('14d. Auth = Clerk', scan.stack.auth === 'Clerk',
  `Got: ${scan.stack.auth}`);
assert('14e. Styling = Tailwind CSS', scan.stack.styling === 'Tailwind CSS',
  `Got: ${scan.stack.styling}`);
assert('14f. Deployment = Vercel', scan.stack.deployment === 'Vercel',
  `Got: ${scan.stack.deployment}`);
assert('14g. Extras include Stripe', scan.stack.extras.includes('Stripe'),
  `Got: ${scan.stack.extras}`);
assert('14h. Extras include Zod', scan.stack.extras.includes('Zod'),
  `Got: ${scan.stack.extras}`);
assert('14i. Structure includes src', scan.structure.includes('src'));
assert('14j. Structure includes prisma', scan.structure.includes('prisma'));
assert('14k. Structure includes middleware.ts', scan.structure.includes('middleware.ts'));
assert('14l. Structure has file count', scan.structure.some(s => s.startsWith('~')),
  `Got: ${scan.structure}`);
assert('14m. Summary includes stack info', scan.summary.length > 0, `Got: ${scan.summary}`);

console.log('');

// ============================================================
// PHASE 4: BRIEF PARSER
// ============================================================

console.log(`${BOLD}═══ PHASE 4: BRIEF PARSER (intent + stack + features) ═══${RESET}\n`);

const { parseBrief } = await import(join(corePath, 'dist', 'brief-parser', 'index.js'));

// Intent detection
const buildBrief = parseBrief('Build a real-time collaborative editor with React and Supabase');
assert('15. Build intent detected', buildBrief.intent === 'build', `Got: ${buildBrief.intent}`);

const stratBrief = parseBrief('Create a growth strategy for our SaaS with viral acquisition and retention hooks');
assert('15a. Strategy intent detected', stratBrief.intent === 'strategy', `Got: ${stratBrief.intent}`);

const researchBrief = parseBrief('Research and compare the best database options for our use case');
assert('15b. Research intent detected', researchBrief.intent === 'research', `Got: ${researchBrief.intent}`);

const designBrief = parseBrief('Design the system architecture and API design for our microservices');
assert('15c. Design intent detected', designBrief.intent === 'design', `Got: ${designBrief.intent}`);

const contentBrief = parseBrief('Write a blog post and documentation for the new API');
assert('15d. Content intent detected', contentBrief.intent === 'content', `Got: ${contentBrief.intent}`);

const opsBrief = parseBrief('Set up CI/CD pipeline and deploy to Kubernetes with monitoring');
assert('15e. Ops intent detected', opsBrief.intent === 'ops', `Got: ${opsBrief.intent}`);

const debugBrief = parseBrief('Fix the bug where login redirects to 404 and crashes');
assert('15f. Debug intent detected', debugBrief.intent === 'debug', `Got: ${debugBrief.intent}`);

// Stack inference
assert('16. Stack: React detected', buildBrief.stack.framework === 'React', `Got: ${buildBrief.stack.framework}`);
assert('16a. Stack: Supabase DB detected', buildBrief.stack.database === 'Supabase (Postgres)', `Got: ${buildBrief.stack.database}`);
assert('16b. Stack: Supabase Auth inferred', buildBrief.stack.auth === 'Supabase Auth', `Got: ${buildBrief.stack.auth}`);

const nextBrief = parseBrief('Build an app with Next.js and PostgreSQL using Clerk auth and Tailwind');
assert('16c. Next.js detected', nextBrief.stack.framework === 'Next.js', `Got: ${nextBrief.stack.framework}`);
assert('16d. PostgreSQL detected', nextBrief.stack.database === 'PostgreSQL', `Got: ${nextBrief.stack.database}`);
assert('16e. Clerk detected', nextBrief.stack.auth === 'Clerk', `Got: ${nextBrief.stack.auth}`);
assert('16f. Tailwind detected', nextBrief.stack.styling === 'Tailwind CSS', `Got: ${nextBrief.stack.styling}`);

// Features + constraints
const featureBrief = parseBrief('Build a dashboard with real-time notifications, including team management. Must be accessible. Do not use MongoDB.');
assert('17. Features extracted', featureBrief.features.length > 0, `Got ${featureBrief.features.length}`);
assert('17a. Constraints extracted', featureBrief.constraints.length > 0, `Got ${featureBrief.constraints.length}`);

// Complexity
const simpleBrief = parseBrief('Build a landing page');
assert('18. Simple complexity', simpleBrief.complexity === 'simple', `Got: ${simpleBrief.complexity}`);

const complexBrief = parseBrief('Build a SaaS with Supabase auth, Stripe billing, real-time sync, team management, role-based access, API integrations, and analytics');
assert('18a. Complex complexity', complexBrief.complexity === 'complex', `Got: ${complexBrief.complexity}`);

// Project name inference
const namedBrief = parseBrief('Build an app called "TaskFlow" with React');
assert('19. Project name from quotes', namedBrief.projectName === 'TaskFlow', `Got: ${namedBrief.projectName}`);

const namedBrief2 = parseBrief('Create a tool named SuperDash for analytics');
assert('19a. Project name from "named"', namedBrief2.projectName === 'SuperDash', `Got: ${namedBrief2.projectName}`);

console.log('');

// ============================================================
// PHASE 5: MISSION ARCHITECT
// ============================================================

console.log(`${BOLD}═══ PHASE 5: MISSION ARCHITECT (7 intent types) ═══${RESET}\n`);

const { buildMissionMap, advanceMission, skipMission, getCurrentMission } = await import(
  join(corePath, 'dist', 'mission-architect', 'index.js')
);

// Build missions — full stack
const fullBrief = parseBrief('Build a SaaS with React and Supabase using Clerk auth');
const fullMap = buildMissionMap(fullBrief);
assert('20. Build: generates missions', fullMap.missions.length >= 5);
assert('20a. Build: first is Foundation', fullMap.missions[0].type === 'scaffold');
assert('20b. Build: has Data Layer (Supabase detected)', fullMap.missions.some(m => m.type === 'data-layer'));
assert('20c. Build: has Auth (Clerk detected)', fullMap.missions.some(m => m.type === 'auth'));
assert('20d. Build: has UI Shell (React = frontend)', fullMap.missions.some(m => m.type === 'ui'));
assert('20e. Build: last is Ship', fullMap.missions[fullMap.missions.length - 1].type === 'ship');
assert('20f. Build: Mission 1 is active', fullMap.missions[0].status === 'active');
assert('20g. Build: Mission 2+ are locked', fullMap.missions[1].status === 'locked');

// Build missions — minimal (no DB, no auth)
const minBrief = parseBrief('Build a CLI tool with Node.js');
const minMap = buildMissionMap(minBrief);
assert('21. Minimal build: no Data Layer', !minMap.missions.some(m => m.type === 'data-layer'));
assert('21a. Minimal build: no Auth', !minMap.missions.some(m => m.type === 'auth'));

// Build missions — backend only (Express)
const backendBrief = parseBrief('Build an API server with Express and PostgreSQL');
const backendMap = buildMissionMap(backendBrief);
assert('22. Backend: no UI Shell (Express)', !backendMap.missions.some(m => m.type === 'ui'));
assert('22a. Backend: has Data Layer', backendMap.missions.some(m => m.type === 'data-layer'));

// Strategy missions
const stratMap = buildMissionMap(stratBrief);
assert('23. Strategy: has Landscape', stratMap.missions.some(m => m.type === 'landscape'));
assert('23a. Strategy: has Positioning', stratMap.missions.some(m => m.type === 'positioning'));
assert('23b. Strategy: has Growth Engine', stratMap.missions.some(m => m.type === 'growth-engine'));
assert('23c. Strategy: has Launch Plan', stratMap.missions.some(m => m.type === 'launch-plan'));

// Research missions
const resMap = buildMissionMap(researchBrief);
assert('24. Research: has Define Scope', resMap.missions.some(m => m.type === 'define-scope'));
assert('24a. Research: has Gather', resMap.missions.some(m => m.type === 'gather'));
assert('24b. Research: has Analyze', resMap.missions.some(m => m.type === 'analyze'));
assert('24c. Research: has Recommend', resMap.missions.some(m => m.type === 'recommend'));

// Debug missions
const debugMap = buildMissionMap(debugBrief);
assert('25. Debug: has Reproduce', debugMap.missions.some(m => m.type === 'reproduce'));
assert('25a. Debug: has Isolate', debugMap.missions.some(m => m.type === 'isolate'));
assert('25b. Debug: has Fix', debugMap.missions.some(m => m.type === 'fix'));
assert('25c. Debug: has Verify', debugMap.missions.some(m => m.type === 'verify-fix'));

// Mission advance
const advancedMap = advanceMission({ ...fullMap, missions: fullMap.missions.map(m => ({ ...m })) });
assert('26. Advance: Mission 1 → complete', advancedMap.missions[0].status === 'complete');
assert('26a. Advance: Mission 2 → active', advancedMap.missions[1].status === 'active');
assert('26b. Advance: currentMission = 2', advancedMap.currentMission === 2);

// getCurrentMission
const current = getCurrentMission(fullMap);
assert('27. getCurrentMission returns active', current?.status === 'active');
assert('27a. getCurrentMission returns Mission 1', current?.id === 1);

// Skip mission
const skippedMap = skipMission({ ...fullMap, missions: fullMap.missions.map(m => ({ ...m })) }, 2);
assert('28. Skip: Mission 2 → skipped', skippedMap.missions[1].status === 'skipped');

console.log('');

// ============================================================
// PHASE 6: MEMORY SYSTEM
// ============================================================

console.log(`${BOLD}═══ PHASE 6: MEMORY SYSTEM (lifecycle + sync + retrieval) ═══${RESET}\n`);

const { MemorySystem } = await import(join(corePath, 'dist', 'memory', 'index.js'));

const memDir = join(TEST_DIR, '.ai-guide-mem-test');
const mem = new MemorySystem({ projectRoot: TEST_DIR, guideDir: '.ai-guide-mem-test', maxMissions: 8, memoryWindowSize: 3 });
await mem.init();

// Add memories
const m1 = await mem.addMemory('Using Supabase singleton pattern for DB access', 'decision');
const m2 = await mem.addMemory('Project uses Next.js App Router with server components', 'architecture');
const m3 = await mem.addMemory('Completed auth integration with Clerk middleware', 'progress');
const m4 = await mem.addMemory('Dashboard sidebar uses shadcn/ui components', 'context');

assert('29. Memory: 4 items added', mem.getAll().length === 4);
assert('29a. Memory: item has UUID id', m1.id.length === 36);
assert('29b. Memory: item status = new', m1.status === 'new');
assert('29c. Memory: item has createdAt', !!m1.createdAt);
assert('29d. Memory: cosine hits = 0', m1.cosineSimilarityHits === 0);

// Persistence
const mem2 = new MemorySystem({ projectRoot: TEST_DIR, guideDir: '.ai-guide-mem-test', maxMissions: 8, memoryWindowSize: 3 });
await mem2.init();
assert('30. Memory persists across instances', mem2.getAll().length === 4);

// Categories
assert('31. getByCategory works', mem.getByCategory('decision').length === 1);
assert('31a. getActive returns non-archived', mem.getActive().length === 4);

// Record hit
await mem.recordHit(m1.id);
const hitItem = mem.getAll().find(m => m.id === m1.id);
assert('32. recordHit increments cosineHits', hitItem.cosineSimilarityHits === 1);
assert('32a. recordHit promotes to active', hitItem.status === 'active');
assert('32b. recordHit sets lastHitAt', !!hitItem.lastHitAt);
assert('32c. recordHit resets sessionsActive to 0', hitItem.sessionsActive === 0);

// Tick session + lifecycle
await mem.tickSession();
const afterTick1 = mem.getAll().find(m => m.id === m2.id);
assert('33. tickSession increments sessionsActive', afterTick1.sessionsActive === 1);

await mem.tickSession();
await mem.tickSession(); // Now at windowSize (3) for items without hits

const afterTick3 = mem.getAll().find(m => m.id === m2.id);
assert('34. Memory archived after windowSize with 0 hits', afterTick3.status === 'archived',
  `Got: status=${afterTick3.status}, sessions=${afterTick3.sessionsActive}, hits=${afterTick3.cosineSimilarityHits}`);

// m1 had a hit → should be demoting, not archived
const m1After = mem.getAll().find(m => m.id === m1.id);
assert('34a. Memory with hits → demoting (not archived)', m1After.status === 'demoting',
  `Got: status=${m1After.status}, sessions=${m1After.sessionsActive}, hits=${m1After.cosineSimilarityHits}`);

// TF-IDF cosine similarity retrieval
const { retrieveRelevantMemories } = await import(join(corePath, 'dist', 'memory', 'retriever.js'));

const searchItems = [
  { id: '1', content: 'Using Supabase singleton pattern for database access layer', category: 'decision', sessionsActive: 1, cosineSimilarityHits: 2, status: 'active', createdAt: new Date().toISOString(), lastHitAt: null },
  { id: '2', content: 'Next.js App Router with server components and streaming', category: 'architecture', sessionsActive: 1, cosineSimilarityHits: 0, status: 'active', createdAt: new Date().toISOString(), lastHitAt: null },
  { id: '3', content: 'Clerk middleware handles auth redirect for protected routes', category: 'decision', sessionsActive: 1, cosineSimilarityHits: 1, status: 'active', createdAt: new Date().toISOString(), lastHitAt: null },
  { id: '4', content: 'Stripe integration uses webhooks for subscription billing', category: 'architecture', sessionsActive: 1, cosineSimilarityHits: 0, status: 'active', createdAt: new Date().toISOString(), lastHitAt: null },
  { id: '5', content: 'Dashboard sidebar uses shadcn/ui navigation components', category: 'context', sessionsActive: 1, cosineSimilarityHits: 0, status: 'active', createdAt: new Date().toISOString(), lastHitAt: null },
];

const r1 = retrieveRelevantMemories('Supabase database query', searchItems, 3, 0.01);
assert('35. TF-IDF: "Supabase database" → top hit is Supabase', r1[0]?.item.id === '1',
  `Got: ${r1[0]?.item.content?.substring(0, 40)}`);
assert('35a. TF-IDF: returns score > 0', r1[0]?.score > 0, `Score: ${r1[0]?.score}`);

const r2 = retrieveRelevantMemories('Clerk auth middleware setup', searchItems, 3, 0.01);
assert('36. TF-IDF: "Clerk auth middleware" → top hit is Clerk', r2[0]?.item.id === '3',
  `Got: ${r2[0]?.item.content?.substring(0, 40)}`);

const r3 = retrieveRelevantMemories('Stripe billing webhook', searchItems, 3, 0.01);
assert('37. TF-IDF: "Stripe billing" → top hit is Stripe', r3[0]?.item.id === '4',
  `Got: ${r3[0]?.item.content?.substring(0, 40)}`);

const r4 = retrieveRelevantMemories('sidebar navigation UI', searchItems, 3, 0.01);
assert('38. TF-IDF: "sidebar navigation" → top hit is sidebar', r4[0]?.item.id === '5',
  `Got: ${r4[0]?.item.content?.substring(0, 40)}`);

const r5 = retrieveRelevantMemories('Next.js server components streaming', searchItems, 3, 0.01);
assert('39. TF-IDF: "Next.js server components" → top hit is Next.js', r5[0]?.item.id === '2',
  `Got: ${r5[0]?.item.content?.substring(0, 40)}`);

// Empty query
const r6 = retrieveRelevantMemories('', searchItems, 3, 0.01);
assert('40. TF-IDF: empty query → 0 results', r6.length === 0);

// No items
const r7 = retrieveRelevantMemories('test query', [], 3, 0.01);
assert('40a. TF-IDF: empty items → 0 results', r7.length === 0);

// SyncFromDocs
console.log('');
console.log(`${BOLD}  ── syncFromDocs ──${RESET}`);

const syncMem = new MemorySystem({ projectRoot: TEST_DIR, guideDir: '.ai-guide-sync-test', maxMissions: 8, memoryWindowSize: 15 });
const syncGuideDir = join(TEST_DIR, '.ai-guide-sync-test');
await mkdir(syncGuideDir, { recursive: true });
await syncMem.init();

// Write decisions.md in DocWriter format
await writeFile(join(syncGuideDir, 'decisions.md'), `# Decisions

### 2026-03-09T10:00:00
**Decision**: Use Supabase for database
**Reason**: Real-time subscriptions needed

### 2026-03-09T11:00:00
**Decision**: Clerk for auth
**Reason**: Best Next.js integration
`);

// Write missions.md with completed missions
await writeFile(join(syncGuideDir, 'missions.md'), `# Mission Map
- ✅ **1 — Foundation** — Scaffold project
- ▶️ **2 — Core Loop** — Build main feature
- 🔒 **3 — Data Layer** — Set up database
`);

const synced = await syncMem.syncFromDocs(syncGuideDir);
assert('41. syncFromDocs: parsed decisions + missions', synced >= 3, `Synced: ${synced}`);
assert('41a. syncFromDocs: has Supabase decision', syncMem.getAll().some(m => m.content.includes('Supabase')));
assert('41b. syncFromDocs: has Clerk decision', syncMem.getAll().some(m => m.content.includes('Clerk')));
assert('41c. syncFromDocs: has completed mission', syncMem.getAll().some(m => m.content.includes('Foundation')));

// Dedup — running again should add 0
const synced2 = await syncMem.syncFromDocs(syncGuideDir);
assert('42. syncFromDocs: dedup works (0 new on re-run)', synced2 === 0, `Got: ${synced2}`);

console.log('');

// ============================================================
// PHASE 7: DOC WRITER
// ============================================================

console.log(`${BOLD}═══ PHASE 7: DOC WRITER ═══${RESET}\n`);

const { DocWriter } = await import(join(corePath, 'dist', 'memory', 'doc-writer.js'));
const docDir = join(TEST_DIR, '.ai-guide-doc-test');
const docs = new DocWriter({ projectRoot: TEST_DIR, guideDir: '.ai-guide-doc-test', maxMissions: 8, memoryWindowSize: 15 });
await docs.init();

// Write architecture
await docs.writeArchitecture(fullBrief);
const archDoc = await readText(join(docDir, 'architecture.md'));
assert('43. DocWriter: architecture.md written', archDoc.includes('Architecture'));
assert('43a. Architecture has project name', archDoc.includes('Project'));
assert('43b. Architecture has language', archDoc.includes('TypeScript'));
assert('43c. Architecture has framework', archDoc.includes('React'));

// Write missions
await docs.writeMissionMap(fullMap);
const missionsDoc = await readText(join(docDir, 'missions.md'));
assert('44. DocWriter: missions.md written', missionsDoc.includes('Mission Map'));
assert('44a. Missions has ▶️ active', missionsDoc.includes('▶️'));
assert('44b. Missions has 🔒 locked', missionsDoc.includes('🔒'));

// Append decision
await docs.appendDecision('Use Redis for caching', 'Latency requirements');
const decisionsDoc = await readText(join(docDir, 'decisions.md'));
assert('45. DocWriter: decisions.md written', decisionsDoc.includes('Redis'));
assert('45a. Decision has reason', decisionsDoc.includes('Latency'));

// Append another — should not overwrite
await docs.appendDecision('Use tRPC for type safety', 'End-to-end types');
const decisionsDoc2 = await readText(join(docDir, 'decisions.md'));
assert('46. DocWriter: appends (not overwrites)', decisionsDoc2.includes('Redis') && decisionsDoc2.includes('tRPC'));

console.log('');

// ============================================================
// PHASE 8: AGENT INSTRUCTOR
// ============================================================

console.log(`${BOLD}═══ PHASE 8: AGENT INSTRUCTOR ═══${RESET}\n`);

const { generateInstruction, formatInstructionForAgent } = await import(
  join(corePath, 'dist', 'agent-instructor', 'index.js')
);

const instruction = generateInstruction(fullMap.missions[0], fullBrief, 'Previous session: set up project');
assert('47. Instruction generated', !!instruction);
assert('47a. Instruction has role=guide', instruction.role === 'guide');
assert('47b. Instruction has missionId', instruction.missionId === 1);
assert('47c. Instruction has directive', instruction.directive.includes('Foundation'));
assert('47d. Instruction has context', instruction.context.includes('Previous session'));
assert('47e. Instruction has constraints', instruction.constraints.length > 0);
assert('47f. Constraints include stack', instruction.constraints.some(c => c.includes('React')));

const formatted = formatInstructionForAgent(instruction);
assert('48. Formatted output is string', typeof formatted === 'string');
assert('48a. Formatted has mission header', formatted.includes('NPC GUIDE'));
assert('48b. Formatted has context section', formatted.includes('Context from Memory'));
assert('48c. Formatted has constraints section', formatted.includes('Constraints'));

console.log('');

// ============================================================
// PHASE 9: SESSION HOOKS (integration)
// ============================================================

console.log(`${BOLD}═══ PHASE 9: SESSION HOOKS (integration) ═══${RESET}\n`);

// Test session-start hook runs and produces output
const hookDir = join(TEST_DIR, 'node_modules', 'npc-guide', 'dist', 'hooks');
const startOutput = execSync(`cd ${TEST_DIR} && node ${hookDir}/session-start.js 2>&1`, { encoding: 'utf-8' });
assert('49. SessionStart hook runs', startOutput.length > 0);
assert('49a. SessionStart injects architecture', startOutput.includes('Architecture'));
assert('49b. SessionStart injects missions', startOutput.includes('Mission Map'));
assert('49c. SessionStart has "Your Orders"', startOutput.includes('Your Orders'));
assert('49d. SessionStart has execution directive', startOutput.includes('START EXECUTING IMMEDIATELY'));

// Test session-end hook runs without error
try {
  execSync(`cd ${TEST_DIR} && node ${hookDir}/session-end.js 2>&1`, { encoding: 'utf-8' });
  assert('50. SessionEnd hook runs without error', true);
} catch (e) {
  assert('50. SessionEnd hook runs without error', false, e.message);
}

// Check session was archived
const latestSession = await readJson(join(TEST_DIR, '.ai-guide', 'sessions', 'latest.json'));
assert('50a. SessionEnd wrote latest.json', !!latestSession);
assert('50b. Session has endedAt', !!latestSession.endedAt);

console.log('');

// ============================================================
// PHASE 10: ORCHESTRATOR (NpcGuide class)
// ============================================================

console.log(`${BOLD}═══ PHASE 10: ORCHESTRATOR (NpcGuide full lifecycle) ═══${RESET}\n`);

const { NpcGuide } = await import(join(corePath, 'dist', 'index.js'));

const orchDir = join(TEST_DIR, '.ai-guide-orch-test');
const guide = new NpcGuide({ projectRoot: TEST_DIR, guideDir: '.ai-guide-orch-test' });
await guide.init();

// Process brief
const orchResult = await guide.processBrief('Build a dashboard with React and Supabase using Clerk auth');
assert('51. processBrief returns instruction', orchResult.length > 0);
assert('51a. processBrief returns formatted instruction', orchResult.includes('NPC GUIDE'));

const orchMap = guide.getMissionMap();
assert('52. getMissionMap returns map', !!orchMap);
assert('52a. Map has missions', orchMap.missions.length >= 5);
assert('52b. Map has projectName', !!orchMap.projectName);

const orchBrief = guide.getBrief();
assert('53. getBrief returns parsed brief', !!orchBrief);
assert('53a. Brief has intent=build', orchBrief.intent === 'build');

// Log decision
await guide.logDecision('Use RSC for server rendering', 'Better performance');
assert('54. logDecision completes', true);

// Complete mission
const nextResult = await guide.completeMission('Set up Next.js project with all deps installed');
assert('55. completeMission returns next instruction', nextResult.length > 0);
assert('55a. Mission 1 now complete', guide.getMissionMap().missions[0].status === 'complete');
assert('55b. Mission 2 now active', guide.getMissionMap().missions[1].status === 'active');
assert('55c. currentMission advanced to 2', guide.getMissionMap().currentMission === 2);

// Memory was updated — atomic entries
const orchMemory = guide.getMemory().getAll();
assert('56. Memory has atomic entries from lifecycle', orchMemory.length >= 5,
  `Got ${orchMemory.length} entries`);
assert('56a. Memory has project identity', orchMemory.some(m => m.content.includes('Project:') && m.category === 'architecture'));
assert('56b. Memory has progress entry', orchMemory.some(m => m.category === 'progress'));
assert('56c. Memory has Framework entry', orchMemory.some(m => m.content === 'Framework: React'));
assert('56d. Memory has Database entry', orchMemory.some(m => m.content.includes('Database:')));

console.log('');

// ============================================================
// RESULTS
// ============================================================

console.log(`${BOLD}═══════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  RESULTS: ${passed} passed, ${failed} failed${RESET}`);
console.log(`${BOLD}═══════════════════════════════════════════${RESET}\n`);

if (failures.length > 0) {
  console.log(`${FAIL} Failures:`);
  for (const f of failures) {
    console.log(`  - ${f.name} ${DIM}${f.detail}${RESET}`);
  }
  console.log('');
}

// Cleanup
await rm(join(TEST_DIR, '.ai-guide-mem-test'), { recursive: true, force: true });
await rm(join(TEST_DIR, '.ai-guide-sync-test'), { recursive: true, force: true });
await rm(join(TEST_DIR, '.ai-guide-doc-test'), { recursive: true, force: true });
await rm(join(TEST_DIR, '.ai-guide-orch-test'), { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);
