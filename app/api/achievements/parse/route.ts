import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseAchievementsFromRole } from "@/lib/ai/achievement-parser";
import {
  type ParseAchievementInput,
  ParseAchievementInputSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as ParseAchievementInput;
    const payload = ParseAchievementInputSchema.parse(json);
    const parsed = await parseAchievementsFromRole(payload);

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid achievement parse payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    console.error("Failed to parse achievements", error);

    return NextResponse.json(
      {
        error: "Achievements could not be parsed right now.",
      },
      { status: 500 },
    );
  }
}
