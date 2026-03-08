#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  NpcGuide,
  parseBrief,
  buildMissionMap,
  advanceMission,
  getCurrentMission,
  generateInstruction,
  formatInstructionForAgent,
} from '@npc-guide/core';

const guide = new NpcGuide({ projectRoot: process.cwd() });

const server = new Server(
  { name: 'npc-guide', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'process_brief',
      description: 'Process a project brief and generate the mission map + first instruction. Call this with the user\'s initial project description.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          brief: { type: 'string', description: 'The user\'s project brief / description' },
        },
        required: ['brief'],
      },
    },
    {
      name: 'complete_mission',
      description: 'Mark the current mission as complete and get the next mission instruction.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          summary: { type: 'string', description: 'Summary of what was accomplished in this mission' },
        },
        required: ['summary'],
      },
    },
    {
      name: 'get_current_mission',
      description: 'Get the current active mission and its instruction.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'log_decision',
      description: 'Log an architectural decision made during the current mission.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          decision: { type: 'string', description: 'What was decided' },
          reason: { type: 'string', description: 'Why this decision was made' },
        },
        required: ['decision', 'reason'],
      },
    },
    {
      name: 'get_context',
      description: 'Get all relevant context from memory for the current task.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: { type: 'string', description: 'Description of current task for semantic search' },
        },
        required: ['task'],
      },
    },
  ],
}));

// State held in memory for the session
let currentBrief: ReturnType<typeof parseBrief> | null = null;
let currentMap: ReturnType<typeof buildMissionMap> | null = null;

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'process_brief': {
      await guide.init();
      const brief = parseBrief(args.brief as string);
      const map = buildMissionMap(brief);
      currentBrief = brief;
      currentMap = map;

      const mission = getCurrentMission(map);
      if (!mission) {
        return { content: [{ type: 'text', text: 'No missions generated.' }] };
      }

      const context = await guide.getSession().buildContext(args.brief as string);
      const instruction = generateInstruction(mission, brief, context);
      const output = formatInstructionForAgent(instruction);

      // Log to memory
      await guide.getMemory().addMemory(
        `Project: ${brief.projectName}. Stack: ${brief.stack.language}/${brief.stack.framework}. DB: ${brief.stack.database}`,
        'architecture'
      );

      const missionList = map.missions
        .map(m => `${m.status === 'active' ? '▶' : '○'} ${m.name}`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `# Mission Map\n\n${missionList}\n\n${output}`,
        }],
      };
    }

    case 'complete_mission': {
      if (!currentMap || !currentBrief) {
        return { content: [{ type: 'text', text: 'No active mission map. Run process_brief first.' }] };
      }

      // Log progress
      await guide.getMemory().addMemory(
        `Mission ${currentMap.currentMission} complete: ${args.summary}`,
        'progress'
      );

      // Advance
      currentMap = advanceMission(currentMap);
      const next = getCurrentMission(currentMap);

      if (!next) {
        return { content: [{ type: 'text', text: '🏁 All missions complete. Project is ready to ship.' }] };
      }

      const context = await guide.getSession().buildContext(next.goal);
      const instruction = generateInstruction(next, currentBrief, context);

      return {
        content: [{
          type: 'text',
          text: formatInstructionForAgent(instruction),
        }],
      };
    }

    case 'get_current_mission': {
      if (!currentMap || !currentBrief) {
        return { content: [{ type: 'text', text: 'No active mission map.' }] };
      }

      const mission = getCurrentMission(currentMap);
      if (!mission) {
        return { content: [{ type: 'text', text: 'All missions complete.' }] };
      }

      const context = await guide.getSession().buildContext(mission.goal);
      const instruction = generateInstruction(mission, currentBrief, context);

      return {
        content: [{ type: 'text', text: formatInstructionForAgent(instruction) }],
      };
    }

    case 'log_decision': {
      await guide.getMemory().addMemory(
        `${args.decision}: ${args.reason}`,
        'decision'
      );

      return {
        content: [{ type: 'text', text: `Decision logged: ${args.decision}` }],
      };
    }

    case 'get_context': {
      await guide.init();
      const context = await guide.getSession().buildContext(args.task as string);
      return {
        content: [{ type: 'text', text: context || 'No context available yet.' }],
      };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
