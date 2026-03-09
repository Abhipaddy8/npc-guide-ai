import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { SessionLog, GuideConfig, DEFAULT_CONFIG } from '../types.js';
import { MemorySystem } from '../memory/index.js';
import { retrieveRelevantMemories } from '../memory/retriever.js';

export class SessionInjector {
  private config: GuideConfig;
  private sessionsDir: string;
  private memory: MemorySystem;

  constructor(memory: MemorySystem, config: Partial<GuideConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionsDir = join(this.config.projectRoot, this.config.guideDir, 'sessions');
    this.memory = memory;
  }

  async init(): Promise<void> {
    await mkdir(join(this.sessionsDir, 'archive'), { recursive: true });
  }

  async startSession(missionId: number): Promise<SessionLog> {
    const session: SessionLog = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      missionId,
      toolCalls: [],
      decisions: [],
      thinkingChain: [],
      filesChanged: [],
      summary: null,
    };

    await this.writeLatest(session);
    await this.memory.tickSession();
    return session;
  }

  async endSession(session: SessionLog): Promise<void> {
    session.endedAt = new Date().toISOString();

    const archivePath = join(this.sessionsDir, 'archive', `${session.id}.json`);
    await writeFile(archivePath, JSON.stringify(session, null, 2));

    await this.writeLatest(session);
  }

  async getLatest(): Promise<SessionLog | null> {
    try {
      const raw = await readFile(join(this.sessionsDir, 'latest.json'), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async buildContext(currentTask: string): Promise<string> {
    const latest = await this.getLatest();
    const sections: string[] = [];

    // TF-IDF cosine similarity — pure local, no API
    const activeItems = this.memory.getAll().filter(m => m.status !== 'archived');
    if (activeItems.length > 0) {
      const results = retrieveRelevantMemories(currentTask, activeItems, 10, 0.05);

      for (const result of results) {
        await this.memory.recordHit(result.item.id);
      }

      if (results.length > 0) {
        sections.push('## Relevant Context\n' +
          results.map(r => `- [${r.score.toFixed(2)}] ${r.item.content}`).join('\n'));
      }
    }

    if (latest?.summary) {
      sections.push(`## Last Session\n${latest.summary}`);
    }

    return sections.join('\n\n');
  }

  private async writeLatest(session: SessionLog): Promise<void> {
    const latestPath = join(this.sessionsDir, 'latest.json');
    await writeFile(latestPath, JSON.stringify(session, null, 2));
  }
}
