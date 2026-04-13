import { type Tone } from "@/lib/utils";

type StatusBadgeProps = {
  tone?: Tone;
  children: React.ReactNode;
};

export function StatusBadge({
  tone = "neutral",
  children,
}: StatusBadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
