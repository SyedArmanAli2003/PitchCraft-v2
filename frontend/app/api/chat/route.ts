import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://pitchcraft.app',
    'X-Title': 'PitchCraft',
  },
});

const FREE_MODELS = [
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (NVIDIA NIM)', provider: 'nvidia-nim' },
  { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', provider: 'openrouter' },
  { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B', provider: 'openrouter' },
  { id: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B', provider: 'openrouter' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B', provider: 'openrouter' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra 550B', provider: 'openrouter' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B', provider: 'openrouter' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (OpenRouter)', provider: 'openrouter' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Hermes 3 405B', provider: 'openrouter' },
  { id: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B', provider: 'openrouter' },
  { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder', provider: 'openrouter' },
];

const SYSTEM_PROMPT = `You are PitchCraft's AI assistant — a helpful, knowledgeable guide for entrepreneurs and startup founders. You help users with:

1. **Business idea validation & refinement** — critique ideas, suggest pivots, identify target markets
2. **Platform guidance** — explain how PitchCraft works (7-step AI agent pipeline, business plan generation, approval gates, audit chains)
3. **Startup advice** — market research, financial modeling, go-to-market strategy, fundraising
4. **Technical questions** — about the multi-agent architecture, InsForge backend, model cascade, MCP integration

Be concise, actionable, and encouraging. If a user wants a full business plan, direct them to the "Generate Plan" feature. Keep responses under 300 words unless they ask for depth.`;

export async function GET() {
  return NextResponse.json({ models: FREE_MODELS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    const selectedModel = model || FREE_MODELS[0].id;
    const isNvidiaNim = selectedModel === 'meta/llama-3.3-70b-instruct';

    const client = isNvidiaNim
      ? new OpenAI({
          baseURL: 'https://integrate.api.nvidia.com/v1',
          apiKey: process.env.NVIDIA_NIM_API_KEY,
        })
      : openai;

    if (stream) {
      const completion = await client.chat.completions.create({
        model: selectedModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 2048,
        stream: true,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of completion) {
              const text = chunk.choices[0]?.delta?.content;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const completion = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    return NextResponse.json({ text, model: selectedModel });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate response';
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}