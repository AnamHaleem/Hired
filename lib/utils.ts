import type { CareerLane, JobLevel, JobStatus } from "@/lib/schemas";

export type Tone = "neutral" | "success" | "warning" | "info" | "accent";

const laneLabels: Record<CareerLane, string> = {
  senior_communications: "Senior Communications",
  strategic_marketing_partnerships: "Strategic Marketing / Partnerships",
  hybrid_review: "Hybrid Review",
};

const levelLabels: Record<JobLevel, string> = {
  manager: "Manager",
  senior_manager: "Senior Manager",
  director: "Director",
  senior_director: "Senior Director",
  vp_plus: "VP+",
  unknown: "Level TBD",
};

const statusTones: Record<JobStatus, Tone> = {
  new: "warning",
  approved: "success",
  discarded: "neutral",
};

export function getLaneLabel(lane: CareerLane) {
  return laneLabels[lane];
}

export function getLevelLabel(level: JobLevel) {
  return levelLabels[level];
}

export function getStatusTone(status: JobStatus) {
  return statusTones[status];
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
