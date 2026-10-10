import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { ICON_SIZE } from "@/lib/icon-sizes";

/**
 * Member PWA list primitives — one grouped surface per section, rows separated
 * by hairlines. Replaces the card-inside-a-card pattern: a section is a heading
 * plus ONE bordered surface, never a bordered box around bordered boxes.
 *
 * Tokens only (`--color-*`, `--radius-*`); text uses the `.type-*` classes and
 * nothing below 14px; every row target is >= 44px (`min-h-14` = 56px).
 */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]";

export function MemberListSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  /** Optional "see all" link beside the heading. */
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <h2 id={id} className="type-body-strong min-w-0 text-[var(--color-ink)]">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className={`type-caption-strong inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-sm)] px-1 text-[var(--color-primary)] hover:underline ${FOCUS}`}
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="divide-y divide-[var(--color-hairline)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        {children}
      </div>
    </section>
  );
}

interface RowBase {
  icon?: ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;
  /** Small coloured label above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

/** A tappable row: a wouter link, a plain `tel:`/external anchor, or a button. */
export function MemberListRow({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  href,
  onClick,
}: RowBase & { href?: string; onClick?: () => void }) {
  const className = `flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-canvas-soft)] motion-reduce:transition-none ${FOCUS}`;
  const body = (
    <>
      {Icon && (
        <span className="shrink-0 text-[var(--color-primary)]">
          <Icon size={ICON_SIZE.lg} aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        {eyebrow && (
          <span className="type-caption-strong block text-[var(--color-primary)]">
            {eyebrow}
          </span>
        )}
        <span className="type-body-strong block text-[var(--color-ink)]">
          {title}
        </span>
        {subtitle && (
          <span className="type-caption block text-[var(--color-body-muted)]">
            {subtitle}
          </span>
        )}
      </span>
      <ChevronRight
        size={ICON_SIZE.md}
        aria-hidden="true"
        className="shrink-0 text-[var(--color-body-muted)]"
      />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  if (href && /^(tel:|mailto:|https?:)/.test(href)) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href ?? "/app"} className={className}>
      {body}
    </Link>
  );
}

/** A non-interactive row, for content the member reads rather than taps. */
export function MemberListItem({ children }: { children: ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

/** The one quiet line shown when a list has nothing to list yet. */
export function MemberListEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="type-caption px-4 py-4 text-[var(--color-body-muted)]">
      {children}
    </p>
  );
}
