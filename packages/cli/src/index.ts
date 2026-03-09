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

  console.log(`\n${c.dim}Processing brief...${c.reset}`);
  const instruction = await guide.processBrief(brief);
  const map = guide.getMissionMap()!;

  printMissionMap(map);
  printInstruction(instruction);

  // ── Mission loop ────────────────────────────────────────
  while (true) {
    const current = getCurrentMission(map);
    if (!current) {
      console.log(`\n${c.green}${c.bold}🏁 All missions complete. Ship it.${c.reset}\n`);
      break;
    }

    const action = await prompt(rl, `\n[Mission ${current.id}] > `);
    const lower = action.toLowerCase();

    if (lower === 'done' || lower === 'complete' || lower === 'next') {
      const summary = await prompt(rl, '  Summary of what was done: ');
      const nextInstruction = await guide.completeMission(summary || 'Mission completed');
      printMissionMap(guide.getMissionMap()!);

      if (getCurrentMission(guide.getMissionMap()!)) {
        printInstruction(nextInstruction);
      } else {
        console.log(`\n${c.green}${c.bold}🏁 All missions complete. Ship it.${c.reset}\n`);
        break;
      }
    } else if (lower === 'map' || lower === 'status') {
      printMissionMap(guide.getMissionMap()!);
    } else if (lower.startsWith('decide ') || lower.startsWith('decision ')) {
      const parts = action.replace(/^(decide|decision)\s+/i, '').split(' because ');
      const decision = parts[0];
      const reason = parts[1] || 'No reason given';
      await guide.logDecision(decision, reason);
      console.log(`${c.green}  ✓ Decision logged${c.reset}`);
    } else if (lower === 'memory') {
      const mem = guide.getMemory().getActive();
      if (mem.length === 0) {
        console.log(`${c.dim}  No active memories yet.${c.reset}`);
      } else {
        console.log(`\n${c.bold}Active Memories (${mem.length})${c.reset}`);
        for (const m of mem) {
          console.log(`  ${c.dim}[${m.category}]${c.reset} ${m.content}`);
        }
      }
    } else if (lower === 'help') {
      console.log(`
${c.bold}Commands:${c.reset}
  ${c.cyan}done${c.reset} / ${c.cyan}complete${c.reset} / ${c.cyan}next${c.reset}  — Complete current mission, advance to next
  ${c.cyan}map${c.reset} / ${c.cyan}status${c.reset}            — Show mission map
  ${c.cyan}decide <what> because <why>${c.reset} — Log an architectural decision
  ${c.cyan}memory${c.reset}                 — Show active memories
  ${c.cyan}quit${c.reset} / ${c.cyan}exit${c.reset}             — Exit
`);
    } else if (lower === 'quit' || lower === 'exit') {
      console.log(`${c.dim}Session saved. See you next time.${c.reset}`);
      break;
    } else {
      console.log(`${c.dim}  Type 'help' for commands, or 'done' to complete the current mission.${c.reset}`);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
