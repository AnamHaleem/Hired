import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { runLocationSweep } from "@/lib/job-sweep/location-sweep";
import {
  getProfile,
  listAchievements,
  listTargetCompanies,
} from "@/lib/persistence/profile-store";
import { getActiveResume } from "@/lib/persistence/resume-store";
import {
  type LocationSweepInput,
  LocationSweepInputSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let payload: LocationSweepInput;

    try {
      const json = (await request.json()) as LocationSweepInput;
      payload = LocationSweepInputSchema.parse(json);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.flatten();
        const fieldErrors = details.fieldErrors as Partial<
          Record<keyof LocationSweepInput, string[]>
        >;
        const fieldMessages = [
          ...(fieldErrors.location ?? []),
          ...(fieldErrors.minScore ?? []),
          ...details.formErrors,
        ].filter(Boolean);

        return NextResponse.json(
          {
            error:
              fieldMessages[0] ??
              "The sweep inputs were invalid. Check the target region and fit score, then try again.",
            details,
          },
          { status: 400 },
        );
      }

      throw error;
    }

    const [profile, resume, achievements, targetCompanies] = await Promise.all([
      getProfile(),
      getActiveResume(),
      listAchievements(),
      listTargetCompanies(),
    ]);
    const sweep = await runLocationSweep({
      location: payload.location?.trim() || profile?.targetRegion || "",
      minScore: payload.minScore,
      profile,
      resume,
      achievements,
      targetCompanies,
    });

    return NextResponse.json(sweep, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error("Failed to normalize location sweep result", error.flatten());

      const details = error.flatten();

      return NextResponse.json(
        {
          error:
            "The sweep results could not be normalized right now. Try again in a moment.",
          details,
        },
        { status: 500 },
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

    console.error("Failed to run location sweep", error);

    return NextResponse.json(
      {
        error: "The location sweep could not be completed right now.",
      },
      { status: 500 },
    );
  }
}
