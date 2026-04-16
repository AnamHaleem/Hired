import { env } from "@/lib/config";
import { type PublicJobBoardSource } from "@/lib/job-search/types";

const DEFAULT_PUBLIC_JOB_BOARD_SOURCES: PublicJobBoardSource[] = [
  {
    provider: "greenhouse",
    key: "hellofresh",
    company: "HelloFresh",
    label: "Greenhouse • HelloFresh",
  },
  {
    provider: "lever",
    key: "achievers",
    company: "Achievers",
    label: "Lever • Achievers",
  },
  {
    provider: "lever",
    key: "ataccama",
    company: "Ataccama",
    label: "Lever • Ataccama",
  },
  {
    provider: "lever",
    key: "caseware",
    company: "Caseware",
    label: "Lever • Caseware",
  },
  {
    provider: "lever",
    key: "dealmaker",
    company: "DealMaker",
    label: "Lever • DealMaker",
  },
  {
    provider: "lever",
    key: "kepler",
    company: "Kepler",
    label: "Lever • Kepler",
  },
  {
    provider: "lever",
    key: "zenogroup",
    company: "Zeno Group",
    label: "Lever • Zeno Group",
  },
];

function titleCaseToken(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseConfiguredSources(
  value: string | undefined,
  provider: "greenhouse" | "lever",
) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [keyPart, companyPart] = item.split("|").map((part) => part.trim());
      const key = keyPart.toLowerCase();
      const company = companyPart || titleCaseToken(key);

      return {
        provider,
        key,
        company,
        label: `${provider === "greenhouse" ? "Greenhouse" : "Lever"} • ${company}`,
      } satisfies PublicJobBoardSource;
    });
}

export function listPublicJobBoardSources() {
  const configured = [
    ...parseConfiguredSources(env.GREENHOUSE_BOARD_TOKENS, "greenhouse"),
    ...parseConfiguredSources(env.LEVER_POSTING_SITES, "lever"),
  ];

  const combined = [...DEFAULT_PUBLIC_JOB_BOARD_SOURCES, ...configured];
  const seen = new Set<string>();

  return combined.filter((source) => {
    const key = `${source.provider}:${source.key}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getPublicJobBoardSummary() {
  const sources = listPublicJobBoardSources();

  return {
    total: sources.length,
    greenhouse: sources.filter((source) => source.provider === "greenhouse").length,
    lever: sources.filter((source) => source.provider === "lever").length,
  };
}
