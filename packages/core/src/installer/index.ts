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
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = process.env.INIT_CWD || process.cwd();
const guideDir = join(projectRoot, '.ai-guide');
const claudeDir = join(projectRoot, '.claude');

async function install() {
  // ── 0. Guard — only run inside a real project ──
  try {
    await access(join(projectRoot, 'package.json'));
  } catch {
    // No package.json = not a project directory. Skip silently.
    return;
  }

  // ── 1. Create .ai-guide/ structure ──
  await mkdir(join(guideDir, 'sessions', 'archive'), { recursive: true });
  await mkdir(join(guideDir, 'memory'), { recursive: true });

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
  // Resolve hooks path relative to this file — works for both npm registry and local installs
  // This file is at dist/installer/index.js → walk up to dist/hooks/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '..', 'hooks');
}

function getCursorRules(): string {
  return `# NPC Guide — Mission System
# This project uses NPC Guide for structured AI-driven development.
# Read .ai-guide/missions.md for the current mission map.
# Read .ai-guide/architecture.md for stack decisions.
# Read .ai-guide/decisions.md for past decisions — avoid contradicting them.
# Execute the ACTIVE mission (▶). Do not ask questions you can infer.
# Just build. Memory and mission tracking happen automatically via hooks.
`;
}

function getClaudeMdSection(): string {
  return `# NPC Guide — Mission System

This project is driven by NPC Guide. You are the coding agent. The Guide is your director.

## How this works
- NPC Guide hooks run automatically at session start and end.
- Session start: injects your mission, architecture, and memory context.
- Session end: observes what you changed (via git diff) and records it automatically.
- You do NOT need to write to any .ai-guide/ files. Just build.

## Your rules
1. The ACTIVE mission (marked ▶) is your ONLY job right now.
2. **START EXECUTING IMMEDIATELY.** Do NOT ask "should I start?" — just do it.
3. Do NOT ask questions you can infer from the architecture and decisions docs.
4. Read \`.ai-guide/decisions.md\` for past decisions — avoid contradicting them without good reason.
5. Focus on building. Memory and mission tracking happen automatically.

## What you are NOT
- You are NOT waiting for permission. The mission map IS your permission.
- You are NOT a chatbot. You are an executor.
- You are NOT responsible for bookkeeping. The hooks handle that.
`;
}

install().catch(() => {
  // Silent failure — never break npm install
});
