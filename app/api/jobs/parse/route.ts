import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseJobDescription } from "@/lib/ai/job-parser";
import {
  CreateJobParseInputSchema,
  type CreateJobParseInput,
} from "@/lib/schemas";
import { createParsedJob } from "@/lib/persistence/job-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as CreateJobParseInput;
    const payload = CreateJobParseInputSchema.parse(json);

    const parseResult = await parseJobDescription(payload.description);
    const job = await createParsedJob({
      description: payload.description,
      source: payload.source,
      parsed: parseResult.parsed,
      parserProvider: parseResult.provider,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid job intake payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to parse job", error);

    return NextResponse.json(
      {
        error:
          "The job could not be parsed right now. Please try again or review your environment configuration.",
      },
      { status: 500 },
    );
  }
}
