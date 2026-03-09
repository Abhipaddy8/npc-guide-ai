#!/usr/bin/env node

/**
 * SessionStart hook — runs silently when a coding agent session begins.
 *
 * 1. Syncs decisions.md + missions.md into memory (catches up from crashed sessions)
 * 2. Retrieves relevant memories using cosine similarity (or keyword fallback)
 * 3. Injects focused context into agent via stdout
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
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

  // ── Load decisions (last 20 entries max) ──
  try {
    const decisions = await readFile(join(guideDir, 'decisions.md'), 'utf-8');
    const lines = decisions.split('\n');
    const trimmed = lines.slice(0, 80).join('\n');
    sections.push(trimmed);
    sections.push('');
  } catch {}

  // ── Sync memory from docs (catches up from crashed/cut sessions) ──
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
      // TF-IDF cosine similarity — pure math, no API
      const relevant = retrieveRelevantMemories(missionGoal, allMemories, 10, 0.05);

      // Record hits for scoring
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
      // No mission goal to query — dump active memories
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

  // ── Mission instructions ──
  sections.push('## Your Orders');
  sections.push('You are a coding agent under NPC Guide direction. START EXECUTING IMMEDIATELY.');
  sections.push('- Find the ACTIVE mission (▶) above. That is your ONLY job right now.');
  sections.push('- DO NOT ask the user "should I start?" or "want me to begin?" — JUST DO IT.');
  sections.push('- Do NOT ask questions you can infer from the architecture and decisions docs.');
  sections.push('- Log every architectural decision in .ai-guide/decisions.md.');
  sections.push('- When the mission is complete, update .ai-guide/missions.md: mark current ✅, mark next ▶️.');
  sections.push('- Write a session summary to .ai-guide/sessions/latest.json before stopping.');
  sections.push('- You are an executor, not a chatbot. The mission map is your permission to act.');
  sections.push('');

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

sessionStart().catch(() => {
  // Silent failure — never break the agent's session
});
