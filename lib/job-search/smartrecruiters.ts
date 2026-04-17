import { type JobSearchListing, type PublicJobBoardSource } from "@/lib/job-search/types";

type SmartRecruitersListItem = {
  id?: string | number;
  name?: string;
  releasedDate?: string;
  company?: {
    name?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: {
    label?: string;
  };
  typeOfEmployment?: {
    label?: string;
  };
};

type SmartRecruitersListResponse = {
  content?: SmartRecruitersListItem[];
};

type SmartRecruitersDetailResponse = {
  id?: string | number;
  name?: string;
  releasedDate?: string;
  active?: boolean;
  applyUrl?: string;
  company?: {
    name?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: {
    label?: string;
  };
  typeOfEmployment?: {
    label?: string;
  };
  jobAd?: {
    sections?: Record<
      string,
      {
        title?: string;
        text?: string;
      }
    >;
  };
};

function buildLocationLabel(location: SmartRecruitersDetailResponse["location"]) {
  if (!location) {
    return "Location not detected";
  }

  const parts = [location.city, location.region, location.country]
    .map((value) => value?.trim())
    .filter(Boolean);

  if (location.remote) {
    parts.unshift("Remote");
  }

  return parts.length > 0 ? parts.join(", ") : "Location not detected";
}

function buildDescription(detail: SmartRecruitersDetailResponse) {
  const sections = detail.jobAd?.sections;

  if (!sections) {
    return "";
  }

  return Object.values(sections)
    .flatMap((section) => [section.title, section.text])
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPostingDetail(source: PublicJobBoardSource, postingId: string) {
  const response = await fetch(
    `https://api.smartrecruiters.com/v1/companies/${source.key}/postings/${postingId}`,
    {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 0,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SmartRecruitersDetailResponse;
}

export async function fetchSmartRecruitersCompanyJobs(source: PublicJobBoardSource) {
  const listResponse = await fetch(
    `https://api.smartrecruiters.com/v1/companies/${source.key}/postings?limit=100`,
    {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 0,
      },
    },
  );

  if (!listResponse.ok) {
    return [] as JobSearchListing[];
  }

  const payload = (await listResponse.json()) as SmartRecruitersListResponse;
  const detailResults = await Promise.allSettled(
    (payload.content ?? [])
      .map((posting) => posting.id?.toString())
      .filter((postingId): postingId is string => Boolean(postingId))
      .map((postingId) => fetchPostingDetail(source, postingId)),
  );

  return detailResults.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value) {
      return [];
    }

    const detail = result.value;

    if (!detail.name || !detail.applyUrl || detail.active === false) {
      return [];
    }

    const description = buildDescription(detail);

    if (!description) {
      return [];
    }

    return [
      {
        id: `smartrecruiters:${source.key}:${detail.id ?? detail.applyUrl}`,
        provider: "smartrecruiters",
        sourceLabel: source.label,
        title: detail.name.trim(),
        company: detail.company?.name?.trim() || source.company,
        location: buildLocationLabel(detail.location),
        description,
        redirectUrl: detail.applyUrl,
        salaryMin: null,
        salaryMax: null,
        createdAt: typeof detail.releasedDate === "string" ? detail.releasedDate : null,
        category: detail.department?.label?.trim() || null,
        contractType: detail.typeOfEmployment?.label?.trim() || null,
        contractTime: null,
      } satisfies JobSearchListing,
    ];
  });
}
