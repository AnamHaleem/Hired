import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  createTargetCompany,
  deleteTargetCompany,
} from "@/lib/persistence/profile-store";
import {
  type CreateTargetCompanyInput,
  CreateTargetCompanyInputSchema,
  type DeleteTargetCompanyInput,
  DeleteTargetCompanyInputSchema,
} from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as CreateTargetCompanyInput;
    const payload = CreateTargetCompanyInputSchema.parse(json);
    const targetCompany = await createTargetCompany(payload);

    return NextResponse.json({ targetCompany }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid target company payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Failed to save target company", error);

    return NextResponse.json(
      {
        error: "The target company could not be saved right now.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const json = (await request.json()) as DeleteTargetCompanyInput;
    const payload = DeleteTargetCompanyInputSchema.parse(json);
    const deleted = await deleteTargetCompany(payload);

    return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid target company deletion payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("Failed to delete target company", error);

    return NextResponse.json(
      {
        error: "The target company could not be deleted right now.",
      },
      { status: 500 },
    );
  }
}
