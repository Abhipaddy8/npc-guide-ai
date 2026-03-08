import { ParsedBrief, Mission, MissionMap, MissionType, BriefIntent } from '../types.js';

interface MissionTemplate {
  type: MissionType;
  name: string;
  goalTemplate: string;
  condition: (brief: ParsedBrief) => boolean;
}

// ============================================================
// INTENT-SPECIFIC MISSION TEMPLATES
// ============================================================

const BUILD_MISSIONS: MissionTemplate[] = [
  {
    type: 'scaffold',
    name: 'Foundation',
    goalTemplate: 'Scaffold project structure, install dependencies, configure tooling',
    condition: () => true,
  },
  {
    type: 'core-loop',
    name: 'Core Loop',
    goalTemplate: 'Build the primary feature that defines the product',
    condition: () => true,
  },
  {
    type: 'data-layer',
    name: 'Data Layer',
    goalTemplate: 'Set up database schema, models, and data access',
    condition: (b) => !!b.stack.database,
  },
  {
    type: 'auth',
    name: 'Identity',
    goalTemplate: 'Implement authentication and authorization',
    condition: (b) => !!b.stack.auth || b.features.some(f => /auth|login|sign.?up|user/i.test(f)),
  },
  {
    type: 'ui',
    name: 'UI Shell',
    goalTemplate: 'Build the user interface and navigation',
    condition: (b) => !!b.stack.framework && !['Express', 'Fastify'].includes(b.stack.framework),
  },
  {
    type: 'integration',
    name: 'Integration',
    goalTemplate: 'Connect all layers, wire APIs, handle data flow',
    condition: (b) => b.complexity !== 'simple',
  },
  {
    type: 'edge-cases',
    name: 'Edge Cases',
    goalTemplate: 'Error handling, validation, edge case coverage',
    condition: (b) => b.complexity === 'complex',
  },
  {
    type: 'ship',
    name: 'Ship',
    goalTemplate: 'Build config, deployment setup, final checks',
    condition: () => true,
  },
];

const STRATEGY_MISSIONS: MissionTemplate[] = [
  {
    type: 'landscape',
    name: 'Landscape',
    goalTemplate: 'Map the current state — what exists, who the users are, what the market looks like',
    condition: () => true,
  },
  {
    type: 'positioning',
    name: 'Positioning',
    goalTemplate: 'Define what makes this different — the angle, the story, the one-liner that lands',
    condition: () => true,
  },
  {
    type: 'growth-engine',
    name: 'Growth Engine',
    goalTemplate: 'Design the organic discovery and virality mechanics — how users find and share this',
    condition: () => true,
  },
  {
    type: 'retention',
    name: 'Retention & Stickiness',
    goalTemplate: 'Design the hooks that make users come back — compounding value, habits, switching costs',
    condition: () => true,
  },
  {
    type: 'monetization',
    name: 'Monetization',
    goalTemplate: 'Define free vs paid, pricing model, revenue mechanics',
    condition: (b) => b.features.some(f => /monetiz|pricing|paid|revenue|freemium|subscription/i.test(f)) || b.complexity !== 'simple',
  },
  {
    type: 'launch-plan',
    name: 'Launch Plan',
    goalTemplate: 'Concrete launch sequence — channels, timing, assets needed, first 100 users',
    condition: () => true,
  },
];

const RESEARCH_MISSIONS: MissionTemplate[] = [
  {
    type: 'define-scope',
    name: 'Define Scope',
    goalTemplate: 'Clarify the research questions — what exactly do we need to know and why',
    condition: () => true,
  },
  {
    type: 'gather',
    name: 'Gather',
    goalTemplate: 'Collect data, sources, examples, and evidence',
    condition: () => true,
  },
  {
    type: 'analyze',
    name: 'Analyze',
    goalTemplate: 'Process the data — find patterns, compare options, identify tradeoffs',
    condition: () => true,
  },
  {
    type: 'synthesize',
    name: 'Synthesize',
    goalTemplate: 'Combine findings into a clear narrative with supporting evidence',
    condition: () => true,
  },
  {
    type: 'recommend',
    name: 'Recommend',
    goalTemplate: 'Make specific, actionable recommendations backed by the analysis',
    condition: () => true,
  },
];

const DESIGN_MISSIONS: MissionTemplate[] = [
  {
    type: 'requirements',
    name: 'Requirements',
    goalTemplate: 'Define what the system needs to do — functional and non-functional requirements',
    condition: () => true,
  },
  {
    type: 'system-map',
    name: 'System Map',
    goalTemplate: 'Design the high-level architecture — components, boundaries, data flow',
    condition: () => true,
  },
  {
    type: 'interface-design',
    name: 'Interface Design',
    goalTemplate: 'Define the contracts — APIs, schemas, protocols, message formats',
    condition: () => true,
  },
  {
    type: 'validation',
    name: 'Validation',
    goalTemplate: 'Stress-test the design — edge cases, failure modes, scalability concerns',
    condition: (b) => b.complexity !== 'simple',
  },
];

const CONTENT_MISSIONS: MissionTemplate[] = [
  {
    type: 'outline',
    name: 'Outline',
    goalTemplate: 'Structure the content — key points, flow, audience considerations',
    condition: () => true,
  },
  {
    type: 'draft',
    name: 'Draft',
    goalTemplate: 'Write the full first draft — substance over polish',
    condition: () => true,
  },
  {
    type: 'polish',
    name: 'Polish',
    goalTemplate: 'Refine tone, tighten language, add examples, make it land',
    condition: () => true,
  },
  {
    type: 'distribute',
    name: 'Distribute',
    goalTemplate: 'Format for target channels, create variants, prepare for publishing',
    condition: (b) => b.complexity !== 'simple',
  },
];

const OPS_MISSIONS: MissionTemplate[] = [
  {
    type: 'audit',
    name: 'Audit',
    goalTemplate: 'Assess current state — what exists, what is broken, what is missing',
    condition: () => true,
  },
  {
    type: 'implement',
    name: 'Implement',
    goalTemplate: 'Build the infrastructure, pipelines, and configurations',
    condition: () => true,
  },
  {
    type: 'test-verify',
    name: 'Test & Verify',
    goalTemplate: 'Validate everything works — dry runs, smoke tests, rollback procedures',
    condition: () => true,
  },
  {
    type: 'rollout',
    name: 'Rollout',
    goalTemplate: 'Go live — gradual rollout, monitoring, documentation',
    condition: () => true,
  },
];

const DEBUG_MISSIONS: MissionTemplate[] = [
  {
    type: 'reproduce',
    name: 'Reproduce',
    goalTemplate: 'Reproduce the issue reliably — understand the exact conditions',
    condition: () => true,
  },
  {
    type: 'isolate',
    name: 'Isolate',
    goalTemplate: 'Narrow down the root cause — eliminate possibilities systematically',
    condition: () => true,
  },
  {
    type: 'fix',
    name: 'Fix',
    goalTemplate: 'Implement the fix — minimal, targeted change that addresses the root cause',
    condition: () => true,
  },
  {
    type: 'verify-fix',
    name: 'Verify',
    goalTemplate: 'Confirm the fix works — test the original case plus related edge cases',
    condition: () => true,
  },
];

// ============================================================
// TEMPLATE ROUTER
// ============================================================

const MISSION_TEMPLATES_BY_INTENT: Record<BriefIntent, MissionTemplate[]> = {
  build: BUILD_MISSIONS,
  strategy: STRATEGY_MISSIONS,
  research: RESEARCH_MISSIONS,
  design: DESIGN_MISSIONS,
  content: CONTENT_MISSIONS,
  ops: OPS_MISSIONS,
  debug: DEBUG_MISSIONS,
};

// ============================================================
// PUBLIC API
// ============================================================

export function buildMissionMap(brief: ParsedBrief): MissionMap {
  const templates = MISSION_TEMPLATES_BY_INTENT[brief.intent] || BUILD_MISSIONS;
  const applicable = templates.filter(t => t.condition(brief));
  const capped = applicable.slice(0, 8);

  const missions: Mission[] = capped.map((template, i) => ({
    id: i + 1,
    name: `${i + 1} — ${template.name}`,
    type: template.type,
    goal: template.goalTemplate,
    unlockCondition: i === 0 ? 'Start' : `Mission ${i} complete`,
    status: i === 0 ? 'active' : 'locked',
    tasks: [],
  }));

  return {
    projectName: brief.projectName,
    intent: brief.intent,
    totalMissions: missions.length,
    missions,
    currentMission: 1,
  };
}

export function advanceMission(map: MissionMap): MissionMap {
  const current = map.missions.find(m => m.id === map.currentMission);
  if (!current) return map;

  current.status = 'complete';

  const next = map.missions.find(m => m.id === map.currentMission + 1);
  if (next) {
    next.status = 'active';
    map.currentMission = next.id;
  }

  return map;
}

export function skipMission(map: MissionMap, missionId: number): MissionMap {
  const mission = map.missions.find(m => m.id === missionId);
  if (mission) {
    mission.status = 'skipped';
  }
  return map;
}

export function getCurrentMission(map: MissionMap): Mission | null {
  return map.missions.find(m => m.status === 'active') ?? null;
}
