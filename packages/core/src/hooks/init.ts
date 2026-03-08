#!/usr/bin/env node

/**
 * npx npc-guide init "Build a SaaS dashboard with Next.js and Supabase"
 *
 * One-time setup. Takes the brief, generates:
 * - .ai-guide/architecture.md
 * - .ai-guide/missions.md
 * - .ai-guide/decisions.md
 * - .ai-guide/memory/memory-table.json
 *
 * After this, the hooks handle everything silently.
 */

import { parseBrief } from '../brief-parser/index.js';
import { buildMissionMap } from '../mission-architect/index.js';
import { DocWriter } from '../memory/doc-writer.js';
import { MemorySystem } from '../memory/index.js';
import { DEFAULT_CONFIG } from '../types.js';

const projectRoot = process.cwd();
// Strip the "init" subcommand if present
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === 'init' ? rawArgs.slice(1) : rawArgs;
const brief = args.join(' ');

async function init() {
  if (!brief) {
    console.log('Usage: npx npc-guide init "your project brief here"');
    console.log('');
    console.log('Example:');
    console.log('  npx npc-guide init "Build a SaaS dashboard with Next.js, Supabase, and Stripe"');
    console.log('  npx npc-guide init "Fix the broken webhook handler for payment processing"');
    console.log('  npx npc-guide init "Design the API architecture for a multi-tenant platform"');
    process.exit(1);
  }

  const config = { ...DEFAULT_CONFIG, projectRoot };

  // Parse the brief
  const parsed = parseBrief(brief);

  // Build mission map
  const map = buildMissionMap(parsed);

  // Write docs
  const docs = new DocWriter(config);
  await docs.init();
  await docs.writeArchitecture(parsed);
  await docs.writeMissionMap(map);

  // Initialize memory
  const memory = new MemorySystem(config);
  await memory.init();
  await memory.addMemory(
    `Project: ${parsed.projectName}. Intent: ${parsed.intent}. Stack: ${parsed.stack.language}/${parsed.stack.framework || 'none'}. DB: ${parsed.stack.database || 'none'}`,
    'architecture'
  );

  // Output
  console.log('');
  console.log(`⚡ NPC Guide initialized — "${parsed.projectName}"`);
  console.log(`   Intent: ${parsed.intent} | ${map.totalMissions} missions`);
  console.log('');
  for (const m of map.missions) {
    const icon = m.status === 'active' ? '▶' : '○';
    console.log(`   ${icon} ${m.name}  ${m.goal}`);
  }
  console.log('');
  console.log('   .ai-guide/ created. Your next coding session will pick this up automatically.');
  console.log('');
}

init().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
