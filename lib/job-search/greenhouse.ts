import { type PublicJobBoardSource, type JobSearchListing } from "@/lib/job-search/types";

type GreenhouseResponse = {
  jobs?: Array<{
    id?: number;
    title?: string;
    updated_at?: string;
    absolute_url?: string;
    content?: string;
    location?: {
      name?: string;
    };
  }>;
};

export async function fetchGreenhouseBoardJobs(source: PublicJobBoardSource) {
  const url = new URL(`https://boards-api.greenhouse.io/v1/boards/${source.key}/jobs`);
  url.searchParams.set("content", "true");

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

  const payload = (await response.json()) as GreenhouseResponse;

  return (payload.jobs ?? [])
    .flatMap((job) => {
      if (!job.title || !job.absolute_url) {
        return [];
      }

      const description = job.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

      if (!description) {
        return [];
      }

      return [
        {
          id: `greenhouse:${source.key}:${job.id ?? job.absolute_url}`,
          provider: "greenhouse",
          sourceLabel: source.label,
          title: job.title.trim(),
          company: source.company,
          location: job.location?.name?.trim() || "Location not detected",
          description,
          redirectUrl: job.absolute_url,
          salaryMin: null,
          salaryMax: null,
          createdAt: typeof job.updated_at === "string" ? job.updated_at : null,
          category: null,
          contractType: null,
          contractTime: null,
        } satisfies JobSearchListing,
      ];
    });
}
