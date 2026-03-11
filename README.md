# npc-guide

**Your repo remembers everything. Your AI never starts from zero.**

NPC Guide is a silent npm package that gives AI coding agents (Claude Code, Cursor, Copilot) persistent memory and mission direction. Install it, give it a brief, and your agent stops asking questions and starts building — mission by mission, session by session.

No configuration. No dashboard. No UI. Just `npm install` and go.

---

## The Problem

Every time you start a coding session with an AI agent, it starts from zero. It doesn't know what you built yesterday, what decisions you made, or what comes next. You spend the first 10 minutes re-explaining context.

NPC Guide fixes this with two hooks and a memory system. The agent builds. The hooks observe and record. Next session, the agent has full context automatically.

## Built with NPC Guide

### [AgentLens](https://github.com/Abhipaddy8/agentlens) — LLM cost optimization proxy with real-time dashboard. Built in one session from a single brief.

- One brief → 7 missions generated → 7 missions completed autonomously
- Agent only asked for file write permissions — zero architecture questions
- Built: Node.js proxy (Lambda), 5 DynamoDB tables, React dashboard (9 screens), CloudFormation template, demo environment, 38 integration tests
- Live-tested with real LLM calls through OpenRouter — 71 calls logged, 22.5% cache hit rate, 234x speed boost on cached queries
- Made 6 architectural decisions autonomously (DynamoDB over Postgres, CloudFormation over Terraform, OpenAI-only for v1)

![AgentLens Overview](https://raw.githubusercontent.com/Abhipaddy8/agentlens/main/screenshots/overview.png)
![AgentLens Waste Alert](https://raw.githubusercontent.com/Abhipaddy8/agentlens/main/screenshots/waste-alert.png)
![AgentLens CFO View](https://raw.githubusercontent.com/Abhipaddy8/agentlens/main/screenshots/cfo-view.png)

### [rag-starter](https://github.com/Abhipaddy8/rag-starter) — Full RAG chatbot with citations, scope enforcement, and pgvector search. Built in one hour from a single brief.

- One brief → 4 missions generated → 4 missions completed in one session
- Agent made 14 architectural decisions autonomously (pgvector over Pinecone, HNSW over IVFFlat, OpenRouter fallback when OpenAI quota ran out)
- Self-debugged mid-build: lowered similarity threshold from 0.7 to 0.2 when embeddings produced lower cosine scores
- Evolved the project into an open-source starter kit with `rag.config.ts` for one-file customization
- [Live demo](https://rag-starter-one.vercel.app/) — ask it anything about Notion's help docs. It retrieves relevant chunks via pgvector, generates an answer with GPT-4o-mini, cites the source articles, and refuses to answer anything outside scope.

---

## Install

```bash
npm install https://github.com/Abhipaddy8/npc-guide-ai/releases/download/v0.3.0/npc-guide-0.3.0.tgz
```

This silently creates:
- `.ai-guide/` — empty folder structure (sessions, memory)
- `.claude/settings.json` — SessionStart/End hooks for Claude Code
- `CLAUDE.md` — agent instructions (works with any agent that reads project markdown)
- `.cursorrules` — agent instructions for Cursor

**Zero config. Zero output. Just installs and wires itself in.** No project scanning happens yet — that waits for `init`.

## Initialize a Project

```bash
npx npc-guide init "Build a real-time chat app with Next.js, Supabase, and Clerk auth"
```

Output:
```
⚡ NPC Guide AI  v0.3.0

  ✓ Brief saved. Open your coding agent — it will generate missions on first session.

  Next: Open your coding agent in this folder.
  The agent will read the brief, generate missions, and start building.
```

## Then Just Open Your Agent

Open Claude Code (or Cursor, or any agent). The session-start hook fires, sees the brief but no missions, and injects a prompt telling the agent to:

1. Read the brief
2. Generate project-specific missions
3. Write them to `.ai-guide/missions.md`
4. Start executing Mission 1 immediately

**The agent is the parser.** It reads your brief — any format, any length — and generates missions that reference actual files, services, and modules. No regex guessing. No template matching. The LLM understands your intent perfectly because that's what LLMs do.

---

## How It Works — The Observation Loop

```
npm install npc-guide           postinstall scans project, seeds memory, wires hooks
                                ↓
npx npc-guide init "brief"      saves raw brief to .ai-guide/brief.md
                                ↓
[open coding agent]             SessionStart hook fires:
                                  FIRST SESSION (brief exists, no missions):
                                    - Injects brief + prompt → agent generates missions
                                  NORMAL SESSION (missions exist):
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

**The key insight:** The agent IS the parser. Previous versions used regex to detect intent and generate template missions — this broke on any brief that didn't match exact keyword patterns. Now the raw brief goes straight to the agent, which understands it perfectly and generates project-specific missions. The hooks observe git diffs and record everything mechanically. The agent's only job is to build.

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

## Agent-Generated Missions

The agent reads your brief and generates missions specific to your project. No templates. No keyword matching. The LLM understands what you're building and creates the right sequence — whether that's 3 missions or 8, for a build, a strategy, a debug session, or anything else.

Example: a brief about "an LLM cost optimization proxy" generates missions like:
```
▶️ 1 — Proxy MVP — Node.js Lambda, /v1/chat/completions endpoint, DynamoDB writes, kill switch
🔒 2 — Cache + Router — Semantic cache lookup, model routing rules, budget tracking
🔒 3 — Dashboard — React app, 5 screens, real-time agent spend breakdown
🔒 4 — Demo Environment — Seed 6 agents, 3 weeks of data, anomaly events
🔒 5 — CloudFormation — One-click deploy template for customer AWS accounts
```

Not "Foundation → Core Loop → Data Layer → Ship".

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
├── brief-parser/index.ts      Legacy regex parser (kept as fallback, not used in main flow)
├── mission-architect/index.ts  Legacy template missions (kept as fallback, not used in main flow)
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

## Changelog

### v0.4.0

- **Agent-generated missions** — `processBrief()` saves raw brief only. No regex parsing, no template mission generation. The coding agent reads the brief on first session and generates project-specific missions.
- **Removed brief parser from main flow** — `brief-parser/index.ts` and `mission-architect/index.ts` kept as legacy fallbacks but no longer called by `processBrief()`
- **CLI simplified** — saves brief and exits. No interactive mission loop. Agent does the thinking.
- **Fix: intent misdetection** — briefs mentioning "deploy" or "infrastructure" no longer get classified as "ops" when the intent is clearly "build"
- **Fix: project name extraction** — no more falling back to random words from the brief

### v0.3.0

- First session mode in session-start hook
- Project scanner seeding memory on install
- rag-starter showcase

### v0.2.1

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
