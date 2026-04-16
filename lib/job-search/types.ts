export type JobSearchProvider = "adzuna" | "ashby" | "greenhouse" | "lever";

export type JobSearchListing = {
  id: string;
  provider: JobSearchProvider;
  sourceLabel: string;
  title: string;
  company: string;
  location: string;
  description: string;
  redirectUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: string | null;
  category: string | null;
  contractType: string | null;
  contractTime: string | null;
};

export type PublicJobBoardSource = {
  provider: "ashby" | "greenhouse" | "lever";
  key: string;
  company: string;
  label: string;
};
