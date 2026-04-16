import { type PublicJobBoardSource, type JobSearchListing } from "@/lib/job-search/types";

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  descriptionPlain?: string;
  descriptionBodyPlain?: string;
  additionalPlain?: string;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
  };
  salaryRange?: {
    min?: number;
    max?: number;
  };
  createdAt?: number;
};

export async function fetchLeverSiteJobs(source: PublicJobBoardSource) {
  const url = new URL(`https://api.lever.co/v0/postings/${source.key}`);
  url.searchParams.set("mode", "json");
  url.searchParams.set("limit", "100");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 0,
    },
  });

  if (!response.ok) {
    return [] as JobSearchListing[];
  }

  const payload = (await response.json()) as LeverPosting[];

  return payload.flatMap((job) => {
    if (!job.text || !job.hostedUrl) {
      return [];
    }

    const description = [
      job.descriptionPlain,
      job.descriptionBodyPlain,
      job.additionalPlain,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!description) {
      return [];
    }

    return [
      {
        id: `lever:${source.key}:${job.id ?? job.hostedUrl}`,
        provider: "lever",
        sourceLabel: source.label,
        title: job.text.trim(),
        company: source.company,
        location: job.categories?.location?.trim() || "Location not detected",
        description,
        redirectUrl: job.hostedUrl,
        salaryMin: typeof job.salaryRange?.min === "number" ? job.salaryRange.min : null,
        salaryMax: typeof job.salaryRange?.max === "number" ? job.salaryRange.max : null,
        createdAt:
          typeof job.createdAt === "number"
            ? new Date(job.createdAt).toISOString()
            : null,
        category: job.categories?.team?.trim() || null,
        contractType: null,
        contractTime: job.categories?.commitment?.trim() || null,
      } satisfies JobSearchListing,
    ];
  });
}
