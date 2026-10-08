import { Clock, Lock, MapPin, MoreVertical, Pencil, Trash2, UserCheck, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { StatusChip } from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { parseCareGroupDescription } from "@shared/orgView";
import {
  CATEGORY_LABELS,
  CATEGORY_TONES,
  ORG_LEVEL_LABELS,
  PRIVACY_LABELS,
  STATUS_LABELS,
  type GroupItem,
} from "./types";

/**
 * GroupCard — presentation of a single group in the list (Phase 5B).
 *
 * Extracted from Groups.tsx — no changes to behavior, styling, or logic.
 * Pure presentation: receives data and callbacks, makes no API calls.
 *
 * Handles:
 * - Long Thai group names (wraps, doesn't truncate the heading)
 * - Missing data (conditional rendering for area, schedule, location, etc.)
 * - Large member counts (toLocaleString)
 * - Mobile width (flex-col, min-w-0)
 */

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

function RowMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={iconButtonClass}
      >
        <MoreVertical size={ICON_SIZE.md} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-1 shadow-[var(--shadow)]"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
  tone = "default",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={`type-caption flex min-h-11 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)] ${
        tone === "danger" ? "text-[var(--color-error)]" : "text-[var(--color-ink)]"
      }`}
    >
      <Icon size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0" />
      {label}
    </button>
  );
}

interface GroupCardProps {
  group: GroupItem;
  bodyNameById: Map<string, string>;
  canEdit: boolean;
  isAdmin: boolean;
  onViewMembers: (group: GroupItem) => void;
  onEdit: (group: GroupItem) => void;
  onDelete: (group: GroupItem) => void;
}

export function GroupCard({
  group: grp,
  bodyNameById,
  canEdit,
  isAdmin,
  onViewMembers,
  onEdit,
  onDelete,
}: GroupCardProps) {
  const [, navigate] = useLocation();

  const statusCfg = STATUS_LABELS[grp.status] ?? STATUS_LABELS.active;
  const privacyCfg = PRIVACY_LABELS[grp.privacy] ?? PRIVACY_LABELS.public;
  const leaderLabel = grp.orgLevel === "body" ? "หนบ." : grp.orgLevel === "care" ? "หนค." : "ผู้นำ";
  const leaderText =
    grp.leaderMemberName ||
    (grp.orgLevel === "care" ? parseCareGroupDescription(grp.description).careLeaderName : null) ||
    grp.leaderName ||
    null;
  const schedule = [grp.meetingDay, grp.meetingTime].filter(Boolean).join(" · ");

  return (
    <li
      key={grp.id}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {grp.orgLevel && (
            <StatusChip tone={grp.orgLevel === "body" ? "success" : "info"}>
              {ORG_LEVEL_LABELS[grp.orgLevel]}
            </StatusChip>
          )}
          {!(grp.orgLevel && (grp.category === "cell" || grp.category === "general")) && (
            <StatusChip tone={CATEGORY_TONES[grp.category] ?? "neutral"}>
              {CATEGORY_LABELS[grp.category] ?? grp.category}
            </StatusChip>
          )}
        </div>
        <StatusChip tone={statusCfg.tone}>{statusCfg.label}</StatusChip>
      </div>

      <div className="min-w-0">
        <h2 className="type-body-strong text-[var(--color-ink)]">{grp.name}</h2>
        {grp.parentGroupId && bodyNameById.get(grp.parentGroupId) && (
          <p className="type-caption mt-1 text-[var(--color-body-muted)]">
            {bodyNameById.get(grp.parentGroupId)}
          </p>
        )}
        {grp.area && (
          <p className="type-caption mt-1 flex items-center gap-1.5 text-[var(--color-body-muted)]">
            <MapPin size={ICON_SIZE.xs} aria-hidden="true" />
            {grp.area}
          </p>
        )}
        {!grp.orgLevel && grp.description && (
          <p className="type-caption mt-2 line-clamp-3 text-[var(--color-text-secondary)]">
            {grp.description}
          </p>
        )}
      </div>

      <dl className="type-caption space-y-1.5 text-[var(--color-text-secondary)]">
        {schedule && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">เวลานัดพบ</dt>
            <Clock
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
            />
            <dd>{schedule}</dd>
          </div>
        )}
        {grp.meetingLocation && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">สถานที่นัดพบ</dt>
            <MapPin
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
            />
            <dd className="min-w-0 break-words">{grp.meetingLocation}</dd>
          </div>
        )}
        <div className="flex items-start gap-2">
          <dt className="sr-only">ผู้รับผิดชอบ</dt>
          <Users
            size={ICON_SIZE.sm}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
          />
          <dd>
            {leaderLabel} {leaderText ?? <span className="text-[var(--color-body-muted)]">ยังไม่ระบุ</span>}
          </dd>
        </div>
        {grp.privacy !== "public" && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">การเปิดเผยข้อมูล</dt>
            <Lock
              size={ICON_SIZE.sm}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-text-quaternary)]"
            />
            <dd>{privacyCfg.label}</dd>
          </div>
        )}
      </dl>

      {/* One primary action, then one overflow menu. */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        <button
          type="button"
          onClick={() => onViewMembers(grp)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          <span className="whitespace-nowrap">สมาชิก {grp.memberCount.toLocaleString("th-TH")} คน</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/attendance?groupId=${grp.id}`)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          <UserCheck size={ICON_SIZE.sm} aria-hidden="true" className="shrink-0" />
          <span className="whitespace-nowrap">เช็คชื่อ</span>
        </button>
        {(canEdit || isAdmin) && (
          <RowMenu label={`ตัวเลือกเพิ่มเติมของกลุ่ม ${grp.name}`}>
            {close => (
              <>
                {canEdit && (
                  <MenuItem
                    icon={Pencil}
                    label="แก้ไขข้อมูลกลุ่ม"
                    onSelect={() => {
                      close();
                      onEdit(grp);
                    }}
                  />
                )}
                {isAdmin && (
                  <MenuItem
                    icon={Trash2}
                    label="ลบกลุ่ม"
                    tone="danger"
                    onSelect={() => {
                      close();
                      onDelete(grp);
                    }}
                  />
                )}
              </>
            )}
          </RowMenu>
        )}
      </div>
    </li>
  );
}
