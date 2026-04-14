import path from "node:path";

import { NextResponse } from "next/server";

import { parseUploadedResume } from "@/lib/ai/resume-parser";
import { createParsedResume } from "@/lib/persistence/resume-store";
import {
  getResumeMimeType,
  isSupportedResumeFile,
  SUPPORTED_RESUME_FORMATS_LABEL,
} from "@/lib/resume-formats";

export const runtime = "nodejs";

function deriveLabel(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ").trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = formData.get("label");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Upload a resume file first.",
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error: "The selected file is empty.",
        },
        { status: 400 },
      );
    }

    if (!isSupportedResumeFile(file)) {
      return NextResponse.json(
        {
          error: `Unsupported resume format. Upload a ${SUPPORTED_RESUME_FORMATS_LABEL} file.`,
        },
        { status: 400 },
      );
    }

    const parsedResume = await parseUploadedResume(file);
    const resume = await createParsedResume({
      label:
        typeof label === "string" && label.trim().length > 0
          ? label.trim()
          : deriveLabel(file.name) || "Resume version",
      originalFilename: file.name,
      mimeType: getResumeMimeType(file),
      rawText: parsedResume.rawText,
      parsed: parsedResume.parsed,
      makeActive: true,
    });

    return NextResponse.json(
      {
        resume,
        provider: parsedResume.provider,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    console.error("Failed to upload resume", error);

    return NextResponse.json(
      {
        error: "The resume could not be uploaded right now.",
      },
      { status: 500 },
    );
  }
}
