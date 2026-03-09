#!/usr/bin/env node

/**
 * npx npc-guide init
 *
 * 1. Scans the project — reads package.json, detects stack, counts files
 * 2. Shows what it found
 * 3. Asks the user what they want to build / work on
 * 4. Generates missions from scan + user answer
 *
 * Works for fresh AND midway projects.
 */

import { createInterface } from 'readline';
import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { parseBrief } from '../brief-parser/index.js';
import { buildMissionMap } from '../mission-architect/index.js';
import { DocWriter } from '../memory/doc-writer.js';
import { MemorySystem } from '../memory/index.js';
import { DEFAULT_CONFIG } from '../types.js';
import { scanProject, formatScanOutput } from '../project-scanner/index.js';

const projectRoot = process.cwd();

// Check for inline brief (backwards compat: npx npc-guide init "brief")
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === 'init' ? rawArgs.slice(1) : rawArgs;
const inlineBrief = args.join(' ').trim();

async function init() {
  // Guard — must be inside a project
  try {
    await access(join(projectRoot, 'package.json'));
  } catch {
    console.log('');
    console.log('  Run this inside a project folder (one with a package.json).');
    console.log('');
    console.log('  Example:');
    console.log('    cd my-app');
    console.log('    npx npc-guide init');
    console.log('');
    process.exit(1);
  }

  // ── Step 1: Scan the project ──
  console.log('');
  console.log('⚡ NPC Guide — scanning project...');
  console.log('');

  const scan = await scanProject(projectRoot);
  console.log(formatScanOutput(scan));
  console.log('');

  // ── Step 2: Get the brief ──
  let brief: string;

  if (inlineBrief && inlineBrief.split(/\s+/).length >= 4) {
    // Inline brief provided and long enough
    brief = inlineBrief;
  } else {
    // Interactive prompt
    const question = scan.hasFiles
      ? '  What do you want to work on?'
      : '  What are you building?';

    console.log(question);
    brief = await ask('  > ');
    console.log('');

    if (!brief || brief.trim().split(/\s+/).length < 3) {
      console.log('  Need a bit more detail. Example:');
      console.log('  "Build real-time chat with rooms and presence"');
      console.log('  "Redesign the dashboard UI and add dark mode"');
      console.log('  "Fix the auth flow — login redirects to 404"');
      console.log('');
      process.exit(1);
    }
  }

  // ── Step 3: Merge scan context into the brief ──
  // Enrich the brief with detected stack so the parser doesn't have to guess
  let enrichedBrief = brief;
  if (scan.stack.framework) enrichedBrief += ` with ${scan.stack.framework}`;
  if (scan.stack.database) enrichedBrief += ` and ${scan.stack.database}`;
  if (scan.stack.auth) enrichedBrief += ` using ${scan.stack.auth}`;

  const config = { ...DEFAULT_CONFIG, projectRoot };

  // Parse the brief
  const parsed = parseBrief(enrichedBrief);

  // Override stack with scan results (scan is ground truth, brief is supplementary)
  if (scan.stack.language) parsed.stack.language = scan.stack.language;
  if (scan.stack.framework) parsed.stack.framework = scan.stack.framework;
  if (scan.stack.database) parsed.stack.database = scan.stack.database;
  if (scan.stack.auth) parsed.stack.auth = scan.stack.auth;
  if (scan.stack.styling) parsed.stack.styling = scan.stack.styling;
  if (scan.stack.deployment) parsed.stack.deployment = scan.stack.deployment;
  if (scan.stack.extras.length > 0) parsed.stack.extras = scan.stack.extras;

  // Build mission map
  const map = buildMissionMap(parsed);

  // ── Step 4: Write docs ──
  const docs = new DocWriter(config);
  await docs.init();
  await docs.writeArchitecture(parsed);
  await docs.writeMissionMap(map);

  // Initialize memory
  const memory = new MemorySystem(config);
  await memory.init();
  await memory.addMemory(
    `Project: ${parsed.projectName}. Intent: ${parsed.intent}. Stack: ${parsed.stack.language}/${parsed.stack.framework || 'none'}. DB: ${parsed.stack.database || 'none'}. Scan: ${scan.summary}`,
    'architecture'
  );

  // ── Output ──
  console.log(`⚡ NPC Guide initialized — "${parsed.projectName}"`);
  if (scan.summary && scan.summary !== 'Empty project') {
    console.log(`   Stack: ${scan.summary} (detected)`);
  }
  console.log(`   Intent: ${parsed.intent} | ${map.totalMissions} missions`);
  console.log('');
  for (const m of map.missions) {
    const icon = m.status === 'active' ? '▶' : '○';
    console.log(`   ${icon} ${m.name}  ${m.goal}`);
  }
  console.log('');
  console.log('   .ai-guide/ created. Open your coding agent — it will start automatically.');
  console.log('');
}

function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

init().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
