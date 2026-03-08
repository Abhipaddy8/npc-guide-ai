#!/usr/bin/env node

/**
 * SessionStart hook — runs silently when a coding agent session begins.
 * Reads .ai-guide/ memory, builds context, outputs to stdout.
 * The agent receives this as injected context.
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { MemorySystem } from '../memory/index.js';
import { DEFAULT_CONFIG } from '../types.js';

const projectRoot = process.cwd();
const guideDir = join(projectRoot, '.ai-guide');

async function sessionStart() {
  // Check if .ai-guide exists — if not, this project hasn't been initialized
  try {
    await access(guideDir);
  } catch {
    // No .ai-guide folder — silently exit, no context to inject
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
  try {
    const missions = await readFile(join(guideDir, 'missions.md'), 'utf-8');
    sections.push(missions);
    sections.push('');
  } catch {}

  // ── Load decisions ──
  try {
    const decisions = await readFile(join(guideDir, 'decisions.md'), 'utf-8');
    // Only include last 20 decisions to avoid bloat
    const lines = decisions.split('\n');
    const trimmed = lines.slice(0, 80).join('\n');
    sections.push(trimmed);
    sections.push('');
  } catch {}

  // ── Load active memories ──
  const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
  try {
    await memory.init();
    await memory.tickSession();

    const active = memory.getActive();
    if (active.length > 0) {
      sections.push('## Active Memory');
      for (const item of active) {
        sections.push(`- [${item.category}] ${item.content}`);
      }
      sections.push('');
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
    if (session.decisions?.length > 0) {
      sections.push('### Decisions from last session');
      session.decisions.forEach((d: string) => sections.push(`- ${d}`));
      sections.push('');
    }
  } catch {}

  // ── Mission instructions ──
  sections.push('## Your Orders');
  sections.push('- Execute the ACTIVE mission (▶) in the mission map above.');
  sections.push('- Do NOT ask the user questions you can infer from context.');
  sections.push('- Log every architectural decision in .ai-guide/decisions.md.');
  sections.push('- When the mission is complete, update .ai-guide/missions.md to mark it ✅ and activate the next mission.');
  sections.push('- Write a session summary to .ai-guide/sessions/latest.json before stopping.');
  sections.push('');

  // Output to stdout — this gets injected into the agent's context
  process.stdout.write(sections.join('\n'));
}

sessionStart().catch(() => {
  // Silent failure — never break the agent's session
});
