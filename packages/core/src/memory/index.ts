import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { MemoryTable, MemoryItem, MemoryStatus, GuideConfig, DEFAULT_CONFIG } from '../types.js';

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export class MemorySystem {
  private table: MemoryTable;
  private config: GuideConfig;
  private memoryDir: string;

  constructor(config: Partial<GuideConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryDir = join(this.config.projectRoot, this.config.guideDir, 'memory');
    this.table = { version: 1, windowSize: this.config.memoryWindowSize, items: [] };
  }

  async init(): Promise<void> {
    await mkdir(this.memoryDir, { recursive: true });
    try {
      const raw = await readFile(this.tablePath, 'utf-8');
      this.table = JSON.parse(raw);
    } catch {
      await this.save();
    }
  }

  private get tablePath(): string {
    return join(this.memoryDir, 'memory-table.json');
  }

  async addMemory(content: string, category: MemoryItem['category']): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: crypto.randomUUID(),
      content,
      category,
      sessionsActive: 0,
      cosineSimilarityHits: 0,
      status: 'new',
      createdAt: new Date().toISOString(),
      lastHitAt: null,
    };
    this.table.items.push(item);
    await this.save();
    return item;
  }

  async recordHit(id: string): Promise<void> {
    const item = this.table.items.find(m => m.id === id);
    if (!item) return;

    item.cosineSimilarityHits++;
    item.lastHitAt = new Date().toISOString();

    if (item.status === 'new' || item.status === 'demoting') {
      item.status = 'active';
    }

    // Reset session counter on hit — memory earned its place
    item.sessionsActive = 0;
    await this.save();
  }

  async tickSession(): Promise<void> {
    for (const item of this.table.items) {
      if (item.status === 'archived') continue;

      item.sessionsActive++;

      if (item.sessionsActive >= this.table.windowSize) {
        if (item.cosineSimilarityHits === 0) {
          item.status = 'archived';
        } else if (item.status === 'active') {
          item.status = 'demoting';
          item.sessionsActive = 0;
          item.cosineSimilarityHits = 0;
        } else if (item.status === 'demoting') {
          item.status = 'archived';
        }
      }
    }
    await this.save();
  }

  getActive(): MemoryItem[] {
    return this.table.items.filter(m => m.status === 'active' || m.status === 'new');
  }

  getAll(): MemoryItem[] {
    return this.table.items;
  }

  getByCategory(category: MemoryItem['category']): MemoryItem[] {
    return this.table.items.filter(m => m.category === category && m.status !== 'archived');
  }

  async save(): Promise<void> {
    await writeFile(this.tablePath, JSON.stringify(this.table, null, 2));
  }

  /**
   * Sync memory from decisions.md and missions.md.
   * Parses documents, finds entries not yet in memory, adds them.
   * This is the "write-on-every-action" equivalent — runs at session boundaries
   * so nothing is lost even if the previous session was cut off.
   */
  async syncFromDocs(guideDir: string): Promise<number> {
    let added = 0;

    // ── Sync decisions ──
    try {
      const decisionsPath = join(guideDir, 'decisions.md');
      const raw = await readFile(decisionsPath, 'utf-8');
      const decisions = parseDecisions(raw);

      for (const decision of decisions) {
        if (!this.hasMemory(decision)) {
          await this.addMemory(decision, 'decision');
          added++;
        }
      }
    } catch {}

    // ── Sync completed missions ──
    try {
      const missionsPath = join(guideDir, 'missions.md');
      const raw = await readFile(missionsPath, 'utf-8');
      const completed = parseCompletedMissions(raw);

      for (const mission of completed) {
        const content = `Mission completed: ${mission}`;
        if (!this.hasMemory(content)) {
          await this.addMemory(content, 'progress');
          added++;
        }
      }
    } catch {}

    return added;
  }

  /**
   * Check if a memory with similar content already exists (fuzzy match).
   */
  private hasMemory(content: string): boolean {
    const norm = normalize(content);
    return this.table.items.some(item => {
      const existing = normalize(item.content);
      // Check if the core content overlaps (substring match on normalized text)
      return existing.includes(norm.slice(0, 60)) || norm.includes(existing.slice(0, 60));
    });
  }
}

/**
 * Parse decisions.md into individual decision strings.
 * Handles both formats:
 * - DocWriter: "### timestamp\n**Decision**: X\n**Reason**: Y"
 * - Agent direct: "### [date] Decision: X / Reason: Y"
 */
function parseDecisions(raw: string): string[] {
  const decisions: string[] = [];
  const blocks = raw.split(/^###\s+/m).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    // Try DocWriter format
    const decisionLine = lines.find(l => /^\*?\*?Decision\*?\*?:/.test(l));
    const reasonLine = lines.find(l => /^\*?\*?Reason\*?\*?:/.test(l));

    if (decisionLine) {
      const decision = decisionLine.replace(/^\*?\*?Decision\*?\*?:\s*/, '').trim();
      const reason = reasonLine ? reasonLine.replace(/^\*?\*?Reason\*?\*?:\s*/, '').trim() : '';
      decisions.push(reason ? `${decision} — ${reason}` : decision);
      continue;
    }

    // Try agent direct format: "Decision: X / Reason: Y"
    const directMatch = block.match(/Decision:\s*(.+?)(?:\s*\/\s*Reason:\s*(.+))?$/m);
    if (directMatch) {
      const decision = directMatch[1].trim();
      const reason = directMatch[2]?.trim();
      decisions.push(reason ? `${decision} — ${reason}` : decision);
      continue;
    }

    // Fallback: use the whole block as a decision
    const text = lines.join(' ').slice(0, 200).trim();
    if (text.length > 10) {
      decisions.push(text);
    }
  }

  return decisions;
}

/**
 * Parse missions.md for completed missions (marked ✅).
 */
function parseCompletedMissions(raw: string): string[] {
  const completed: string[] = [];
  const lines = raw.split('\n');

  for (const line of lines) {
    if (line.includes('✅')) {
      const match = line.match(/\*\*\d+\s*—\s*(.+?)\*\*\s*—\s*(.+)/);
      if (match) {
        completed.push(`${match[1].trim()}: ${match[2].trim()}`);
      }
    }
  }

  return completed;
}
