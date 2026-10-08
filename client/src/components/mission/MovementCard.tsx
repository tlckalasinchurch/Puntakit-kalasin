import { ArrowUpRight, Users } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

type MovementCardProps = {
  group: string;
  values: number[];
  newPeople: number;
  trend: string;
  status?: "active" | "quiet" | "attention";
};

export function MovementCard({ group, values, newPeople, trend, status = "active" }: MovementCardProps) {
  const max = Math.max(...values, 1);

  return (
    <article className={"movement-card card-surface " + status}>
      <div className="movement-card-header">
        <div>
          <span className={"movement-status-dot " + status} />
          <strong>{group}</strong>
        </div>
        <span className="movement-trend"><ArrowUpRight size={ICON_SIZE.xs} /> {trend}</span>
      </div>
      <div className="movement-chart" aria-label={"การเคลื่อนไหวของ " + group}>
        {values.map((value, index) => (
          <span key={group + "-" + index} style={{ height: Math.max((value / max) * 100, 8) + "%" }} title={value + " คน"} />
        ))}
      </div>
      <div className="movement-card-footer">
        <span><Users size={ICON_SIZE.xs} /> ล่าสุด {values.at(-1) ?? 0} คน</span>
        <b>🆕 +{newPeople} คนใหม่</b>
      </div>
    </article>
  );
}
