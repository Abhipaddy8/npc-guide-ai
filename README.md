# npc-guide

**Your repo remembers everything. Your AI never starts from zero.**

NPC Guide is a silent npm package that gives AI coding agents (Claude Code, Cursor, Copilot) persistent memory and mission direction. Install it, give it a brief, and your agent stops asking questions and starts building — mission by mission, session by session.

No configuration. No dashboard. No UI. Just `npm install` and go.

---

## The Problem

Every time you start a coding session with an AI agent, it starts from zero. It doesn't know what you built yesterday, what decisions you made, or what comes next. You spend the first 10 minutes re-explaining context.

NPC Guide fixes this with two hooks and a memory system. The agent builds. The hooks observe and record. Next session, the agent has full context automatically.

## Install

```bash
npm install https://github.com/Abhipaddy8/npc-guide-ai/releases/download/v0.3.0/npc-guide-0.3.0.tgz
```

This silently creates:
- `.ai-guide/` — memory, sessions, architecture, missions, decisions
- `.claude/settings.json` — SessionStart/End hooks for Claude Code
- `CLAUDE.md` — agent instructions (works with any agent that reads project markdown)
- `.cursorrules` — agent instructions for Cursor

**Zero config. Zero output. Just installs and wires itself in.**

## Initialize a Project

```bash
npx npc-guide init "Build a real-time chat app with Next.js, Supabase, and Clerk auth"
```

Output:
```
⚡ NPC Guide initialized — "build-real-time-chat"
   Intent: build | 7 missions

   ▶ 1 — Foundation  Scaffold project structure, install dependencies, configure tooling
   ○ 2 — Core Loop   Build the primary feature that defines the product
   ○ 3 — Data Layer   Set up database schema, models, and data access
   ○ 4 — Identity     Implement authentication and authorization
   ○ 5 — UI Shell     Build the user interface and navigation
   ○ 6 — Integration  Connect all layers, wire APIs, handle data flow
   ○ 7 — Ship         Build config, deployment setup, final checks

   .ai-guide/ created. Your next coding session will pick this up automatically.
```

## Then Just Open Your Agent

Open Claude Code (or Cursor, or any agent). Type "go". The agent reads the mission map, finds the active mission, and starts executing immediately.

**You don't explain anything.** The agent already knows the stack, the plan, and the current mission.

---

## How It Works — The Observation Loop

```
npm install npc-guide           postinstall scans project, seeds memory, wires hooks
                                ↓
npx npc-guide init "brief"      parses brief → detects intent → generates mission map
                                ↓
[open coding agent]             SessionStart hook fires:
                                  - Takes git snapshot (SHA + timestamp)
                                  - Injects architecture, missions, decisions, memory
                                  - Prints status line to stderr:
                                    ⚡ NPC Guide — Mission 2: Core Loop | Session 4 | 12 memories active
                                ↓
[agent works]                   Agent just builds. No bookkeeping required.
                                The agent does NOT write to any .ai-guide/ files.
                                ↓
[close terminal]                SessionEnd hook fires:
                                  - Runs git diff from snapshot → observes what changed
                                  - Builds session summary from file changes
                                  - Auto-advances mission if enough work was done
                                  - Logs decision to decisions.md
                                  - Writes sessions/latest.json
                                  - Syncs everything into memory
                                ↓
[reopen next day]               SessionStart hook fires again:
                                  - Loads last session summary, decisions, memory
                                  - Agent continues at the correct mission with full context
```

**The key insight:** Previous versions asked the agent to write to `.ai-guide/` files — log decisions, update missions, write session summaries. Agents treated those as suggestions and skipped them. v0.2.1 flips this: the hooks observe git diffs and record everything mechanically. The agent's only job is to build.

### The `.ai-guide/` Folder

```
.ai-guide/
├── architecture.md          Stack, features, complexity (auto-detected from brief)
├── missions.md              Mission map with live status (auto-advanced by hooks)
├── decisions.md             Mission completions + observations (written by hooks)
├── sessions/
│   ├── .snapshot            Git SHA from session start (for diffing)
│   ├── latest.json          Last session: files changed, lines changed, summary
│   └── archive/             All past sessions
└── memory/
    └── memory-table.json    Scored memory items (15-session rolling window)
```

### Mission Auto-Advance

SessionEnd uses a scoring heuristic to decide if a mission is done:
- Files changed ≥ 5, **OR**
- Lines changed ≥ 100, **OR**
- Files changed ≥ 2 **AND** lines changed ≥ 50

When triggered, it marks the current mission ✅ and unlocks the next one ▶️.

---

## 7 Intent Types

NPC Guide detects what you're actually trying to do and generates the right mission sequence:

| Intent | Detected When You Say... | Mission Sequence |
|---|---|---|
| **build** | "build", "create", "implement" | Foundation → Core Loop → Data Layer → Auth → UI → Integration → Ship |
| **strategy** | "strategy", "growth", "monetize" | Landscape → Positioning → Growth Engine → Retention → Monetization → Launch Plan |
| **research** | "research", "investigate", "compare" | Define Scope → Gather → Analyze → Synthesize → Recommend |
| **design** | "design", "architect", "system design" | Requirements → System Map → Interface Design → Validation |
| **content** | "write", "blog", "documentation" | Outline → Draft → Polish → Distribute |
| **ops** | "deploy", "CI/CD", "infrastructure" | Audit → Implement → Test & Verify → Rollout |
| **debug** | "fix", "broken", "bug", "not working" | Reproduce → Isolate → Fix → Verify |

---

## Agent Integration

| Agent | How NPC Guide Integrates |
|---|---|
| **Claude Code** | SessionStart/End hooks + `CLAUDE.md` — full lifecycle with context injection and git observation |
| **Cursor** | `.cursorrules` — agent reads mission instructions on every prompt |
| **Copilot / Others** | `CLAUDE.md` — any agent that reads project markdown gets the instructions |

---

## Memory System

NPC Guide maintains a 15-session rolling memory window with TF-IDF cosine similarity retrieval:

- **Seeded on install** — scanner reads package.json, lists all deps, maps folder structure
- **Updated by hooks** — SessionEnd writes observations (files changed, missions advanced) into memory
- **Scored over time** — frequently relevant memories get promoted, stale ones get demoted then archived
- **Queried per session** — SessionStart retrieves memories relevant to the active mission goal
- **Zero API calls** — TF-IDF runs locally, instantly, pure math

Memory categories: `architecture`, `decision`, `progress`, `context`

Memory lifecycle: `new` → `active` → `demoting` → `archived`

---

## Architecture

```
packages/core/src/
├── installer/index.ts         Postinstall: scan project, seed memory, wire hooks, write CLAUDE.md
├── hooks/
│   ├── session-start.ts       Snapshot + inject context + status line (stderr)
│   ├── session-end.ts         Git diff observation + session record + mission advance
│   └── init.ts                npx npc-guide init — interactive brief → missions
├── project-scanner/index.ts   Reads package.json, lists ALL deps, scans folders 2 deep
├── brief-parser/index.ts      Regex intent detection + stack inference (+ collects unknown deps)
├── mission-architect/index.ts  Intent-specific mission templates (7 types, up to 8 missions)
├── memory/
│   ├── index.ts               15-session rolling window with promote/demote/archive lifecycle
│   ├── retriever.ts           TF-IDF cosine similarity — pure math, no API
│   └── doc-writer.ts          Writes architecture.md, missions.md, decisions.md
├── agent-instructor/          Generates formatted instructions per mission
├── session-injector/          Session lifecycle + context builder
├── types.ts                   Full type system (7 intents, mission types, memory scoring)
└── index.ts                   NpcGuide orchestrator class
```

**Zero runtime dependencies.** Only devDependencies: `typescript` and `@types/node`.

---

## v0.2.1 Changelog

- **Observation-based hooks** — SessionEnd observes git diff instead of depending on agent writes
- **Session snapshots** — SessionStart takes git SHA snapshot for accurate diffing
- **Mission auto-advance** — scoring heuristic (files ≥ 5 OR lines ≥ 100 OR files ≥ 2 + lines ≥ 50)
- **Hook path fix** — uses `import.meta.url` for reliable resolution on local installs
- **Memory dedup fix** — full normalized comparison instead of 60-char prefix slice
- **Unknown deps preserved** — brief parser collects unmatched deps into `stack.extras`
- **Status line** — `⚡ NPC Guide — Mission 2: Core Loop | Session 4 | 12 memories active` on stderr
- **Simplified CLAUDE.md** — no longer demands agent write to files. "Just build."

---

## FAQ

**Does it work without Claude Code?**
Yes. Claude Code gets the deepest integration (hooks), but any agent that reads `CLAUDE.md` or `.cursorrules` will follow the mission instructions.

**Does it need an API key?**
No. Everything runs locally — regex parsing, TF-IDF retrieval, git diffing. No API calls.

**Does it modify my code?**
Never. It only creates `.ai-guide/`, `CLAUDE.md`, `.cursorrules`, and `.claude/settings.json`.

**What if I already have a CLAUDE.md?**
It appends the NPC Guide section. Never overwrites existing content.

**Can I use it on an existing project?**
Yes. Install it, run `npx npc-guide init "your brief"`, and it creates the mission map for whatever you're working on.

**How do I skip a mission?**
Edit `.ai-guide/missions.md` directly. Change the mission status. The agent follows whatever state it finds.

---

## License

MIT
