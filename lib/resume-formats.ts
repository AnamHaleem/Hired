export const SUPPORTED_RESUME_FILE_EXTENSIONS = [
  ".doc",
  ".docx",
  ".rtf",
  ".pdf",
] as const;

export type SupportedResumeExtension =
  (typeof SUPPORTED_RESUME_FILE_EXTENSIONS)[number];

export const SUPPORTED_RESUME_ACCEPT = SUPPORTED_RESUME_FILE_EXTENSIONS.join(",");
export const SUPPORTED_RESUME_FORMATS_LABEL = "DOC, DOCX, RTF, and PDF";

const MIME_TYPE_BY_EXTENSION: Record<SupportedResumeExtension, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".pdf": "application/pdf",
};

const EXTENSION_BY_MIME_TYPE = new Map<string, SupportedResumeExtension>([
  ["application/msword", ".doc"],
  ["application/vnd.ms-word", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/rtf", ".rtf"],
  ["application/x-rtf", ".rtf"],
  ["text/rtf", ".rtf"],
  ["application/pdf", ".pdf"],
]);

type ResumeLike = {
  name: string;
  type?: string;
};

export function getResumeFileExtension(filename: string): SupportedResumeExtension | null {
  const lastDotIndex = filename.lastIndexOf(".");
  const extension = lastDotIndex >= 0 ? filename.slice(lastDotIndex).toLowerCase() : "";

  return SUPPORTED_RESUME_FILE_EXTENSIONS.includes(extension as SupportedResumeExtension)
    ? (extension as SupportedResumeExtension)
    : null;
}

export function getSupportedResumeExtension(file: ResumeLike): SupportedResumeExtension | null {
  const extension = getResumeFileExtension(file.name);

  if (extension) {
    return extension;
  }

  if (!file.type) {
    return null;
  }

  return EXTENSION_BY_MIME_TYPE.get(file.type.toLowerCase()) ?? null;
}

export function isSupportedResumeFile(file: ResumeLike) {
  return getSupportedResumeExtension(file) !== null;
}

export function getResumeMimeType(file: ResumeLike) {
  const extension = getSupportedResumeExtension(file);

  if (!extension) {
    return "application/octet-stream";
  }

  return MIME_TYPE_BY_EXTENSION[extension];
}
