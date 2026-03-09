#!/usr/bin/env node

/**
 * SessionStart hook — runs silently when a coding agent session begins.
 *
 * 1. Takes a snapshot (git SHA + timestamp) so SessionEnd can diff
 * 2. Syncs any records from previous sessions into memory
 * 3. Retrieves relevant memories via TF-IDF
 * 4. Injects focused context into agent via stdout
 *
 * The agent's only job is to build. This hook gives it context.
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
  // Check if .ai-guide exists — if not, this project hasn't been initialized
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

  // ── 1. Build context to inject ──
  const sections: string[] = [];

  sections.push('# NPC Guide — Session Context');
  sections.push('You are operating under the NPC Guide mission system. Follow the active mission below.');
  sections.push('');

  // ── Load architecture ──
  try {
    const arch = await readFile(join(guideDir, 'architecture.md'), 'utf-8');
    sections.push(arch);
    sections.push('');
  } catch {}

  // ── Load mission map ──
  let missionsContent = '';
  try {
    missionsContent = await readFile(join(guideDir, 'missions.md'), 'utf-8');
    sections.push(missionsContent);
    sections.push('');
  } catch {}

  // ── Load decisions (last 80 lines) ──
  try {
    const decisions = await readFile(join(guideDir, 'decisions.md'), 'utf-8');
    const lines = decisions.split('\n');
    const trimmed = lines.slice(0, 80).join('\n');
    sections.push(trimmed);
    sections.push('');
  } catch {}

  // ── Sync memory from previous session observations ──
  const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
  try {
    await memory.init();
    await memory.tickSession();
    await memory.syncFromDocs(guideDir);
  } catch {}

  // ── Retrieve relevant memories ──
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

  // ── Load last session summary ──
  try {
    const latest = await readFile(join(guideDir, 'sessions', 'latest.json'), 'utf-8');
    const session = JSON.parse(latest);
    if (session.summary) {
      sections.push('## Last Session');
      sections.push(session.summary);
      sections.push('');
    }
  } catch {}

  // ── Mission instructions — NO file-writing demands ──
  sections.push('## Your Orders');
  sections.push('You are a coding agent under NPC Guide direction. START EXECUTING IMMEDIATELY.');
  sections.push('- Find the ACTIVE mission (▶) above. That is your ONLY job right now.');
  sections.push('- DO NOT ask the user "should I start?" or "want me to begin?" — JUST DO IT.');
  sections.push('- Do NOT ask questions you can infer from the architecture and decisions docs.');
  sections.push('- You are an executor, not a chatbot. The mission map is your permission to act.');
  sections.push('');

  // ── Status line to stderr — developer sees it, agent doesn't ──
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

  // Output to stdout — this gets injected into the agent's context
  process.stdout.write(sections.join('\n'));
}

/**
 * Extract the active mission's goal from missions.md content.
 */
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

/**
 * Extract active mission number and name for the status line.
 */
function extractActiveMissionInfo(content: string): { number: string; name: string } | null {
  if (!content) return null;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('▶')) {
      // Matches: "- ▶️ **1 — Foundation** — goal text"
      const match = line.match(/\*\*(\d+)\s*—\s*(.+?)\*\*/);
      if (match) return { number: match[1], name: match[2].trim() };
    }
  }
  return null;
}

sessionStart().catch(() => {
  // Silent failure — never break the agent's session
});
