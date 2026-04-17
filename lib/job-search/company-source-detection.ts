import { listPublicJobBoardSources } from "@/lib/job-search/public-board-registry";
import { type PublicJobBoardSource } from "@/lib/job-search/types";
import {
  type CompanySourceProvider,
  type StoredTargetCompany,
} from "@/lib/schemas";

type DetectionResult = {
  careersUrl: string | null;
  provider: CompanySourceProvider;
  providerKey: string | null;
  status: "ready" | "needs_review";
  detectionNotes: string | null;
};

function normalizeCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.toString();
  } catch {
    return trimmed;
  }
}

function detectFromKnownSources(companyName: string) {
  const normalizedCompany = normalizeCompanyName(companyName);
  const source = listPublicJobBoardSources().find(
    (candidate) => normalizeCompanyName(candidate.company) === normalizedCompany,
  );

  if (!source) {
    return null;
  }

  return {
    careersUrl: null,
    provider: source.provider,
    providerKey: source.key,
    status: "ready",
    detectionNotes: `Matched ${source.company} to a known ${source.provider} job board.`,
  } satisfies DetectionResult;
}

function detectFromUrl(careersUrl: string) {
  try {
    const url = new URL(careersUrl);
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);

    if (
      host === "boards.greenhouse.io" ||
      host === "job-boards.greenhouse.io"
    ) {
      const boardToken = segments[0];

      if (boardToken) {
        return {
          careersUrl,
          provider: "greenhouse",
          providerKey: boardToken.toLowerCase(),
          status: "ready",
          detectionNotes: `Detected a Greenhouse board token from the careers URL.`,
        } satisfies DetectionResult;
      }
    }

    if (host === "jobs.lever.co") {
      const postingSite = segments[0];

      if (postingSite) {
        return {
          careersUrl,
          provider: "lever",
          providerKey: postingSite.toLowerCase(),
          status: "ready",
          detectionNotes: `Detected a Lever posting site from the careers URL.`,
        } satisfies DetectionResult;
      }
    }

    if (host === "jobs.ashbyhq.com") {
      const boardName = segments[0];

      if (boardName) {
        return {
          careersUrl,
          provider: "ashby",
          providerKey: boardName.toLowerCase(),
          status: "ready",
          detectionNotes: `Detected an Ashby job board from the careers URL.`,
        } satisfies DetectionResult;
      }
    }

    if (host === "api.ashbyhq.com") {
      const boardIndex = segments.findIndex((segment) => segment === "job-board");
      const boardName =
        boardIndex >= 0 && segments[boardIndex + 1] ? segments[boardIndex + 1] : null;

      if (boardName) {
        return {
          careersUrl,
          provider: "ashby",
          providerKey: boardName.toLowerCase(),
          status: "ready",
          detectionNotes: `Detected an Ashby API board name from the careers URL.`,
        } satisfies DetectionResult;
      }
    }

    if (
      host === "careers.smartrecruiters.com" ||
      host === "jobs.smartrecruiters.com"
    ) {
      const companyIdentifier = segments[0];

      if (companyIdentifier) {
        return {
          careersUrl,
          provider: "smartrecruiters",
          providerKey: companyIdentifier,
          status: "ready",
          detectionNotes: `Detected a SmartRecruiters company identifier from the careers URL.`,
        } satisfies DetectionResult;
      }
    }
  } catch {
    return {
      careersUrl,
      provider: "custom",
      providerKey: null,
      status: "needs_review",
      detectionNotes:
        "That careers URL could not be normalized. Use a public Greenhouse, Lever, Ashby, or SmartRecruiters careers URL.",
    } satisfies DetectionResult;
  }

  return {
    careersUrl,
    provider: "custom",
    providerKey: null,
    status: "needs_review",
    detectionNotes:
      "The careers URL was saved, but Hired could not detect a supported ATS yet. Add a public Greenhouse, Lever, Ashby, or SmartRecruiters URL for direct role pulling.",
  } satisfies DetectionResult;
}

export function detectTargetCompanySource(args: {
  companyName: string;
  careersUrl?: string;
}) {
  const normalizedUrl = normalizeUrl(args.careersUrl);

  if (normalizedUrl) {
    return detectFromUrl(normalizedUrl);
  }

  return (
    detectFromKnownSources(args.companyName) ?? {
      careersUrl: null,
      provider: "custom",
      providerKey: null,
      status: "needs_review",
      detectionNotes:
        "Add a public Greenhouse, Lever, Ashby, or SmartRecruiters careers URL so Hired can pull roles directly from this company.",
    }
  );
}

export function getCompanyProviderLabel(provider: CompanySourceProvider) {
  if (provider === "ashby") {
    return "Ashby";
  }

  if (provider === "greenhouse") {
    return "Greenhouse";
  }

  if (provider === "lever") {
    return "Lever";
  }

  if (provider === "smartrecruiters") {
    return "SmartRecruiters";
  }

  return "Custom";
}

export function toPublicJobBoardSource(
  targetCompany: StoredTargetCompany,
): PublicJobBoardSource | null {
  if (
    targetCompany.status !== "ready" ||
    !targetCompany.providerKey ||
    targetCompany.provider === "custom"
  ) {
    return null;
  }

  return {
    provider: targetCompany.provider,
    key: targetCompany.providerKey,
    company: targetCompany.companyName,
    label: `${getCompanyProviderLabel(targetCompany.provider)} • ${targetCompany.companyName}`,
  };
}
