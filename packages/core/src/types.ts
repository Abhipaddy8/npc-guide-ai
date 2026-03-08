// === Brief ===

export interface ParsedBrief {
  raw: string;
  projectName: string;
  description: string;
  stack: InferredStack;
  complexity: 'simple' | 'moderate' | 'complex';
  features: string[];
  constraints: string[];
}

export interface InferredStack {
  language: string;
  framework: string | null;
  database: string | null;
  auth: string | null;
  styling: string | null;
  deployment: string | null;
  extras: string[];
}

// === Missions ===

export type MissionType =
  | 'scaffold'
  | 'core-loop'
  | 'data-layer'
  | 'auth'
  | 'ui'
  | 'integration'
  | 'edge-cases'
  | 'ship';

export type MissionStatus = 'locked' | 'active' | 'complete' | 'skipped';

export interface Mission {
  id: number;
  name: string;
  type: MissionType;
  goal: string;
  unlockCondition: string;
  status: MissionStatus;
  tasks: string[];
}

export interface MissionMap {
  projectName: string;
  totalMissions: number;
  missions: Mission[];
  currentMission: number;
}

// === Memory ===

export type MemoryStatus = 'new' | 'active' | 'demoting' | 'archived';

export interface MemoryItem {
  id: string;
  content: string;
  category: 'architecture' | 'decision' | 'progress' | 'context';
  sessionsActive: number;
  cosineSimilarityHits: number;
  status: MemoryStatus;
  createdAt: string;
  lastHitAt: string | null;
}

export interface MemoryTable {
  version: number;
  windowSize: number;
  items: MemoryItem[];
}

// === Sessions ===

export interface SessionLog {
  id: string;
  startedAt: string;
  endedAt: string | null;
  missionId: number;
  toolCalls: string[];
  decisions: string[];
  thinkingChain: string[];
  filesChanged: string[];
  summary: string | null;
}

// === Guide Config ===

export interface GuideConfig {
  projectRoot: string;
  guideDir: string;
  llmProvider: 'openai' | 'anthropic';
  llmModel: string;
  maxMissions: number;
  memoryWindowSize: number;
}

export const DEFAULT_CONFIG: GuideConfig = {
  projectRoot: process.cwd(),
  guideDir: '.ai-guide',
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  maxMissions: 8,
  memoryWindowSize: 15,
};
