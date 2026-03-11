#!/usr/bin/env node

/**
 * SessionStart hook — runs silently when a coding agent session begins.
 *
 * Two modes:
 *   FIRST SESSION: brief.md exists, missions.md does not.
 *     → Inject generation prompt. Agent reads codebase and writes missions.md.
 *
 *   NORMAL SESSION: missions.md exists.
 *     → Inject context: architecture, missions, decisions, memory, last session.
 *     → Agent builds. Hooks observe and record.
 *
 * Always: takes a git snapshot so SessionEnd can diff.
 */

import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { MemorySystem } from '../memory/index.js';
import { retrieveRelevantMemories } from '../memory/retriever.js';
import { DEFAULT_CONFIG } from '../types.js';

const projectRoot = process.cwd();
const guideDir = join(projectRoot, '.ai-guide');

async function sessionStart() {
  // Check if .ai-guide exists
  try {
    await access(guideDir);
  } catch {
    return;
  }

  // ── 0. Take snapshot for SessionEnd to diff against ──
  await mkdir(join(guideDir, 'sessions'), { recursive: true });
  const snapshot: Record<string, string> = {
    timestamp: new Date().toISOString(),
    sha: '',
    trackedFiles: '',
  };

  try {
    snapshot.sha = execSync('git rev-parse HEAD', { cwd: projectRoot, encoding: 'utf-8' }).trim();
  } catch {}

  try {
    snapshot.trackedFiles = execSync('git status --porcelain', { cwd: projectRoot, encoding: 'utf-8' }).trim();
  } catch {}

  await writeFile(join(guideDir, 'sessions', '.snapshot'), JSON.stringify(snapshot));

  // ── 1. Check for first-session mode ──
  const hasBrief = await fileExists(join(guideDir, 'brief.md'));
  const hasMissions = await fileExists(join(guideDir, 'missions.md'));

  // Not initialized yet — user needs to run `npx npc-guide init`
  if (!hasBrief && !hasMissions) {
    process.stderr.write(`⚡ NPC Guide installed — run 'npx npc-guide init' to get started\n`);
    return;
  }

  if (hasBrief && !hasMissions) {
    await firstSession();
    return;
  }

  // ── 2. Normal session — inject context ──
  await normalSession();
}

// ─── First Session: Agent Generates Missions ───────────────────────────────────

async function firstSession() {
  const sections: string[] = [];

  sections.push('# NPC Guide — Generate Missions');
  sections.push('');

  // Load brief
  try {
    const brief = await readFile(join(guideDir, 'brief.md'), 'utf-8');
    sections.push('## Brief');
    sections.push(brief);
    sections.push('');
  } catch {}

  // Load architecture/scan
  try {
    const arch = await readFile(join(guideDir, 'architecture.md'), 'utf-8');
    sections.push('## Project Scan');
    sections.push(arch);
    sections.push('');
  } catch {}

  // Load memory for additional context
  const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
  try {
    await memory.init();
    const active = memory.getActive();
    if (active.length > 0) {
      sections.push('## Known Context');
      for (const item of active) {
        sections.push(`- [${item.category}] ${item.content}`);
      }
      sections.push('');
    }
  } catch {}

  // The generation prompt
  sections.push('## Your job right now');
  sections.push('');
  sections.push('1. Read the brief and project scan above.');
  sections.push('2. Read the relevant source files to understand what already exists.');
  sections.push('3. Generate 3-6 specific missions for THIS codebase.');
  sections.push('4. Write them to `.ai-guide/missions.md` in EXACTLY this format:');
  sections.push('');
  sections.push('```');
  sections.push('# Mission Map');
  sections.push('');
  sections.push('- ▶️ **1 — Name** — Specific goal referencing actual files or modules');
  sections.push('- 🔒 **2 — Name** — Specific goal');
  sections.push('- 🔒 **3 — Name** — Specific goal');
  sections.push('```');
  sections.push('');
  sections.push('5. Then start executing Mission 1 immediately.');
  sections.push('');
  sections.push('Do NOT use generic goals like "build the primary feature" or "scaffold project structure".');
  sections.push('Reference actual filenames, services, routes, and modules from the project scan.');
  sections.push('Each mission should describe a concrete change to specific files.');
  sections.push('');

  // Status line
  let sessionCount = 1;
  try {
    const archived = await readdir(join(guideDir, 'sessions', 'archive'));
    sessionCount = archived.filter(f => f.endsWith('.json')).length + 1;
  } catch {}
  process.stderr.write(`⚡ NPC Guide — First session (generating missions) | Session ${sessionCount}\n`);

  process.stdout.write(sections.join('\n'));
}

// ─── Normal Session: Inject Context ────────────────────────────────────────────

async function normalSession() {
  const sections: string[] = [];

  sections.push('# NPC Guide — Session Context');
  sections.push('You are operating under the NPC Guide mission system. Follow the active mission below.');
  sections.push('');

  // Load architecture
  try {
    const arch = await readFile(join(guideDir, 'architecture.md'), 'utf-8');
    sections.push(arch);
    sections.push('');
  } catch {}

  // Load mission map
  let missionsContent = '';
  try {
    missionsContent = await readFile(join(guideDir, 'missions.md'), 'utf-8');
    sections.push(missionsContent);
    sections.push('');
  } catch {}

  // Load decisions (last 80 lines)
  try {
    const decisions = await readFile(join(guideDir, 'decisions.md'), 'utf-8');
    const lines = decisions.split('\n');
    const trimmed = lines.slice(0, 80).join('\n');
    sections.push(trimmed);
    sections.push('');
  } catch {}

  // Sync memory from previous session observations
  const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
  try {
    await memory.init();
    await memory.tickSession();
    await memory.syncFromDocs(guideDir);
  } catch {}

  // Retrieve relevant memories
  try {
    const missionGoal = extractActiveMissionGoal(missionsContent);
    const allMemories = memory.getAll().filter(m => m.status !== 'archived');

    if (allMemories.length > 0 && missionGoal) {
      const relevant = retrieveRelevantMemories(missionGoal, allMemories, 10, 0.05);

      for (const r of relevant) {
        await memory.recordHit(r.item.id);
      }

      if (relevant.length > 0) {
        sections.push('## Relevant Memory');
        for (const r of relevant) {
          sections.push(`- [${r.item.category}] ${r.item.content}`);
        }
        sections.push('');
      }
    } else if (allMemories.length > 0) {
      const active = memory.getActive();
      if (active.length > 0) {
        sections.push('## Active Memory');
        for (const item of active) {
          sections.push(`- [${item.category}] ${item.content}`);
        }
        sections.push('');
      }
    }
  } catch {}

  // Load last session summary
  try {
    const latest = await readFile(join(guideDir, 'sessions', 'latest.json'), 'utf-8');
    const session = JSON.parse(latest);
    if (session.summary) {
      sections.push('## Last Session');
      sections.push(session.summary);
      sections.push('');
    }
  } catch {}

  // Mission instructions
  sections.push('## Your Orders');
  sections.push('You are a coding agent under NPC Guide direction. START EXECUTING IMMEDIATELY.');
  sections.push('- Find the ACTIVE mission (▶) above. That is your ONLY job right now.');
  sections.push('- DO NOT ask the user "should I start?" or "want me to begin?" — JUST DO IT.');
  sections.push('- Do NOT ask questions you can infer from the architecture and decisions docs.');
  sections.push('- You are an executor, not a chatbot. The mission map is your permission to act.');
  sections.push('');

  // Status line to stderr
  const activeMission = extractActiveMissionInfo(missionsContent);
  let sessionCount = 1;
  try {
    const archived = await readdir(join(guideDir, 'sessions', 'archive'));
    sessionCount = archived.filter(f => f.endsWith('.json')).length + 1;
  } catch {}
  const memoryCount = memory.getActive().length;

  const missionLabel = activeMission
    ? `Mission ${activeMission.number}: ${activeMission.name}`
    : 'No active mission';
  process.stderr.write(`⚡ NPC Guide — ${missionLabel} | Session ${sessionCount} | ${memoryCount} memories active\n`);

  process.stdout.write(sections.join('\n'));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function extractActiveMissionGoal(content: string): string | null {
  if (!content) return null;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('▶')) {
      const match = line.match(/—\s*(.+?)$/);
      return match ? match[1].trim() : null;
    }
  }
  return null;
}

function extractActiveMissionInfo(content: string): { number: string; name: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('▶')) {
      const match = line.match(/\*\*(\d+)\s*—\s*(.+?)\*\*/);
      if (match) return { number: match[1], name: match[2].trim() };
    }
  }
  return null;
}

sessionStart().catch(() => {
  // Silent failure — never break the agent's session
});
