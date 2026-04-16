import { env } from "@/lib/config";
import { type PublicJobBoardSource } from "@/lib/job-search/types";

const DEFAULT_PUBLIC_JOB_BOARD_SOURCES: PublicJobBoardSource[] = [
  {
    provider: "ashby",
    key: "notion",
    company: "Notion",
    label: "Ashby • Notion",
  },
  {
    provider: "ashby",
    key: "openai",
    company: "OpenAI",
    label: "Ashby • OpenAI",
  },
  {
    provider: "ashby",
    key: "ramp",
    company: "Ramp",
    label: "Ashby • Ramp",
  },
  {
    provider: "greenhouse",
    key: "hellofresh",
    company: "HelloFresh",
    label: "Greenhouse • HelloFresh",
  },
  {
    provider: "greenhouse",
    key: "coursera",
    company: "Coursera",
    label: "Greenhouse • Coursera",
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
  {
    provider: "lever",
    key: "pointclickcare",
    company: "PointClickCare",
    label: "Lever • PointClickCare",
  },
  {
    provider: "lever",
    key: "wealthsimple",
    company: "Wealthsimple",
    label: "Lever • Wealthsimple",
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
  provider: "ashby" | "greenhouse" | "lever",
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
        label: `${provider === "ashby" ? "Ashby" : provider === "greenhouse" ? "Greenhouse" : "Lever"} • ${company}`,
      } satisfies PublicJobBoardSource;
    });
}

export function listPublicJobBoardSources() {
  const configured = [
    ...parseConfiguredSources(env.ASHBY_JOB_BOARD_NAMES, "ashby"),
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
    ashby: sources.filter((source) => source.provider === "ashby").length,
    greenhouse: sources.filter((source) => source.provider === "greenhouse").length,
    lever: sources.filter((source) => source.provider === "lever").length,
  };
}
