export * from './types.js';
export { parseBrief } from './brief-parser/index.js';
export { parseBriefWithLLM, OpenAIProvider, AnthropicProvider } from './brief-parser/llm-parser.js';
export type { LLMProvider } from './brief-parser/llm-parser.js';
export { buildMissionMap, advanceMission, skipMission, getCurrentMission } from './mission-architect/index.js';
export { generateTasks, enrichMissionMap } from './mission-architect/task-generator.js';
export { MemorySystem } from './memory/index.js';
export { cosineSimilarity, searchMemories, OpenAIEmbeddings } from './memory/embeddings.js';
export type { EmbeddingProvider, ScoredMemory } from './memory/embeddings.js';
export { DocWriter } from './memory/doc-writer.js';
export { SessionInjector } from './session-injector/index.js';
export { generateInstruction, formatInstructionForAgent } from './agent-instructor/index.js';

import { parseBrief } from './brief-parser/index.js';
import { parseBriefWithLLM, LLMProvider } from './brief-parser/llm-parser.js';
import { buildMissionMap, getCurrentMission, advanceMission } from './mission-architect/index.js';
import { enrichMissionMap } from './mission-architect/task-generator.js';
import { MemorySystem } from './memory/index.js';
import { EmbeddingProvider } from './memory/embeddings.js';
import { DocWriter } from './memory/doc-writer.js';
import { SessionInjector } from './session-injector/index.js';
import { generateInstruction, formatInstructionForAgent } from './agent-instructor/index.js';
import { GuideConfig, DEFAULT_CONFIG, MissionMap, ParsedBrief } from './types.js';

export class NpcGuide {
  private config: GuideConfig;
  private memory: MemorySystem;
  private session: SessionInjector;
  private docs: DocWriter;
  private llm: LLMProvider | null;
  private embedder: EmbeddingProvider | null;
  private _missionMap: MissionMap | null = null;
  private _brief: ParsedBrief | null = null;

  constructor(
    config: Partial<GuideConfig> = {},
    llm?: LLMProvider,
    embedder?: EmbeddingProvider
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memory = new MemorySystem(this.config);
    this.embedder = embedder ?? null;
    this.session = new SessionInjector(this.memory, this.config, this.embedder ?? undefined);
    this.docs = new DocWriter(this.config);
    this.llm = llm ?? null;
  }

  async init(): Promise<void> {
    await this.memory.init();
    await this.session.init();
    await this.docs.init();
  }

  async processBrief(rawBrief: string): Promise<string> {
    // Parse brief — use LLM if available, otherwise regex
    const brief = this.llm
      ? await parseBriefWithLLM(rawBrief, this.llm)
      : parseBrief(rawBrief);

    this._brief = brief;

    // Build mission map
    let missionMap = buildMissionMap(brief);

    // Enrich with LLM-generated tasks if available
    if (this.llm) {
      missionMap.missions = await enrichMissionMap(missionMap.missions, brief, this.llm);
    }

    this._missionMap = missionMap;

    const currentMission = getCurrentMission(missionMap);
    if (!currentMission) {
      return 'All missions complete.';
    }

    // Write docs
    await this.docs.writeArchitecture(brief);
    await this.docs.writeMissionMap(missionMap);

    // Log to memory
    await this.memory.addMemory(
      `Project: ${brief.projectName}. Stack: ${brief.stack.language}/${brief.stack.framework}. DB: ${brief.stack.database}`,
      'architecture'
    );

    // Start session
    await this.session.startSession(currentMission.id);
    const context = await this.session.buildContext(rawBrief);

    // Generate instruction
    const instruction = generateInstruction(currentMission, brief, context);
    return formatInstructionForAgent(instruction);
  }

  async completeMission(summary: string): Promise<string> {
    if (!this._missionMap || !this._brief) {
      return 'No active mission map. Process a brief first.';
    }

    // Log progress
    await this.memory.addMemory(
      `Mission ${this._missionMap.currentMission} complete: ${summary}`,
      'progress'
    );

    // Advance
    this._missionMap = advanceMission(this._missionMap);
    await this.docs.writeMissionMap(this._missionMap);

    const next = getCurrentMission(this._missionMap);
    if (!next) {
      return 'All missions complete. Project is ready to ship.';
    }

    // Start new session for next mission
    await this.session.startSession(next.id);
    const context = await this.session.buildContext(next.goal);
    const instruction = generateInstruction(next, this._brief, context);
    return formatInstructionForAgent(instruction);
  }

  async logDecision(decision: string, reason: string): Promise<void> {
    await this.memory.addMemory(`${decision}: ${reason}`, 'decision');
    await this.docs.appendDecision(decision, reason);
  }

  getMemory(): MemorySystem {
    return this.memory;
  }

  getSession(): SessionInjector {
    return this.session;
  }

  getMissionMap(): MissionMap | null {
    return this._missionMap;
  }

  getBrief(): ParsedBrief | null {
    return this._brief;
  }
}
