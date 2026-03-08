#!/usr/bin/env node

/**
 * postinstall — runs on `npm install npc-guide`
 *
 * What it does:
 * 1. Creates .ai-guide/ folder structure
 * 2. Writes hooks config into .claude/settings.json (Claude Code)
 * 3. Writes .cursorrules (Cursor)
 * 4. Updates CLAUDE.md with mission system instructions
 *
 * What it does NOT do:
 * - Ask questions
 * - Print anything noisy
 * - Modify user code
 * - Require configuration
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, relative } from 'path';

const projectRoot = process.env.INIT_CWD || process.cwd();
const guideDir = join(projectRoot, '.ai-guide');
const claudeDir = join(projectRoot, '.claude');

async function install() {
  // ── 1. Create .ai-guide/ structure ──
  await mkdir(join(guideDir, 'sessions', 'archive'), { recursive: true });
  await mkdir(join(guideDir, 'memory'), { recursive: true });

  // Initialize memory table if it doesn't exist
  const memoryTablePath = join(guideDir, 'memory', 'memory-table.json');
  try {
    await access(memoryTablePath);
  } catch {
    await writeFile(memoryTablePath, JSON.stringify({
      version: 1,
      windowSize: 15,
      items: [],
    }, null, 2));
  }

  // ── 2. Wire Claude Code hooks ──
  await mkdir(claudeDir, { recursive: true });

  const hookScript = getHookScriptPath();
  const settingsPath = join(claudeDir, 'settings.json');

  let settings: any = {};
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(raw);
  } catch {}

  // Merge hooks — don't overwrite existing hooks
  if (!settings.hooks) settings.hooks = {};

  // SessionStart hook
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  const hasStartHook = settings.hooks.SessionStart.some(
    (h: any) => h.hooks?.some((hh: any) => hh.command?.includes('npc-guide'))
  );
  if (!hasStartHook) {
    settings.hooks.SessionStart.push({
      matcher: '',
      hooks: [{
        type: 'command',
        command: `node ${hookScript}/session-start.js`,
      }],
    });
  }

  // SessionEnd hook
  if (!settings.hooks.SessionEnd) settings.hooks.SessionEnd = [];
  const hasEndHook = settings.hooks.SessionEnd.some(
    (h: any) => h.hooks?.some((hh: any) => hh.command?.includes('npc-guide'))
  );
  if (!hasEndHook) {
    settings.hooks.SessionEnd.push({
      matcher: '',
      hooks: [{
        type: 'command',
        command: `node ${hookScript}/session-end.js`,
      }],
    });
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2));

  // ── 3. Write .cursorrules (Cursor support) ──
  const cursorRulesPath = join(projectRoot, '.cursorrules');
  try {
    await access(cursorRulesPath);
    // Already exists — don't overwrite, append if npc-guide section missing
    const existing = await readFile(cursorRulesPath, 'utf-8');
    if (!existing.includes('NPC Guide')) {
      await writeFile(cursorRulesPath, existing + '\n\n' + getCursorRules());
    }
  } catch {
    await writeFile(cursorRulesPath, getCursorRules());
  }

  // ── 4. Update CLAUDE.md ──
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  try {
    await access(claudeMdPath);
    const existing = await readFile(claudeMdPath, 'utf-8');
    if (!existing.includes('NPC Guide')) {
      await writeFile(claudeMdPath, existing + '\n\n' + getClaudeMdSection());
    }
  } catch {
    await writeFile(claudeMdPath, getClaudeMdSection());
  }

  // ── 5. Add .ai-guide to .gitignore sessions (keep architecture + decisions) ──
  const gitignorePath = join(projectRoot, '.gitignore');
  try {
    const existing = await readFile(gitignorePath, 'utf-8');
    if (!existing.includes('.ai-guide/sessions')) {
      await writeFile(gitignorePath, existing + '\n# NPC Guide — sessions are local, everything else is shared\n.ai-guide/sessions/\n');
    }
  } catch {
    await writeFile(gitignorePath, '# NPC Guide — sessions are local, everything else is shared\n.ai-guide/sessions/\n');
  }

  // Done — silent
}

function getHookScriptPath(): string {
  // Resolve to the installed package's dist/hooks/ directory
  const packageHooks = join(projectRoot, 'node_modules', '@npc-guide', 'core', 'dist', 'hooks');
  return packageHooks;
}

function getCursorRules(): string {
  return `# NPC Guide — Mission System
# This project uses NPC Guide for structured AI-driven development.
# Read .ai-guide/missions.md for the current mission map.
# Read .ai-guide/architecture.md for stack decisions.
# Read .ai-guide/decisions.md for architectural choices and reasoning.
# Execute the ACTIVE mission. Do not ask questions you can infer.
# Log every architectural decision in .ai-guide/decisions.md.
# When a mission is complete, update .ai-guide/missions.md.
`;
}

function getClaudeMdSection(): string {
  return `# NPC Guide — Mission System

This project uses NPC Guide for structured AI-driven development.

## How It Works
- Read \`.ai-guide/missions.md\` for the current mission map
- Read \`.ai-guide/architecture.md\` for stack and project context
- Read \`.ai-guide/decisions.md\` for past architectural decisions
- Execute the **active mission** (marked ▶)
- Do NOT ask questions you can infer from context
- Log every architectural decision to \`.ai-guide/decisions.md\` with reasoning
- When a mission is complete, mark it ✅ in \`.ai-guide/missions.md\` and activate the next one
- Write a brief session summary to \`.ai-guide/sessions/latest.json\` before stopping
`;
}

install().catch(() => {
  // Silent failure — never break npm install
});
