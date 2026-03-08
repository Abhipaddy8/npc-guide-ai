# npc-guide

**Your repo remembers everything. Your AI never starts from zero.**

Silent mission system that turns AI coding agents (Claude Code, Cursor, Copilot) into autonomous executors. Install it, give it a brief, and your agent stops asking questions and starts building.

## Quick Start

```bash
# Install (silent — creates .ai-guide/, CLAUDE.md, hooks automatically)
npm install https://github.com/Abhipaddy8/npc-guide-ai/releases/download/v0.1.0/npc-guide-0.1.0.tgz

# Initialize with your brief
npx npc-guide init "Build a SaaS dashboard with Next.js and Supabase"

# Open your coding agent and type "go"
```

That's it. The agent reads the mission map and executes autonomously.

## What It Does

1. **Silent install** — postinstall creates `.ai-guide/`, wires Claude Code hooks, writes `CLAUDE.md` and `.cursorrules`
2. **Brief parsing** — detects intent (build, strategy, research, debug, etc.) and generates a mission map
3. **Agent direction** — your agent reads the missions and executes without asking questions
4. **Session memory** — every session is archived, every decision logged, agent picks up where it left off

## 7 Intent Types

| Intent | Mission Sequence |
|---|---|
| **build** | Foundation → Core Loop → Data → Auth → UI → Integration → Ship |
| **strategy** | Landscape → Positioning → Growth → Retention → Monetization → Launch |
| **research** | Scope → Gather → Analyze → Synthesize → Recommend |
| **design** | Requirements → System Map → Interface → Validation |
| **content** | Outline → Draft → Polish → Distribute |
| **ops** | Audit → Implement → Test → Rollout |
| **debug** | Reproduce → Isolate → Fix → Verify |

## Agent Support

| Agent | Integration |
|---|---|
| **Claude Code** | SessionStart/End hooks + CLAUDE.md (full lifecycle) |
| **Cursor** | .cursorrules |
| **Copilot / Others** | CLAUDE.md (any agent that reads project markdown) |

## No API Required

Default parser is pure regex — works offline, instantly. LLM parsing (OpenAI/Anthropic/OpenRouter) is optional for richer results.

## Docs

Full documentation, architecture, and live test results: [github.com/Abhipaddy8/npc-guide-ai](https://github.com/Abhipaddy8/npc-guide-ai)

## License

MIT
