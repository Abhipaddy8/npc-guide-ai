// === Brief ===

export type BriefIntent =
  | 'build'       // Build a codebase / app / feature
  | 'strategy'    // Product strategy, growth, GTM, positioning
  | 'research'    // Investigate, analyze, compare options
  | 'design'      // Architecture, system design, API design
  | 'content'     // Writing, docs, decks, copy
  | 'ops'         // DevOps, CI/CD, infra, deployment
  | 'debug';      // Fix a bug, diagnose an issue

export interface ParsedBrief {
  raw: string;
  projectName: string;
  description: string;
  intent: BriefIntent;
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
  // Build missions
  | 'scaffold'
  | 'core-loop'
  | 'data-layer'
  | 'auth'
  | 'ui'
  | 'integration'
  | 'edge-cases'
  | 'ship'
  // Strategy missions
  | 'landscape'
  | 'positioning'
  | 'growth-engine'
  | 'retention'
  | 'monetization'
  | 'launch-plan'
  // Research missions
  | 'define-scope'
  | 'gather'
  | 'analyze'
  | 'synthesize'
  | 'recommend'
  // Design missions
  | 'requirements'
  | 'system-map'
  | 'interface-design'
  | 'validation'
  // Content missions
  | 'outline'
  | 'draft'
  | 'polish'
  | 'distribute'
  // Ops missions
  | 'audit'
  | 'implement'
  | 'test-verify'
  | 'rollout'
  // Debug missions
  | 'reproduce'
  | 'isolate'
  | 'fix'
  | 'verify-fix';

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
  intent: BriefIntent;
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
