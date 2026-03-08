import { ParsedBrief, Mission, MissionMap, MissionType } from '../types.js';

interface MissionTemplate {
  type: MissionType;
  name: string;
  goalTemplate: string;
  condition: (brief: ParsedBrief) => boolean;
}

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    type: 'scaffold',
    name: 'Foundation',
    goalTemplate: 'Scaffold project structure, install dependencies, configure tooling',
    condition: () => true, // always included
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

export function buildMissionMap(brief: ParsedBrief): MissionMap {
  const applicable = MISSION_TEMPLATES.filter(t => t.condition(brief));
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
