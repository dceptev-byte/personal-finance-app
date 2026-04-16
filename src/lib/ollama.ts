const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:e4b";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaResponse {
  message: OllamaMessage;
  done: boolean;
}

/**
 * Send a chat request to the local Ollama instance.
 * Returns the full assistant response as a string.
 */
export async function ollamaChat(
  messages: OllamaMessage[],
  options?: { temperature?: number; stream?: false }
): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.3,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Ollama error ${res.status}: ${error}`);
  }

  const data = (await res.json()) as OllamaResponse;
  return data.message.content;
}

/**
 * Stream a chat response from Ollama.
 * Yields string chunks as they arrive.
 */
export async function* ollamaChatStream(
  messages: OllamaMessage[]
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama stream error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line) as OllamaResponse;
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

/**
 * Check if Ollama is running and the model is available.
 */
export async function checkOllamaHealth(): Promise<{
  ok: boolean;
  model: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return { ok: false, model: OLLAMA_MODEL, error: "Ollama not reachable" };
    const data = await res.json() as { models: { name: string }[] };
    const available = data.models.some((m) => m.name.startsWith(OLLAMA_MODEL.split(":")[0]));
    return {
      ok: available,
      model: OLLAMA_MODEL,
      error: available ? undefined : `Model ${OLLAMA_MODEL} not found in Ollama`,
    };
  } catch (e) {
    return { ok: false, model: OLLAMA_MODEL, error: String(e) };
  }
}
