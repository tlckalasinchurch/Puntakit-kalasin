import { Modal } from "@/components/DesignSystem";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CANCEL_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:opacity-50";

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
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open onClose={onCancel} title={title} description={description}>
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
          className={CONFIRM_BUTTON_CLASS}
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? "กำลังลบ..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
