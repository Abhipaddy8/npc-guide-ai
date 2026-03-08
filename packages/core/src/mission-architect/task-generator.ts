import { Mission, ParsedBrief } from '../types.js';
import { LLMProvider } from '../brief-parser/llm-parser.js';

const SYSTEM_PROMPT = `You are a game director breaking a mission into concrete tasks for a coding agent.

Given a mission and project context, return a JSON array of task strings. Each task should be:
- A single, specific action the coding agent can execute
- Written as an imperative ("Create...", "Add...", "Configure...")
- Ordered by dependency (do X before Y)
- 3-8 tasks per mission — no more

Return ONLY a JSON array of strings. No markdown, no explanation.

Example:
["Create Next.js project with TypeScript", "Install and configure Tailwind CSS", "Set up project folder structure", "Add ESLint and Prettier config", "Create .env.example with required variables"]`;

export async function generateTasks(
  mission: Mission,
  brief: ParsedBrief,
  provider: LLMProvider
): Promise<string[]> {
  const prompt = `
Mission: ${mission.name}
Goal: ${mission.goal}
Project: ${brief.projectName}
Stack: ${brief.stack.language}, ${brief.stack.framework || 'none'}, ${brief.stack.database || 'none'}
Features: ${brief.features.join(', ')}
Complexity: ${brief.complexity}
`;

  const response = await provider.complete(SYSTEM_PROMPT, prompt);
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const tasks = JSON.parse(cleaned);
    if (Array.isArray(tasks)) return tasks.slice(0, 8);
  } catch {
    // Fallback: split by newlines
    return response.split('\n').filter(l => l.trim().length > 0).slice(0, 8);
  }

  return [];
}

export async function enrichMissionMap(
  missions: Mission[],
  brief: ParsedBrief,
  provider: LLMProvider
): Promise<Mission[]> {
  // Generate tasks for all missions in parallel
  const enriched = await Promise.all(
    missions.map(async (mission) => {
      const tasks = await generateTasks(mission, brief, provider);
      return { ...mission, tasks };
    })
  );

  return enriched;
}
