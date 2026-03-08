import { Mission, MissionMap, ParsedBrief } from '../types.js';

export interface Instruction {
  role: 'guide';
  missionId: number;
  missionName: string;
  directive: string;
  context: string;
  constraints: string[];
}

export function generateInstruction(
  mission: Mission,
  brief: ParsedBrief,
  sessionContext: string
): Instruction {
  const directive = buildDirective(mission, brief);

  return {
    role: 'guide',
    missionId: mission.id,
    missionName: mission.name,
    directive,
    context: sessionContext,
    constraints: [
      'Do not ask the user questions — infer from context.',
      'Complete this mission fully before moving on.',
      'Log every architectural decision you make.',
      `Stack: ${formatStack(brief)}`,
      ...brief.constraints,
    ],
  };
}

function buildDirective(mission: Mission, brief: ParsedBrief): string {
  const base = `MISSION: ${mission.name}\nGOAL: ${mission.goal}\n`;

  const taskBlock = mission.tasks.length > 0
    ? `\nTASKS:\n${mission.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  const featureBlock = brief.features.length > 0
    ? `\nFEATURES TO CONSIDER:\n${brief.features.map(f => `- ${f}`).join('\n')}`
    : '';

  return base + taskBlock + featureBlock;
}

function formatStack(brief: ParsedBrief): string {
  const parts: string[] = [brief.stack.language];
  if (brief.stack.framework) parts.push(brief.stack.framework);
  if (brief.stack.database) parts.push(brief.stack.database);
  if (brief.stack.auth) parts.push(brief.stack.auth);
  if (brief.stack.styling) parts.push(brief.stack.styling);
  if (brief.stack.deployment) parts.push(brief.stack.deployment);
  parts.push(...brief.stack.extras);
  return parts.join(' + ');
}

export function formatInstructionForAgent(instruction: Instruction): string {
  return `
---
# NPC GUIDE — Mission ${instruction.missionId}
## ${instruction.missionName}

${instruction.directive}

## Context from Memory
${instruction.context || 'First session — no prior context.'}

## Constraints
${instruction.constraints.map(c => `- ${c}`).join('\n')}
---
`.trim();
}
