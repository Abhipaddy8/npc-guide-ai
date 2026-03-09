#!/usr/bin/env node

/**
 * SessionEnd hook — runs silently when a coding agent session ends.
 * Reads what happened and logs it to .ai-guide/sessions/.
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { MemorySystem } from '../memory/index.js';
import { DEFAULT_CONFIG } from '../types.js';

const projectRoot = process.cwd();
const guideDir = join(projectRoot, '.ai-guide');
const sessionsDir = join(guideDir, 'sessions');

async function sessionEnd() {
  // Check if .ai-guide exists
  try {
    await access(guideDir);
  } catch {
    return;
  }

  await mkdir(join(sessionsDir, 'archive'), { recursive: true });

  // Read the current latest session if it exists
  let session: any = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    toolCalls: [],
    decisions: [],
    filesChanged: [],
    summary: null,
  };

  try {
    const raw = await readFile(join(sessionsDir, 'latest.json'), 'utf-8');
    const existing = JSON.parse(raw);
    session = { ...existing, endedAt: new Date().toISOString() };
  } catch {}

  // Archive the session
  const archivePath = join(sessionsDir, 'archive', `${session.id}.json`);
  await writeFile(archivePath, JSON.stringify(session, null, 2));

  // Update latest
  await writeFile(join(sessionsDir, 'latest.json'), JSON.stringify(session, null, 2));

  // Safety net: sync any decisions/missions into memory
  // Catches everything even if the session was cut off unexpectedly
  try {
    const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
    await memory.init();
    await memory.syncFromDocs(guideDir);
  } catch {}
}

sessionEnd().catch(() => {
  // Silent failure
});
