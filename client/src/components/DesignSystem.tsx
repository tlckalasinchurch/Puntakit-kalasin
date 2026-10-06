import {
  AlertCircle,
  ChevronDown,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "wouter";
import { ICON_SIZE } from "@/lib/icon-sizes";

/**
 * Shared screen-level UI, Design System V2.
 *
 * These exist because every screen used to solve the same four problems
 * differently (see docs/PUNTAKIT_UX_UI_AUDIT_2026-10.md §9): a heading block, an
 * empty state, an error state, and a status chip. One implementation each means
 * one visual language and one set of accessibility guarantees.
 *
 * Rules these components enforce (design.md §8, prompt §12–15):
 * - Empty / error / loading are mutually exclusive and visually distinct.
 * - Empty states always say what is missing, why it matters, and what to do.
 * - Errors show a friendly Thai sentence; the technical string is available but
 *   never the primary message.
 * - Every interactive element is >= 44px and keyboard reachable.
 * - Decorative icons are `aria-hidden`; meaningful icons carry their own label.
 */

// ---------------------------------------------------------------------------
// PageHeader — "where am I / what is this for / what do I do next" in one block
// ---------------------------------------------------------------------------

export interface PageAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
}

interface PageHeaderProps {
  /** Page name in Thai — the `h1`. Keep it short and concrete. */
  title: string;
  /** One sentence: what the user can do here. Optional but recommended. */
  description?: string;
  /** The single most important action. Rendered first and visually dominant. */
  primaryAction?: PageAction;
  /** Download / filter / refresh style actions. Visually secondary. */
  secondaryActions?: PageAction[];
  children?: React.ReactNode;
}

function ActionButton({
  action,
  variant,
}: {
  action: PageAction;
  variant: "primary" | "secondary";
}) {
  const Icon = action.icon;
  const className =
    variant === "primary"
      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] focus-visible:ring-offset-2 disabled:opacity-50"
      : "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";
  const inner = (
    <>
      {Icon && <Icon size={ICON_SIZE.sm} aria-hidden="true" />}
      <span>{action.loading ? "กำลังบันทึก…" : action.label}</span>
    </>
  );

  if (action.href && !action.disabled) {
    // Internal routes go through wouter so PageHeader actions keep SPA
    // navigation (Cmd/Ctrl+click, no full document reload). Only genuinely
    // external URLs fall back to a plain anchor.
    const isInternal =
      action.href.startsWith("/") && !action.href.startsWith("//");
    if (isInternal) {
      return (
        <Link href={action.href} className={className}>
          {inner}
        </Link>
      );
    }
    return (
      <a href={action.href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={action.onClick}
      disabled={action.disabled || action.loading}
    >
      {inner}
    </button>
  );
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="type-display-md text-[var(--color-ink)]">{title}</h1>
        {description && (
          <p className="type-caption mt-2 max-w-2xl text-[var(--color-body-muted)]">
            {description}
          </p>
        )}
      </div>
      {(primaryAction || (secondaryActions?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {primaryAction && (
            <ActionButton action={primaryAction} variant="primary" />
          )}
          {secondaryActions?.map(action => (
            <ActionButton
              key={action.label}
              action={action}
              variant="secondary"
            />
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — a labelled block inside a page
// ---------------------------------------------------------------------------

export function SectionHeader({
  id,
  title,
  description,
  action,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h2 id={id} className="type-lead text-[var(--color-ink)]">
          {title}
        </h2>
        {description && (
          <p className="type-caption mt-1 text-[var(--color-body-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="type-caption-strong inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusChip — the only way a status is presented
// ---------------------------------------------------------------------------

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info-strong)]",
  neutral:
    "bg-[var(--color-canvas-soft)] text-[var(--color-text-secondary)]",
};

/**
 * Status is never conveyed by colour alone: the label is always present, and
 * `tone` only reinforces it.
 */
export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`type-fine inline-flex shrink-0 items-center rounded-[var(--radius-xs)] px-2 py-1 font-semibold ${
        TONE_CLASS[tone]
      } ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EmptyState — never a dead end
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  /** What is missing and why it matters , in one or two plain sentences. */
  description?: string;
  /** What the user can do next. Omit only when there is genuinely nothing. */
  action?: PageAction;
  /** Render without the surrounding card border (inside an existing card). */
  inset?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  inset = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 px-6 py-10 text-center ${
        inset
          ? ""
          : "rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]"
      }`}
    >
      {Icon && (
        <Icon
          size={ICON_SIZE["2xl"]}
          aria-hidden="true"
          className="text-[var(--color-body-muted)]"
        />
      )}
      <p className="type-body-strong text-[var(--color-ink)]">{title}</p>
      {description && (
        <p className="type-caption max-w-sm text-[var(--color-body-muted)]">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-1">
          <ActionButton action={action} variant="primary" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState — friendly sentence first, technical detail on request
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  /** Friendly Thai sentence. Never a raw server or exception string. */
  title?: string;
  /** Optional plain-language hint at what the user can do. */
  description?: string;
  /** The underlying technical message, shown only behind a disclosure. */
  technical?: string;
  onRetry?: () => void;
  retryLabel?: string;
  inset?: boolean;
}

export function ErrorState({
  title = "โหลดข้อมูลไม่สำเร็จ",
  description = "ระบบเชื่อมต่อไม่สำเร็จในขณะนี้ กรุณาลองอีกครั้ง",
  technical,
  onRetry,
  retryLabel = "ลองอีกครั้ง",
  inset = false,
}: ErrorStateProps) {
  const detailsId = useId();
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-start sm:justify-between ${
        inset
          ? ""
          : "rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          size={ICON_SIZE.lg}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-error)]"
        />
        <div className="min-w-0">
          <p className="type-body-strong text-[var(--color-ink)]">{title}</p>
          <p className="type-caption mt-1 text-[var(--color-body-muted)]">
            {description}
          </p>
          {technical && (
            <>
              <button
                type="button"
                onClick={() => setShowTechnical(v => !v)}
                aria-expanded={showTechnical}
                aria-controls={detailsId}
                className="type-caption mt-2 inline-flex min-h-11 items-center gap-1 text-[var(--color-body-muted)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
              >
                รายละเอียดทางเทคนิค
                <ChevronDown
                  size={ICON_SIZE.xs}
                  aria-hidden="true"
                  className={`transition-transform motion-reduce:transition-none ${
                    showTechnical ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showTechnical && (
                <p
                  id={detailsId}
                  className="type-fine mt-1 break-words rounded-[var(--radius-sm)] bg-[var(--color-canvas-soft)] p-3 font-mono text-[var(--color-text-secondary)]"
                >
                  {technical}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] px-4 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/** Field-level error, rendered directly under the control it belongs to. */
export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="type-caption mt-1.5 text-[var(--color-error)]" role="alert">
      {children}
    </p>
  );
}

/**
 * Form-level error, for failures that are not attributable to one field.
 * Announces itself to assistive tech because it appears asynchronously.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="type-caption flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--color-error)]/10 p-3 text-[var(--color-error)]"
    >
      <AlertCircle size={ICON_SIZE.sm} aria-hidden="true" className="mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field — label + control + hint + error, correctly associated
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string;
  /** Rendered under the label; use for "ทำไมต้องกรอกช่องนี้" explanations. */
  hint?: string;
  error?: string;
  required?: boolean;
  /** Fine print under the control, e.g. a format example. */
  help?: string;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  help,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy =
    [hint ? hintId : null, help ? helpId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="type-caption-strong block text-[var(--color-ink)]"
      >
        {label}
        {required && (
          <span className="ml-1 text-[var(--color-error)]" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (จำเป็น)</span>}
      </label>
      {hint && (
        <p id={hintId} className="type-fine mt-0.5 text-[var(--color-body-muted)]">
          {hint}
        </p>
      )}
      <div className="mt-1.5">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": Boolean(error),
        })}
      </div>
      {help && (
        <p id={helpId} className="type-fine mt-1.5 text-[var(--color-body-muted)]">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="type-caption mt-1.5 text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — dialog semantics, Escape, focus trap, dirty-guard, scroll containment
// ---------------------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Action row. Put the primary action last; it is the one on the right. */
  footer?: React.ReactNode;
  /** `wide` for a two-column form, `full` for the mobile-sheet layout. */
  size?: "default" | "wide";
  /**
   * Escape / backdrop / close-button dismissal of a modal the user has typed
   * into asks for confirmation instead of silently discarding the input.
   * Pass `false` only for a modal whose body state is safe to throw away.
   */
  discardGuard?: boolean;
}

/**
 * Open modals register themselves here so only the topmost one reacts to
 * Escape and Tab. Without it, a ConfirmDialog mounted above a form modal
 * closed both at once on a single Escape press.
 */
const openModalStack: number[] = [];
let nextModalId = 1;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DISMISS_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

const DISCARD_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-error)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "default",
  discardGuard = true,
}: ModalProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const discardGuardRef = useRef(discardGuard);
  discardGuardRef.current = discardGuard;
  // True once the user actually edited something inside this modal. Native
  // input/change events fire only for real user edits, so programmatic fills
  // and form resets never count as unsaved work.
  const dirtyRef = useRef(false);
  const confirmingRef = useRef(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const continueEditingRef = useRef<HTMLButtonElement>(null);

  const requestClose = useCallback(() => {
    if (confirmingRef.current || !discardGuardRef.current || !dirtyRef.current) {
      confirmingRef.current = false;
      setConfirmingDiscard(false);
      onCloseRef.current();
      return;
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    confirmingRef.current = true;
    setConfirmingDiscard(true);
  }, []);

  const resumeEditing = useCallback(() => {
    confirmingRef.current = false;
    setConfirmingDiscard(false);
    returnFocusRef.current?.focus?.();
    returnFocusRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = nextModalId++;
    idRef.current = id;
    openModalStack.push(id);

    const isTopmost = () =>
      openModalStack[openModalStack.length - 1] === idRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep Tab cycling inside the dialog: focus must never reach the page
      // behind it while it is open.
      const card = cardRef.current;
      if (!card) return;
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active || !card.contains(active)) {
        // Focus escaped the dialog (e.g. the browser moved it to <body>) —
        // pull it back instead of tabbing further outside.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const own = openModalStack.indexOf(id);
      if (own !== -1) openModalStack.splice(own, 1);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, requestClose]);

  // Reset the unsaved-work tracking each time the modal opens, and let any
  // real edit inside the card mark it dirty.
  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    confirmingRef.current = false;
    setConfirmingDiscard(false);
    const card = cardRef.current;
    const markDirty = () => {
      dirtyRef.current = true;
    };
    card?.addEventListener("input", markDirty, true);
    card?.addEventListener("change", markDirty, true);
    return () => {
      card?.removeEventListener("input", markDirty, true);
      card?.removeEventListener("change", markDirty, true);
    };
  }, [open]);

  // Move focus into the dialog so keyboard and screen-reader users land inside
  // it, and restore it to the trigger on close. Prefer the first *body* control
  // (a field, or the first action in the content) over the header close button —
  // landing on "close" makes a form feel like it opened to be dismissed.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const body = card?.querySelector<HTMLElement>("[data-modal-body]");
    const inBody = body?.querySelector<HTMLElement>(
      "input, select, textarea, button, [href]"
    );
    const first =
      inBody ??
      card?.querySelector<HTMLElement>("input, select, textarea, button, [href]");
    first?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  // When the discard warning appears, focus the safe choice — going back to
  // the form — so an accidental Enter cannot throw the work away.
  useEffect(() => {
    if (confirmingDiscard) continueEditingRef.current?.focus();
  }, [confirmingDiscard]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-black)]/50 p-0 sm:items-center sm:p-4"
      onClick={requestClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-[var(--color-canvas)] shadow-[var(--shadow)] outline-none sm:rounded-[var(--radius-lg)] ${
          size === "wide" ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-divider)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="type-body-strong text-[var(--color-ink)]"
            >
              {title}
            </h2>
            {description && (
              <p className="type-caption mt-1 text-[var(--color-body-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="ปิดหน้าต่างนี้"
            className="-mr-1 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
          >
            <X size={ICON_SIZE.md} aria-hidden="true" />
          </button>
        </div>

        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {confirmingDiscard && (
          <div
            role="alert"
            aria-live="polite"
            className="border-t border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-5 py-3"
          >
            <p className="type-caption text-[var(--color-ink)]">
              มีข้อมูลที่ยังไม่ได้บันทึก ปิดหน้าต่างนี้เลยหรือไม่?
            </p>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={continueEditingRef}
                type="button"
                onClick={resumeEditing}
                className={DISMISS_BUTTON_CLASS}
              >
                แก้ไขต่อ
              </button>
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                className={DISCARD_BUTTON_CLASS}
              >
                ปิดโดยไม่บันทึก
              </button>
            </div>
          </div>
        )}

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-divider)] px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterDisclosure — filters that fold away on phones
// ---------------------------------------------------------------------------

/**
 * Wraps a page's secondary filters. From `sm` up the children render in place
 * (`display: contents`, so the parent's grid/flex layout still applies). On a
 * phone they sit behind one "ตัวกรอง" button, so the first screen shows the
 * list instead of four stacked dropdowns. Keep the search field OUTSIDE this
 * wrapper: searching is the first thing people do and must stay visible.
 */
export function FilterDisclosure({
  activeCount = 0,
  children,
}: {
  /** Number of filters currently narrowing the list; shown on the button. */
  activeCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="type-caption-strong flex min-h-11 w-full items-center justify-between rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] sm:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={ICON_SIZE.sm} aria-hidden="true" />
          ตัวกรอง{activeCount > 0 ? ` (${activeCount})` : ""}
        </span>
        <ChevronDown
          size={ICON_SIZE.sm}
          aria-hidden="true"
          className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} className={`${open ? "flex" : "hidden"} flex-col gap-3 sm:contents`}>
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ListPager — prev/next pagination for server-paged lists
// ---------------------------------------------------------------------------

/**
 * Renders nothing while everything fits on one page. The count label comes
 * from the API's `meta`, so the pager can never claim more pages than the
 * server actually has.
 */
export function ListPager({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const prevButtonClass =
    "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <nav
      aria-label="แบ่งหน้าข้อมูล"
      className="flex items-center justify-center gap-3 pt-1"
    >
      <button
        type="button"
        className={prevButtonClass}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ก่อนหน้า
      </button>
      <span
        aria-current="page"
        className="type-caption text-[var(--color-body-muted)]"
      >
        หน้า {page} จาก {totalPages}
      </span>
      <button
        type="button"
        className={prevButtonClass}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        ถัดไป
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// DataBar — a single honest data bar (no invented trends)
// ---------------------------------------------------------------------------

export function DataBar({
  value,
  max,
  label,
  tone = "ink",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "ink" | "error";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-canvas-soft)]"
      role="img"
      aria-label={label}
    >
      <div
        className={`h-full rounded-[var(--radius-pill)] ${
          tone === "error"
            ? "bg-[var(--color-error)]"
            : "bg-[var(--color-ink)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — initials, never an image we cannot load
// ---------------------------------------------------------------------------

export function InitialsAvatar({
  name,
  size = 44,
}: {
  name: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="type-caption-strong flex shrink-0 items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-canvas-soft)] text-[var(--color-ink)]"
    >
      {name.trim().slice(0, 1) || "?"}
    </span>
  );
}
