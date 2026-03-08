import { ParsedBrief, InferredStack, BriefIntent } from '../types.js';

const SYSTEM_PROMPT = `You are a game director reading a brief. Your FIRST job is to understand WHAT KIND of brief this is — not everything is a coding project.

STEP 1: Detect the intent. Read the brief and classify it:
- "build" → They want to BUILD software (app, feature, tool, package)
- "strategy" → They want STRATEGY (growth, GTM, positioning, virality, business model)
- "research" → They want RESEARCH (investigate, compare, analyze options, market analysis)
- "design" → They want DESIGN (architecture, system design, API design, data modeling)
- "content" → They want CONTENT (writing, docs, decks, copy, README)
- "ops" → They want OPS (DevOps, CI/CD, infra, deployment, monitoring)
- "debug" → They want to FIX something (bug, issue, error, broken behavior)

STEP 2: Parse based on intent.

Return a JSON object with this exact structure:
{
  "intent": "build" | "strategy" | "research" | "design" | "content" | "ops" | "debug",
  "projectName": "kebab-case-name",
  "description": "one sentence summary of what they actually want",
  "stack": {
    "language": "TypeScript" or other or null (null if not a code project),
    "framework": "Next.js" or null,
    "database": "Supabase" or null,
    "auth": "Supabase Auth" or null,
    "styling": "Tailwind CSS" or null,
    "deployment": "Vercel" or null,
    "extras": ["Stripe", "OpenAI"] or []
  },
  "complexity": "simple" | "moderate" | "complex",
  "features": ["specific actionable deliverable 1", "deliverable 2", ...],
  "constraints": ["constraint 1", ...]
}

CRITICAL RULES:
- The "features" field means different things per intent:
  - build → features to implement
  - strategy → strategic objectives to address
  - research → questions to answer
  - design → components to design
  - content → pieces to create
  - ops → systems to set up
  - debug → symptoms to investigate
- For non-build intents, stack fields can all be null. That's fine.
- Do NOT force a coding stack onto a strategy/research/content brief.
- Features should be SPECIFIC and ACTIONABLE — not vague restatements of the brief.
- constraints = things the user explicitly does NOT want.
- ONLY return the JSON. No markdown, no explanation.`;

export interface LLMProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini', baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as any;
    return data.choices[0].message.content;
  }
}

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-6') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as any;
    return data.content[0].text;
  }
}

export async function parseBriefWithLLM(raw: string, provider: LLMProvider): Promise<ParsedBrief> {
  const response = await provider.complete(SYSTEM_PROMPT, raw);

  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const intent: BriefIntent = parsed.intent || 'build';

  return {
    raw,
    projectName: parsed.projectName || 'project',
    description: parsed.description || raw.slice(0, 200),
    intent,
    stack: {
      language: parsed.stack?.language || (intent === 'build' ? 'TypeScript' : ''),
      framework: parsed.stack?.framework || null,
      database: parsed.stack?.database || null,
      auth: parsed.stack?.auth || null,
      styling: parsed.stack?.styling || null,
      deployment: parsed.stack?.deployment || null,
      extras: parsed.stack?.extras || [],
    },
    complexity: parsed.complexity || 'moderate',
    features: parsed.features || [],
    constraints: parsed.constraints || [],
  };
}
