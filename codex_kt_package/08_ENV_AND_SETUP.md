# Environment and Setup

## Required environment variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
```

## Local setup
1. Create a Supabase project.
2. Enable pgvector.
3. Apply `schema.sql`.
4. Create a Next.js app with TypeScript.
5. Add Zod, Supabase client, and OpenAI SDK.
6. Set environment variables.
7. Start local dev server.

## Suggested packages
- `openai`
- `zod`
- `@supabase/supabase-js`
- `@supabase/ssr`
- `react-hook-form`
- `lucide-react`
- `date-fns`

## Optional packages
- `recharts` for analytics
- `drizzle-orm` or `kysely` if you prefer a query layer
