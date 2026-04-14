import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { upsertProfile } from "@/lib/persistence/profile-store";
import {
  type UpsertProfileInput,
  UpsertProfileInputSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as UpsertProfileInput;
    const payload = UpsertProfileInputSchema.parse(json);
    const profile = await upsertProfile(payload);

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid profile payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to save profile", error);

    return NextResponse.json(
      {
        error: "The profile could not be saved right now.",
      },
      { status: 500 },
    );
  }
}
