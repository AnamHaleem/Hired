export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  OPENAI_PARSER_MODEL: process.env.OPENAI_PARSER_MODEL ?? "gpt-5.4-mini",
  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
  ADZUNA_COUNTRY: process.env.ADZUNA_COUNTRY ?? "ca",
} as const;

export const runtimeFlags = {
  hasOpenAI: Boolean(env.OPENAI_API_KEY),
  hasDatabase: Boolean(env.DATABASE_URL),
  hasAdzuna: Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY),
} as const;
