import { ParsedBrief, InferredStack } from '../types.js';

const SYSTEM_PROMPT = `You are a game director reading a project brief. Your job is to infer EVERYTHING the developer needs without asking questions.

Analyze the brief and return a JSON object with this exact structure:
{
  "projectName": "kebab-case-name",
  "description": "one sentence summary",
  "stack": {
    "language": "TypeScript" or other,
    "framework": "Next.js" or null,
    "database": "Supabase" or null,
    "auth": "Supabase Auth" or null,
    "styling": "Tailwind CSS" or null,
    "deployment": "Vercel" or null,
    "extras": ["Stripe", "OpenAI"]
  },
  "complexity": "simple" | "moderate" | "complex",
  "features": ["feature 1", "feature 2", ...],
  "constraints": ["constraint 1", ...]
}

Rules:
- Infer stack from context clues. If they say "modern web app" → Next.js + TypeScript + Tailwind.
- If they mention payments → add Stripe to extras.
- If they mention users/login/signup → infer auth provider from stack.
- If no database mentioned but features imply data → infer the most natural DB for the stack.
- Features should be specific, actionable items — not vague descriptions.
- Constraints are things the user explicitly does NOT want.
- complexity: simple (landing page, static site), moderate (CRUD app, dashboard), complex (multi-tenant SaaS, real-time, marketplace)
- ONLY return the JSON. No markdown, no explanation.`;

export interface LLMProvider {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
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

  // Strip markdown code fences if present
  const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    raw,
    projectName: parsed.projectName || 'project',
    description: parsed.description || raw.slice(0, 200),
    stack: {
      language: parsed.stack?.language || 'TypeScript',
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
