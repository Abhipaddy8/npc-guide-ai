#!/usr/bin/env node

import { createInterface } from 'readline';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  NpcGuide,
  MissionMap,
  getCurrentMission,
  formatInstructionForAgent,
  generateInstruction,
} from 'npc-guide';

// ── Load .env manually (no dotenv dependency) ──────────────
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {}
}
loadEnv();

// ── Colors (no dependency) ──────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
};

// ── Pretty print helpers ────────────────────────────────────
function banner() {
  console.log(`
${c.cyan}${c.bold}  ╔══════════════════════════════════════╗
  ║         NPC GUIDE AI  v0.1.0         ║
  ║  Your repo remembers everything.     ║
  ╚══════════════════════════════════════╝${c.reset}
`);
}

function printMissionMap(map: MissionMap) {
  console.log(`\n${c.bold}${c.cyan}⚡ Mission Map — "${map.projectName}"${c.reset}`);
  console.log(`${c.dim}   Intent: ${map.intent} | ${map.totalMissions} missions${c.reset}\n`);

  for (const m of map.missions) {
    const icons: Record<string, string> = {
      active: `${c.green}▶${c.reset}`,
      locked: `${c.dim}○${c.reset}`,
      complete: `${c.green}✓${c.reset}`,
      skipped: `${c.dim}⏭${c.reset}`,
    };
    const icon = icons[m.status] || '?';
    const nameColor = m.status === 'active' ? `${c.bold}${c.white}` : c.dim;
    console.log(`   ${icon} ${nameColor}${m.name}${c.reset}  ${c.gray}${m.goal}${c.reset}`);

    if (m.status === 'active' && m.tasks.length > 0) {
      for (const t of m.tasks) {
        console.log(`     ${c.dim}→ ${t}${c.reset}`);
      }
    }
  }
  console.log();
}

function printInstruction(text: string) {
  console.log(`${c.magenta}${c.bold}── AGENT INSTRUCTION ──${c.reset}`);
  console.log(text);
  console.log(`${c.magenta}${c.bold}───────────────────────${c.reset}\n`);
}

function prompt(rl: ReturnType<typeof createInterface>, msg: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${c.cyan}${msg}${c.reset}`, (answer) => resolve(answer.trim()));
  });
}

async function collectBrief(rl: ReturnType<typeof createInterface>): Promise<string> {
  return prompt(rl, '\n  > ');
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  banner();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const projectRoot = process.env.NPC_GUIDE_PROJECT || process.cwd();
  console.log(`${c.dim}  Project root: ${projectRoot}${c.reset}\n`);

  const guide = new NpcGuide({ projectRoot });
  await guide.init();

  // ── Brief input ─────────────────────────────────────────
  console.log(`${c.bold}What are we building?${c.reset}`);
  const brief = await collectBrief(rl);

  if (!brief) {
    console.log('No brief provided. Exiting.');
    rl.close();
    return;
  }

  console.log(`\n${c.dim}Saving brief...${c.reset}`);
  const result = await guide.processBrief(brief);

  console.log(`\n${c.green}${c.bold}  ✓ ${result}${c.reset}\n`);
  console.log(`${c.cyan}  Next: Open your coding agent in this folder.${c.reset}`);
  console.log(`${c.cyan}  The agent will read the brief, generate missions, and start building.${c.reset}\n`);
  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
