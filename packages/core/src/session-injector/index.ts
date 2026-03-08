import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { SessionLog, GuideConfig, DEFAULT_CONFIG } from '../types.js';
import { MemorySystem } from '../memory/index.js';
import { EmbeddingProvider, searchMemories } from '../memory/embeddings.js';

export class SessionInjector {
  private config: GuideConfig;
  private sessionsDir: string;
  private memory: MemorySystem;
  private embedder: EmbeddingProvider | null;

  constructor(memory: MemorySystem, config: Partial<GuideConfig> = {}, embedder?: EmbeddingProvider) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionsDir = join(this.config.projectRoot, this.config.guideDir, 'sessions');
    this.memory = memory;
    this.embedder = embedder ?? null;
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

    // Archive the session
    const archivePath = join(this.sessionsDir, 'archive', `${session.id}.json`);
    await writeFile(archivePath, JSON.stringify(session, null, 2));

    // Update latest
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

    // If embedder available, use semantic search for relevant memories
    if (this.embedder) {
      const activeItems = this.memory.getActive();
      if (activeItems.length > 0) {
        const results = await searchMemories(currentTask, activeItems, this.embedder, 10, 0.3);

        // Record hits for matched memories
        for (const result of results) {
          await this.memory.recordHit(result.item.id);
        }

        if (results.length > 0) {
          sections.push('## Relevant Context (by similarity)\n' +
            results.map(r => `- [${r.score.toFixed(2)}] ${r.item.content}`).join('\n'));
        }
      }
    } else {
      // Fallback: category-based context (no embeddings)
      const archDecisions = this.memory.getByCategory('architecture');
      if (archDecisions.length > 0) {
        sections.push('## Architecture\n' + archDecisions.map(m => `- ${m.content}`).join('\n'));
      }

      const decisions = this.memory.getByCategory('decision');
      if (decisions.length > 0) {
        sections.push('## Decisions\n' + decisions.map(m => `- ${m.content}`).join('\n'));
      }

      const progress = this.memory.getByCategory('progress');
      if (progress.length > 0) {
        sections.push('## Progress\n' + progress.map(m => `- ${m.content}`).join('\n'));
      }
    }

    // Last session summary
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
