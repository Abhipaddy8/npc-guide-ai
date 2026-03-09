#!/usr/bin/env node

/**
 * npx npc-guide init
 *
 * 1. Scans the project — reads package.json, lists deps, maps folders
 * 2. Shows what it found
 * 3. Asks the user what they want to build / work on
 * 4. Saves the raw brief + raw scan — the coding agent generates missions
 *
 * No template missions. No brief parsing. The agent reads the codebase
 * and generates specific, actionable missions itself.
 */

import { createInterface } from 'readline';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { MemorySystem } from '../memory/index.js';
import { DEFAULT_CONFIG } from '../types.js';
import { scanProject, formatScanOutput } from '../project-scanner/index.js';

const projectRoot = process.cwd();
const guideDir = join(projectRoot, '.ai-guide');

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
    brief = inlineBrief;
  } else {
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

  // ── Step 3: Write raw scan + raw brief ──
  await mkdir(join(guideDir, 'sessions', 'archive'), { recursive: true });
  await mkdir(join(guideDir, 'memory'), { recursive: true });

  // architecture.md — raw scan facts, no interpretation
  const archLines: string[] = [
    '# Project Scan',
    '',
  ];

  if (scan.packageJson?.name) {
    archLines.push(`**Name**: ${scan.packageJson.name}`);
  }
  if (scan.language) {
    archLines.push(`**Language**: ${scan.language}`);
  }

  const deps = scan.deps.filter(d => !['typescript', '@types/node'].includes(d));
  if (deps.length > 0) {
    archLines.push('', '## Dependencies', deps.join(', '));
  }

  const folders = scan.structure.filter(s => s.endsWith('/'));
  const configs = scan.structure.filter(s => !s.endsWith('/') && !s.startsWith('~'));
  const fileCounts = scan.structure.filter(s => s.startsWith('~'));

  if (folders.length > 0) {
    archLines.push('', '## Folders', folders.join(', '));
  }
  if (configs.length > 0) {
    archLines.push('', '## Config Files', configs.join(', '));
  }
  if (fileCounts.length > 0) {
    archLines.push('', '## Source Files', fileCounts.join(', '));
  }

  if (scan.packageJson?.scripts) {
    const scripts = Object.entries(scan.packageJson.scripts)
      .map(([k, v]) => `${k}: ${v}`);
    archLines.push('', '## Scripts', ...scripts);
  }

  await writeFile(join(guideDir, 'architecture.md'), archLines.join('\n'));

  // brief.md — raw user brief, untouched
  await writeFile(join(guideDir, 'brief.md'), brief);

  // ── Step 4: Seed memory ──
  const config = { ...DEFAULT_CONFIG, projectRoot };
  const memory = new MemorySystem(config);
  await memory.init();

  if (memory.getAll().length === 0) {
    if (scan.deps.length > 0) {
      await memory.addMemory(`Dependencies: ${scan.deps.join(', ')}`, 'architecture');
    }
    if (scan.structure.length > 0) {
      await memory.addMemory(`Structure: ${scan.structure.join(', ')}`, 'context');
    }
    await memory.addMemory(`Brief: ${brief}`, 'architecture');
  }

  // ── Output ──
  console.log(`⚡ NPC Guide initialized — brief saved.`);
  if (scan.language) {
    console.log(`   ${scan.language} | ${scan.deps.length} dependencies | ${fileCounts.join(', ') || 'no source files detected'}`);
  }
  console.log('');
  console.log('   Open your coding agent — it will generate missions on first session.');
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
