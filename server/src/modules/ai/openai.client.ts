import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 45_000;

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface StructuredRequest {
  messages: ChatMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredResponse<T> {
  data: T;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

interface CompletionPayload {
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  choices?: Array<{ message?: { content?: string; refusal?: string } }>;
  error?: { message?: string };
}

export function isOpenAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

export function activeModel(): string {
  return env.OPENAI_MODEL;
}

export async function completeStructured<T>(request: StructuredRequest): Promise<StructuredResponse<T>> {
  if (!env.OPENAI_API_KEY) throw ApiError.badRequest('OPENAI_API_KEY is not configured.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        temperature: request.temperature ?? 0.25,
        max_tokens: request.maxTokens ?? 1600,
        messages: request.messages,
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schemaName, strict: true, schema: request.schema },
        },
      }),
    });

    const payload = (await response.json()) as CompletionPayload;

    if (!response.ok) {
      throw ApiError.upstream(payload.error?.message ?? `OpenAI responded ${response.status}`);
    }

    const choice = payload.choices?.[0]?.message;
    if (choice?.refusal) throw ApiError.upstream(`OpenAI declined the request: ${choice.refusal}`);
    if (!choice?.content) throw ApiError.upstream('OpenAI returned an empty completion.');

    return {
      data: JSON.parse(choice.content) as T,
      model: payload.model ?? env.OPENAI_MODEL,
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw ApiError.upstream('The AI report timed out. Try again in a moment.');
    }
    throw ApiError.upstream(error instanceof Error ? error.message : 'The AI provider failed.');
  } finally {
    clearTimeout(timer);
  }
}
