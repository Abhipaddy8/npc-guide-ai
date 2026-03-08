# Architecture — NPC Guide AI

**Project**: npc-guide-ai
**Type**: Silent npm package — mission system for AI coding agents
**Language**: TypeScript (ESM)
**Structure**: npm workspaces monorepo
**Complexity**: complex

## One-Liner
Your repo remembers everything. Your AI never starts from zero.

## What It Does
Installs silently into any coding agent environment. Intercepts the user's brief, structures it into missions, directs the coding agent autonomously, and remembers everything across sessions. The user never talks to the coding agent directly — the Guide handles that.

## How It Works
```
npm install npc-guide          → postinstall creates .ai-guide/, hooks, CLAUDE.md, .cursorrules
npx npc-guide init "brief"     → parses brief, detects intent, generates mission map
[user opens coding agent]      → SessionStart hook injects memory + missions into agent context
[agent executes missions]      → reads .ai-guide/missions.md, follows CLAUDE.md orders
[session ends]                 → SessionEnd hook archives session
[next session]                 → agent picks up where it left off with full context
```

## Monorepo Structure
```
packages/
├── core/                      ← ALL logic lives here
│   └── src/
│       ├── types.ts           — Full type system (7 intents, mission types, memory scoring)
│       ├── brief-parser/
│       │   ├── index.ts       — Regex parser (offline, no API needed)
│       │   └── llm-parser.ts  — LLM parser (OpenRouter/OpenAI/Anthropic)
│       ├── mission-architect/
│       │   ├── index.ts       — Intent-specific mission templates (7 types × custom sequences)
│       │   └── task-generator.ts — LLM task generation per mission
│       ├── memory/
│       │   ├── index.ts       — 15-session window, promote/demote/archive scoring
│       │   ├── embeddings.ts  — Cosine similarity + semantic search
│       │   └── doc-writer.ts  — Writes architecture.md, decisions.md, missions.md
│       ├── session-injector/  — Session lifecycle + context builder
│       ├── agent-instructor/  — Generates formatted instructions per mission
│       ├── hooks/
│       │   ├── session-start.ts — Injects context into agent via stdout
│       │   ├── session-end.ts   — Archives session
│       │   └── init.ts          — One-time brief processor (npx npc-guide init)
│       ├── installer/
│       │   └── index.ts       — Postinstall: creates .ai-guide/, hooks, CLAUDE.md, .cursorrules
│       └── index.ts           — NpcGuide orchestrator class
├── claude-code/               ← MCP server (5 tools)
│   └── src/index.ts           — process_brief, complete_mission, get_current_mission, log_decision, get_context
└── cli/                       ← Interactive CLI (debug/demo tool)
    └── src/index.ts           — REPL with .env loading
```

## The .ai-guide/ Folder (Generated Per Project)
```
.ai-guide/
├── architecture.md            — Stack, features, file structure
├── missions.md                — Mission map with status (▶️ active, ✅ complete, 🔒 locked)
├── decisions.md               — Every architectural decision with reasoning
├── sessions/
│   ├── latest.json            — Last session summary, files changed, blockers
│   └── archive/               — Timestamped past sessions
└── memory/
    └── memory-table.json      — Scored memory items (15-session window)
```

## 7 Intent Types
| Intent | Mission Sequence |
|---|---|
| build | Foundation → Core Loop → Data Layer → Auth → UI → Integration → Ship |
| strategy | Landscape → Positioning → Growth Engine → Retention → Monetization → Launch Plan |
| research | Define Scope → Gather → Analyze → Synthesize → Recommend |
| design | Requirements → System Map → Interface Design → Validation |
| content | Outline → Draft → Polish → Distribute |
| ops | Audit → Implement → Test & Verify → Rollout |
| debug | Reproduce → Isolate → Fix → Verify |

## Agent Integration
| Agent | How It Integrates |
|---|---|
| Claude Code | SessionStart/End hooks in .claude/settings.json + CLAUDE.md |
| Cursor | .cursorrules |
| Copilot / Others | CLAUDE.md (agent-agnostic fallback) |

## What's Proven (Live Tested 2026-03-08)
- Silent install → postinstall creates everything
- Intent detection → all 7 types route correctly
- Agent autonomy → user said "go", agent executed 2 missions without input
- Session continuity → closed terminal, reopened, agent continued at Mission 2
- Self-debugging → found 3 bugs from cut session, fixed all
- Decision logging → agent writes to decisions.md with reasoning
- Mission self-advancement → agent updates missions.md itself

## Not Yet Working
- decisions.md logging is inconsistent (worked in session 2, not session 1)
- Memory scoring (cosine similarity) needs embeddings API wired
- Not published to npm
- Cursor/.cursorrules untested
- No "Built with NPC Guide" badge generator
