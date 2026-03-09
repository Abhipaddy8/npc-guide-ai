#!/usr/bin/env node

/**
 * SessionEnd hook — observes what the agent did and records it.
 *
 * The agent's job is to build. This hook's job is to remember.
 *
 * 1. Reads the snapshot taken at SessionStart (git SHA + timestamp)
 * 2. Runs git diff to see what files changed during the session
 * 3. Infers which mission was active from missions.md
 * 4. Builds a session summary from observed changes
 * 5. Writes sessions/latest.json
 * 6. Syncs observations into memory
 * 7. If enough work was done, advances the mission
 *
 * The agent never needs to write to any .ai-guide/ file. This hook does it all.
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
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

  // ── 1. Read snapshot from SessionStart ──
  let snapshot: { timestamp: string; sha: string; trackedFiles: string } | null = null;
  try {
    const raw = await readFile(join(sessionsDir, '.snapshot'), 'utf-8');
    snapshot = JSON.parse(raw);
  } catch {}

  // ── 2. Observe what changed via git ──
  const changes = observeChanges(snapshot);

  // ── 3. Find active mission ──
  const activeMission = await getActiveMission();

  // ── 4. Build session record ──
  const session = {
    id: crypto.randomUUID(),
    startedAt: snapshot?.timestamp ?? new Date().toISOString(),
    endedAt: new Date().toISOString(),
    filesChanged: changes.files,
    filesAdded: changes.added,
    filesModified: changes.modified,
    linesChanged: changes.linesChanged,
    missionId: activeMission?.id ?? null,
    missionName: activeMission?.name ?? null,
    summary: buildSummary(changes, activeMission),
  };

  // ── 5. Write session record ──
  // Archive previous latest
  try {
    const prevRaw = await readFile(join(sessionsDir, 'latest.json'), 'utf-8');
    const prev = JSON.parse(prevRaw);
    if (prev.id) {
      await writeFile(
        join(sessionsDir, 'archive', `${prev.id}.json`),
        JSON.stringify(prev, null, 2),
      );
    }
  } catch {}

  await writeFile(join(sessionsDir, 'latest.json'), JSON.stringify(session, null, 2));

  // ── 6. Sync observations into memory ──
  try {
    const memory = new MemorySystem({ ...DEFAULT_CONFIG, projectRoot });
    await memory.init();

    // Add session summary as a memory entry
    if (session.summary && changes.files.length > 0) {
      await memory.addMemory(session.summary, 'progress');
    }

    // Add specific file change facts
    if (changes.added.length > 0) {
      await memory.addMemory(`Files created: ${changes.added.join(', ')}`, 'context');
    }

    // Sync any docs the agent may have written (belt + suspenders)
    await memory.syncFromDocs(guideDir);
  } catch {}

  // ── 7. Auto-advance mission if enough work was done ──
  // Scoring heuristic: don't advance on trivial changes
  const shouldAdvance = activeMission && (
    changes.files.length >= 5 ||
    changes.linesChanged >= 100 ||
    (changes.files.length >= 2 && changes.linesChanged >= 50)
  );
  if (shouldAdvance) {
    await tryAdvanceMission(activeMission, changes);
  }
}

// ─── Observe Changes ───────────────────────────────────────────────────────────

interface ChangeSet {
  files: string[];
  added: string[];
  modified: string[];
  deleted: string[];
  linesChanged: number;
  diffSummary: string;
}

function observeChanges(snapshot: { sha: string; trackedFiles: string } | null): ChangeSet {
  const result: ChangeSet = {
    files: [],
    added: [],
    modified: [],
    deleted: [],
    linesChanged: 0,
    diffSummary: '',
  };

  try {
    // Get all changes — both staged and unstaged, plus new commits
    let diffCmd: string;

    if (snapshot?.sha) {
      // Diff from session start SHA to current working tree
      diffCmd = `git diff ${snapshot.sha} --name-status`;
    } else {
      // No snapshot — just look at uncommitted changes
      diffCmd = 'git diff HEAD --name-status';
    }

    const diffOutput = execSync(diffCmd, { cwd: projectRoot, encoding: 'utf-8' }).trim();

    if (diffOutput) {
      for (const line of diffOutput.split('\n')) {
        const [status, ...fileParts] = line.split('\t');
        const file = fileParts.join('\t');
        if (!file || file.startsWith('.ai-guide/')) continue;

        result.files.push(file);
        if (status.startsWith('A')) result.added.push(file);
        else if (status.startsWith('M')) result.modified.push(file);
        else if (status.startsWith('D')) result.deleted.push(file);
      }
    }

    // Also check untracked files
    const untracked = execSync('git ls-files --others --exclude-standard', {
      cwd: projectRoot,
      encoding: 'utf-8',
    }).trim();

    if (untracked) {
      for (const file of untracked.split('\n')) {
        if (file && !file.startsWith('.ai-guide/') && !result.files.includes(file)) {
          result.files.push(file);
          result.added.push(file);
        }
      }
    }

    // Get line count changes
    try {
      const statCmd = snapshot?.sha
        ? `git diff ${snapshot.sha} --shortstat`
        : 'git diff HEAD --shortstat';
      const stat = execSync(statCmd, { cwd: projectRoot, encoding: 'utf-8' }).trim();
      const insertions = stat.match(/(\d+) insertion/);
      const deletions = stat.match(/(\d+) deletion/);
      result.linesChanged = (insertions ? parseInt(insertions[1]) : 0) + (deletions ? parseInt(deletions[1]) : 0);
      result.diffSummary = stat;
    } catch {}

  } catch {
    // Not a git repo or git not available — that's fine
  }

  return result;
}

// ─── Mission Handling ──────────────────────────────────────────────────────────

interface ActiveMission {
  id: number;
  name: string;
  goal: string;
  lineIndex: number;
}

async function getActiveMission(): Promise<ActiveMission | null> {
  try {
    const raw = await readFile(join(guideDir, 'missions.md'), 'utf-8');
    const lines = raw.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('▶')) {
        const nameMatch = line.match(/\*\*(.+?)\*\*/);
        const goalMatch = line.match(/\*\*\s*—\s*(.+?)(?:\n|$)/);
        const idMatch = line.match(/\*\*(\d+)/);

        return {
          id: idMatch ? parseInt(idMatch[1]) : 0,
          name: nameMatch ? nameMatch[1] : 'Unknown',
          goal: goalMatch ? goalMatch[1].trim() : '',
          lineIndex: i,
        };
      }
    }
  } catch {}

  return null;
}

async function tryAdvanceMission(mission: ActiveMission, changes: ChangeSet): Promise<void> {
  try {
    const missionsPath = join(guideDir, 'missions.md');
    let raw = await readFile(missionsPath, 'utf-8');
    const lines = raw.split('\n');

    // Mark current mission complete
    if (mission.lineIndex < lines.length) {
      lines[mission.lineIndex] = lines[mission.lineIndex]
        .replace('▶️', '✅')
        .replace('▶', '✅');

      // Find next locked mission and activate it
      for (let i = mission.lineIndex + 1; i < lines.length; i++) {
        if (lines[i].includes('🔒')) {
          lines[i] = lines[i].replace('🔒', '▶️');

          // Update "Current: Mission X" line
          const currentLineIdx = lines.findIndex(l => l.startsWith('**Current**:'));
          if (currentLineIdx >= 0) {
            const nextId = mission.id + 1;
            lines[currentLineIdx] = `**Current**: Mission ${nextId}`;
          }
          break;
        }
      }

      await writeFile(missionsPath, lines.join('\n'));
    }

    // Log the advancement to decisions.md
    const decisionsPath = join(guideDir, 'decisions.md');
    let decisions = '';
    try {
      decisions = await readFile(decisionsPath, 'utf-8');
    } catch {
      decisions = '# Decisions\n\n';
    }

    const entry = `### ${new Date().toISOString().slice(0, 19)}\n**Decision**: Mission "${mission.name}" marked complete\n**Reason**: Session ended with ${changes.files.length} files changed (${changes.added.length} added, ${changes.modified.length} modified). ${changes.diffSummary}\n\n`;
    await writeFile(decisionsPath, decisions + entry);

  } catch {}
}

// ─── Summary Builder ───────────────────────────────────────────────────────────

function buildSummary(changes: ChangeSet, mission: ActiveMission | null): string {
  if (changes.files.length === 0) {
    return 'No file changes observed this session.';
  }

  const parts: string[] = [];

  if (mission) {
    parts.push(`Working on: ${mission.name} — ${mission.goal}.`);
  }

  parts.push(`Changed ${changes.files.length} files (${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted).`);

  if (changes.linesChanged > 0) {
    parts.push(`${changes.linesChanged} lines changed.`);
  }

  // Categorize files by directory for a useful summary
  const dirs = new Map<string, string[]>();
  for (const file of changes.files) {
    const dir = file.includes('/') ? file.split('/').slice(0, -1).join('/') : '.';
    if (!dirs.has(dir)) dirs.set(dir, []);
    dirs.get(dir)!.push(file.split('/').pop()!);
  }

  const dirSummary = [...dirs.entries()]
    .map(([dir, files]) => `${dir}/ (${files.join(', ')})`)
    .join('; ');

  parts.push(`Files: ${dirSummary}`);

  return parts.join(' ');
}

sessionEnd().catch(() => {
  // Silent failure — never break the agent's session
});
