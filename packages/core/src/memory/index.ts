import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { MemoryTable, MemoryItem, MemoryStatus, GuideConfig, DEFAULT_CONFIG } from '../types.js';

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
}
