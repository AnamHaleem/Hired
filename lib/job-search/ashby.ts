import { type JobSearchListing, type PublicJobBoardSource } from "@/lib/job-search/types";

type AshbyCompensationComponent = {
  compensationType?: string;
  minValue?: number | null;
  maxValue?: number | null;
};

type AshbyJobPosting = {
  id?: string;
  title?: string;
  location?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  isListed?: boolean;
  compensation?: {
    summaryComponents?: AshbyCompensationComponent[];
  };
};

type AshbyResponse = {
  jobs?: AshbyJobPosting[];
};

function findSalaryBounds(job: AshbyJobPosting) {
  const salaryComponent = job.compensation?.summaryComponents?.find(
    (component) => component.compensationType === "Salary",
  );

  return {
    salaryMin:
      typeof salaryComponent?.minValue === "number" ? salaryComponent.minValue : null,
    salaryMax:
      typeof salaryComponent?.maxValue === "number" ? salaryComponent.maxValue : null,
  };
}

export async function fetchAshbyBoardJobs(source: PublicJobBoardSource) {
  const url = new URL(`https://api.ashbyhq.com/posting-api/job-board/${source.key}`);
  url.searchParams.set("includeCompensation", "true");

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

  const payload = (await response.json()) as AshbyResponse;

  return (payload.jobs ?? []).flatMap((job) => {
    if (!job.title || !job.jobUrl || job.isListed === false) {
      return [];
    }

    const description = job.descriptionPlain?.replace(/\s+/g, " ").trim() ?? "";

    if (!description) {
      return [];
    }

    const { salaryMin, salaryMax } = findSalaryBounds(job);

    return [
      {
        id: `ashby:${source.key}:${job.id ?? job.jobUrl}`,
        provider: "ashby",
        sourceLabel: source.label,
        title: job.title.trim(),
        company: source.company,
        location: job.location?.trim() || "Location not detected",
        description,
        redirectUrl: job.applyUrl?.trim() || job.jobUrl.trim(),
        salaryMin,
        salaryMax,
        createdAt: typeof job.publishedAt === "string" ? job.publishedAt : null,
        category: job.department?.trim() || job.team?.trim() || null,
        contractType: job.employmentType?.trim() || null,
        contractTime: null,
      } satisfies JobSearchListing,
    ];
  });
}
