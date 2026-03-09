# npc-guide

**Your repo remembers everything. Your AI never starts from zero.**

Silent mission system that turns AI coding agents (Claude Code, Cursor, Copilot) into autonomous executors with persistent memory. Install it, give it a brief, and your agent stops asking questions and starts building.

## Quick Start

```bash
# Install (silent — creates .ai-guide/, CLAUDE.md, hooks automatically)
npm install https://github.com/Abhipaddy8/npc-guide-ai/releases/download/v0.3.0/npc-guide-0.3.0.tgz

# Initialize with your brief
npx npc-guide init "Build a SaaS dashboard with Next.js and Supabase"

# Open your coding agent and type "go"
```

That's it. The agent reads the mission map and executes autonomously.

## How It Works

1. **Silent install** — postinstall scans your project, seeds memory with deps + structure, wires Claude Code hooks, writes `CLAUDE.md` and `.cursorrules`
2. **Brief parsing** — detects intent (build, strategy, research, debug, etc.) and generates a mission map
3. **Agent builds** — your agent reads the missions and executes. No bookkeeping required — just build.
4. **Hooks observe** — SessionEnd hook runs `git diff`, records what changed, auto-advances missions, writes session summary into memory
5. **Next session** — SessionStart hook injects full context. Agent continues where it left off.

```
⚡ NPC Guide — Mission 2: Core Loop | Session 4 | 12 memories active
```

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
| **Claude Code** | SessionStart/End hooks + CLAUDE.md (full lifecycle with git observation) |
| **Cursor** | .cursorrules |
| **Copilot / Others** | CLAUDE.md (any agent that reads project markdown) |

## No API Required

Zero runtime dependencies. Everything runs locally — regex parsing, TF-IDF memory retrieval, git diffing. No API calls needed.

## Docs

Full documentation, architecture, and changelog: [github.com/Abhipaddy8/npc-guide-ai](https://github.com/Abhipaddy8/npc-guide-ai)

## License

MIT
