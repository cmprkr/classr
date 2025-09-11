// src/lib/openai.ts
import OpenAI from "openai";

/**
 * Single OpenAI client for the whole app.
 * - Reads API key from env
 * - Optional custom base URL (e.g., Azure/OpenRouter/self-hosted gateway)
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  // Optional: if you're using a proxy/gateway, set OPENAI_BASE_URL in .env.local
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

/**
 * Central place to choose models. You can override any of these via .env.local.
 * Defaults picked for good price/perf and compatibility with your current calls.
 */
export const MODELS = {
  // Chat / summarization / RAG answering
  chat: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",

  // Embeddings for RAG (smaller = cheaper; upgrade to -large if you need)
  embed: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",

  // Speech-to-text (OpenAI Whisper API)
  // If you self-host Whisper, you won't use this; but keep it for fallback.
  stt: process.env.OPENAI_STT_MODEL || "whisper-1",

  // Vision-capable chat model for OCR-on-images via chat.completions
  vision: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
} as const;

/**
 * Small guards to fail fast if the key is missing at runtime.
 * (Prevents confusing 500s later.)
 */
export function assertOpenAIEnv() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in environment (.env.local).");
  }
}
