export * from './types.js';
export { parseBrief } from './brief-parser/index.js';
export { buildMissionMap, advanceMission, skipMission, getCurrentMission } from './mission-architect/index.js';
export { MemorySystem } from './memory/index.js';
export { DocWriter } from './memory/doc-writer.js';
export { scanProject, formatScanOutput } from './project-scanner/index.js';
export { retrieveRelevantMemories } from './memory/retriever.js';
export type { RetrievalResult } from './memory/retriever.js';
export type { ProjectScan } from './project-scanner/index.js';
export { SessionInjector } from './session-injector/index.js';
export { generateInstruction, formatInstructionForAgent } from './agent-instructor/index.js';

import { parseBrief } from './brief-parser/index.js';
import { buildMissionMap, getCurrentMission, advanceMission } from './mission-architect/index.js';
import { MemorySystem } from './memory/index.js';
import { DocWriter } from './memory/doc-writer.js';
import { SessionInjector } from './session-injector/index.js';
import { generateInstruction, formatInstructionForAgent } from './agent-instructor/index.js';
import { GuideConfig, DEFAULT_CONFIG, MissionMap, ParsedBrief } from './types.js';

export class NpcGuide {
  private config: GuideConfig;
  private memory: MemorySystem;
  private session: SessionInjector;
  private docs: DocWriter;
  private _missionMap: MissionMap | null = null;
  private _brief: ParsedBrief | null = null;

  constructor(config: Partial<GuideConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memory = new MemorySystem(this.config);
    this.session = new SessionInjector(this.memory, this.config);
    this.docs = new DocWriter(this.config);
  }

  async init(): Promise<void> {
    await this.memory.init();
    await this.session.init();
    await this.docs.init();
  }

  async processBrief(rawBrief: string): Promise<string> {
    const brief = parseBrief(rawBrief);
    this._brief = brief;

    let missionMap = buildMissionMap(brief);
    this._missionMap = missionMap;

    const currentMission = getCurrentMission(missionMap);
    if (!currentMission) {
      return 'All missions complete.';
    }

    await this.docs.writeArchitecture(brief);
    await this.docs.writeMissionMap(missionMap);

    // Seed memory — project identity + raw brief for agent to interpret
    await this.memory.addMemory(`Project: ${brief.projectName}. Intent: ${brief.intent}`, 'architecture');
    const stackParts = [brief.stack.language, brief.stack.framework, brief.stack.database, brief.stack.auth, brief.stack.styling, brief.stack.deployment, ...brief.stack.extras].filter(Boolean);
    if (stackParts.length > 0) {
      await this.memory.addMemory(`Stack: ${stackParts.join(', ')}`, 'architecture');
    }

    await this.session.startSession(currentMission.id);
    const context = await this.session.buildContext(rawBrief);

    const instruction = generateInstruction(currentMission, brief, context);
    return formatInstructionForAgent(instruction);
  }

  async completeMission(summary: string): Promise<string> {
    if (!this._missionMap || !this._brief) {
      return 'No active mission map. Process a brief first.';
    }

    await this.memory.addMemory(
      `Mission ${this._missionMap.currentMission} complete: ${summary}`,
      'progress'
    );

    this._missionMap = advanceMission(this._missionMap);
    await this.docs.writeMissionMap(this._missionMap);

    const next = getCurrentMission(this._missionMap);
    if (!next) {
      return 'All missions complete. Project is ready to ship.';
    }

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
