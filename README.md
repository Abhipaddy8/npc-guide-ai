# npc-guide

**Your repo remembers everything. Your AI never starts from zero.**

NPC Guide is a silent npm package that turns AI coding agents into autonomous executors. Install it, give it a brief, and your agent (Claude Code, Cursor, Copilot) stops asking questions and starts building — mission by mission, session by session, with full memory.

No configuration. No dashboard. No UI. Just `npm install` and go.

---

## The Problem

Every time you start a coding session with an AI agent, it starts from zero. It doesn't know what you built yesterday, what decisions you made, or what comes next. You spend the first 10 minutes re-explaining context. The agent asks "should I start?" instead of just starting. It builds random features instead of following a plan.

NPC Guide fixes all of this.

## What It Does

1. **Installs silently** — `npm install` triggers a postinstall that creates everything the agent needs. No setup.
2. **Parses your brief** — You describe what you want in plain English. NPC Guide detects the intent (build, strategy, research, debug, etc.) and generates a mission map.
3. **Directs the agent** — Your coding agent reads the mission map and executes autonomously. No hand-holding.
4. **Remembers everything** — Every session is archived. Every decision is logged. Next time you open the agent, it picks up exactly where it left off.

You never talk to NPC Guide directly. It works in the background, through files and hooks, turning your coding agent into a directed executor instead of a chatbot.

---

## Install

```bash
npm install https://github.com/Abhipaddy8/npc-guide-ai/releases/download/v0.1.0/npc-guide-0.1.0.tgz
```

This silently creates:
- `.ai-guide/` — the brain (architecture, missions, decisions, memory, sessions)
- `.claude/settings.json` — SessionStart/End hooks for Claude Code
- `CLAUDE.md` — agent instructions (works with Claude Code, Copilot, any agent that reads it)
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

Open Claude Code (or Cursor, or any agent). Type "go". The agent reads `.ai-guide/missions.md`, finds the active mission, and starts executing immediately.

**You don't explain anything.** The agent already knows the stack, the plan, and the current mission.

---

## How It Actually Works

```
npm install npc-guide           postinstall creates .ai-guide/, hooks, CLAUDE.md, .cursorrules
                                ↓
npx npc-guide init "brief"      parses brief → detects intent → generates mission map
                                ↓
[open coding agent]             SessionStart hook fires → injects context into agent
                                agent reads missions.md → finds active mission → executes
                                ↓
[agent works autonomously]      builds code, logs decisions to decisions.md,
                                advances mission map when done
                                ↓
[close terminal]                SessionEnd hook fires → archives session summary
                                ↓
[reopen next day]               SessionStart hook fires again → loads last session,
                                memory, decisions → agent continues where it left off
```

### The `.ai-guide/` Folder

This is the brain. It gets created in your project root:

```
.ai-guide/
├── architecture.md          Stack, features, file structure (auto-detected)
├── missions.md              Mission map with live status tracking
├── decisions.md             Every architectural decision with reasoning
├── sessions/
│   ├── latest.json          Last session summary, files changed, blockers
│   └── archive/             Timestamped past sessions
└── memory/
    └── memory-table.json    Scored memory items (15-session rolling window)
```

The agent reads AND writes to these files. It updates `missions.md` when it completes a mission. It logs to `decisions.md` when it makes an architectural choice. It writes `latest.json` at session end so the next session has context.

### The CLAUDE.md Instructions

NPC Guide writes clear directives into your project's `CLAUDE.md`:

```markdown
# NPC Guide — Mission System

This project is driven by NPC Guide. You are the coding agent. The Guide is your director.

## CRITICAL RULES — Follow these exactly
1. On session start, read .ai-guide/missions.md and .ai-guide/architecture.md FIRST.
2. Find the ACTIVE mission (marked ▶). That is your ONLY job right now.
3. START EXECUTING IMMEDIATELY. Do NOT ask "should I start?" — just do it.
4. Do NOT ask questions you can infer from context.
5. Log every architectural decision to .ai-guide/decisions.md.
6. When the mission is complete, update missions.md: mark current ✅, mark next ▶️.
7. Write a session summary to .ai-guide/sessions/latest.json before stopping.

## What you are NOT
- You are NOT waiting for permission. The mission map IS your permission.
- You are NOT a chatbot. You are an executor.
- You are NOT asking "what should I do?" — the mission tells you what to do.
```

This turns any AI agent from a question-asker into an autonomous executor.

---

## 7 Intent Types

NPC Guide doesn't assume everything is a code project. It detects what you're actually trying to do and generates the right mission sequence:

| Intent | Detected When You Say... | Mission Sequence |
|---|---|---|
| **build** | "build", "create", "implement" | Foundation → Core Loop → Data Layer → Auth → UI → Integration → Ship |
| **strategy** | "strategy", "growth", "monetize", "GTM" | Landscape → Positioning → Growth Engine → Retention → Monetization → Launch Plan |
| **research** | "research", "investigate", "compare" | Define Scope → Gather → Analyze → Synthesize → Recommend |
| **design** | "design", "architect", "system design" | Requirements → System Map → Interface Design → Validation |
| **content** | "write", "blog", "documentation" | Outline → Draft → Polish → Distribute |
| **ops** | "deploy", "CI/CD", "migrate", "infrastructure" | Audit → Implement → Test & Verify → Rollout |
| **debug** | "fix", "broken", "bug", "not working" | Reproduce → Isolate → Fix → Verify |

Every intent gets its own optimized mission sequence. A strategy brief doesn't get a "scaffold project" mission. A debug brief doesn't get a "build UI" mission.

---

## Agent Integration

| Agent | How NPC Guide Integrates |
|---|---|
| **Claude Code** | SessionStart/End hooks in `.claude/settings.json` + `CLAUDE.md` — full lifecycle integration with context injection |
| **Cursor** | `.cursorrules` — agent reads mission instructions on every prompt |
| **Copilot / Others** | `CLAUDE.md` — any agent that reads project markdown gets the instructions |

Claude Code gets the deepest integration because it supports hooks. The SessionStart hook injects the full context (architecture, missions, decisions, memory, last session) directly into the agent's context window when a session begins. The SessionEnd hook archives everything when you close the terminal.

For Cursor and other agents, NPC Guide writes instructions to `.cursorrules` and `CLAUDE.md` that the agent reads on every interaction.

---

## Live Test Results

NPC Guide was tested with Claude Code on a real project: "Build a real-time chat app with Next.js 15, Supabase, and Clerk auth."

### What happened:
- User typed **one word**: "go"
- Agent executed **7 missions autonomously** across multiple sessions
- Agent logged **10 architectural decisions** unprompted
- Agent **self-debugged** — found 3 bugs from a cut session and fixed all of them
- When the terminal was closed and reopened, the agent **continued at the correct mission** with full context

### The agent's decisions log (written autonomously):

```
Decision: Separate username entry into two-phase UX (name form → chat form)
Reason: Original MessageInput had a bug where the name input disappeared
after 1 keystroke because !username became falsy on onChange.

Decision: Centralize data access in lib/db.ts
Reason: Inline Supabase queries were scattered across 3 components,
duplicating logic. Created db.ts with typed CRUD functions.

Decision: Wire Clerk identity into chat flow, remove manual username entry
Reason: Clerk middleware already protects /chat routes. MessageInput no
longer needs a "Join" step — username comes from useUser().

Decision: Sidebar layout with shared chat/layout.tsx
Reason: Instead of separate pages, built a persistent sidebar for a
Slack/Discord-like UX with room navigation always visible.
```

### Final mission map (all 7 complete):

```
✅ 1 — Foundation      Scaffold project structure, install dependencies
✅ 2 — Core Loop       Build the primary feature (real-time messaging)
✅ 3 — Data Layer       Set up database schema, models, data access
✅ 4 — Identity         Implement authentication and authorization
✅ 5 — UI Shell         Build the user interface and navigation
✅ 6 — Integration      Connect all layers, wire APIs, handle data flow
✅ 7 — Ship             Build config, deployment setup, final checks
```

The user said "go" once. The agent built a full-stack real-time chat application with auth, database, real-time subscriptions, and deployment config.

---

## Architecture

NPC Guide is a TypeScript ESM monorepo:

```
packages/
├── core/                        ← The npm package (this is what you install)
│   └── src/
│       ├── types.ts             Full type system (7 intents, mission types, memory scoring)
│       ├── brief-parser/
│       │   ├── index.ts         Regex parser — works offline, no API needed
│       │   └── llm-parser.ts    LLM parser (OpenRouter/OpenAI/Anthropic) for richer parsing
│       ├── mission-architect/
│       │   ├── index.ts         Intent-specific mission templates (7 types)
│       │   └── task-generator.ts  LLM task generation per mission
│       ├── memory/
│       │   ├── index.ts         15-session rolling window, promote/demote/archive
│       │   ├── embeddings.ts    Cosine similarity + semantic search
│       │   └── doc-writer.ts    Writes architecture.md, decisions.md, missions.md
│       ├── session-injector/    Session lifecycle + context builder
│       ├── agent-instructor/    Generates formatted instructions per mission
│       ├── hooks/
│       │   ├── session-start.ts Injects context into agent via stdout
│       │   ├── session-end.ts   Archives session on close
│       │   └── init.ts          One-time brief processor (npx npc-guide init)
│       ├── installer/
│       │   └── index.ts         Postinstall: creates .ai-guide/, hooks, CLAUDE.md
│       └── index.ts             NpcGuide orchestrator class
├── claude-code/                 MCP server (5 tools) — optional deeper integration
└── cli/                         Debug/demo REPL — not the core product
```

### No API Required

The default brief parser uses regex — it runs offline, instantly, with zero API calls. It detects intent, infers stack, and generates missions entirely locally.

If you want richer parsing (better feature extraction, smarter stack detection), you can optionally wire an LLM provider (OpenAI, Anthropic, or OpenRouter). But it's not required.

---

## Memory System

NPC Guide maintains a 15-session rolling memory window:

- **Active memories** are injected into the agent's context on every session start
- **Memories are scored** — frequently referenced items get promoted, stale items get demoted
- **Archived memories** are kept but not injected (saves context window space)
- **Categories**: architecture, decision, blocker, pattern, preference

This means your agent doesn't just remember what happened last session — it remembers the important things from the last 15 sessions, weighted by relevance.

---

## FAQ

**Does it work without Claude Code?**
Yes. Claude Code gets the deepest integration (hooks), but any agent that reads `CLAUDE.md` or `.cursorrules` will follow the mission instructions. Cursor, Copilot, Windsurf — they all work.

**Does it need an API key?**
No. The default parser is pure regex, runs offline. LLM parsing is optional.

**Does it modify my code?**
Never. It only creates `.ai-guide/`, `CLAUDE.md`, `.cursorrules`, and `.claude/settings.json`. It never touches your source code.

**What if I already have a CLAUDE.md?**
It appends the NPC Guide section. It never overwrites existing content.

**Can I use it on an existing project?**
Yes. Install it, run `npx npc-guide init "your brief"`, and it creates the mission map for whatever you're working on.

**How do I skip a mission?**
Edit `.ai-guide/missions.md` directly. Change the mission status from locked to active or skipped. The agent follows whatever state it finds.

**Is this just a to-do list?**
No. A to-do list doesn't inject context into your agent's memory. It doesn't archive sessions. It doesn't detect intent. It doesn't direct the agent to execute without asking. NPC Guide is infrastructure that makes your agent autonomous.

---

## Roadmap

- [ ] Publish to npm (`npm install npc-guide`)
- [ ] Cosine similarity memory scoring with embeddings API
- [ ] "Built with NPC Guide" badge generator
- [ ] Cursor deep integration testing
- [ ] Mission enrichment (LLM generates sub-tasks per mission)
- [ ] Multi-project memory sharing

---

## License

MIT
