// lib/openai.ts
import OpenAI from "openai";
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const MODELS = {
  stt: "whisper-1",                 // Speech-to-text
  embed: "text-embedding-3-small",  // cheap & fine for MVP
  chat: "gpt-4o-mini"               // or "gpt-5" if you have it
};
