import { Modal } from "@/components/DesignSystem";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  /** Label while submitting. Defaults to the delete wording used by existing callers. */
  busyLabel?: string;
  /** `primary` for non-destructive confirmations (e.g. loading data). Default `danger`. */
  tone?: "danger" | "primary";
  /** Optional key facts shown above the buttons, one per line. */
  details?: string[];
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

const CONFIRM_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-error)] px-4 text-sm font-semibold text-[var(--color-on-dark)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)] disabled:opacity-50";

/**
 * Confirmation dialog on the shared Modal, so it gets `role="dialog"`,
 * `aria-modal`, Escape handling, focus capture/restore and scroll containment.
 * The exported name and prop names are unchanged for existing callers, which
 * mount it conditionally (`{target && <ConfirmDialog … />}`) — hence open.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "ลบ",
  busyLabel = "กำลังลบ…",
  tone = "danger",
  details,
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open onClose={onCancel} title={title} description={description}>
      {details && details.length > 0 && (
        <ul className="mb-4 space-y-1.5 rounded-[var(--radius-md)] bg-[var(--color-canvas-soft)] p-3 text-sm text-[var(--color-ink)]">
          {details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={CANCEL_BUTTON_CLASS}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          ยกเลิก
        </button>
        <button
          type="button"
          className={tone === "primary" ? PRIMARY_BUTTON_CLASS : CONFIRM_BUTTON_CLASS}
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
