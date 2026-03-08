# npc-guide

Your repo remembers everything. Your AI never starts from zero.

Silent mission system that installs into any AI coding agent (Claude Code, Cursor, Copilot). Intercepts your brief, structures it into missions, directs the agent autonomously, and remembers everything across sessions.

## Install

```bash
npm install npc-guide
```

This silently creates `.ai-guide/`, wires Claude Code hooks, writes `CLAUDE.md` and `.cursorrules`. No config needed.

## Initialize

```bash
npx npc-guide init "Build a SaaS dashboard with Next.js and Supabase"
```

This parses your brief, detects intent, and generates a mission map.

## Then just open your coding agent

The agent reads `.ai-guide/missions.md`, finds the active mission, and starts executing. No interaction needed.

## 7 Intent Types

| Intent | What it does |
|---|---|
| build | Scaffold → Core Loop → Data → Auth → UI → Integration → Ship |
| strategy | Landscape → Positioning → Growth → Retention → Monetization → Launch |
| research | Scope → Gather → Analyze → Synthesize → Recommend |
| design | Requirements → System Map → Interface → Validation |
| content | Outline → Draft → Polish → Distribute |
| ops | Audit → Implement → Test → Rollout |
| debug | Reproduce → Isolate → Fix → Verify |

## How it works

```
npm install npc-guide       → postinstall creates .ai-guide/, hooks, CLAUDE.md
npx npc-guide init "brief"  → parses brief, generates mission map
[open coding agent]          → agent reads missions, executes autonomously
[close terminal]             → session archived
[reopen]                     → agent picks up where it left off
```

## What gets created

```
.ai-guide/
├── architecture.md      — Stack, features, file structure
├── missions.md          — Mission map with status tracking
├── decisions.md         — Every architectural decision
├── sessions/            — Session summaries for continuity
└── memory/              — Scored memory items
```

## License

MIT
