import OpenAI from "openai";

import { env } from "@/lib/config";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}
