import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createAchievement } from "@/lib/persistence/profile-store";
import {
  CreateAchievementInputSchema,
  type CreateAchievementInput,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as CreateAchievementInput;
    const payload = CreateAchievementInputSchema.parse(json);
    const achievement = await createAchievement(payload);

    return NextResponse.json({ achievement }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid achievement payload.",
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

    console.error("Failed to create achievement", error);

    return NextResponse.json(
      {
        error: "The achievement could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
