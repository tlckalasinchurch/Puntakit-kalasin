import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Field } from "@/components/DesignSystem";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { dateToIso, formatThaiDate, isoToDate } from "@/lib/date";
import { th } from "react-day-picker/locale";
import "react-day-picker/style.css";

/**
 * Thai date input.
 *
 * Native `type="date"` renders `mm/dd/yyyy` according to the *browser* locale,
 * which reads wrong in a Thai-first app when the browser is set to English.
 * This wraps react-day-picker (Thai locale) in a popover so both the picker
 * and the display are Thai regardless of browser settings. The value stays a
 * plain `YYYY-MM-DD` string, so the API contract is unchanged.
 */

/** Calendar caption: Thai month + Buddhist year ("ตุลาคม 2569"). */
function formatCaption(month: Date): string {
  const thaiMonth = month.toLocaleDateString("th-TH", { month: "long" });
  return `${thaiMonth} ${month.getFullYear() + 543}`;
}

const TRIGGER_CLASS =
  "inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-left text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:cursor-not-allowed disabled:opacity-50";

const CLEAR_CLASS =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-body-muted)] transition-colors hover:bg-[var(--color-canvas-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]";

interface DateFieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** `YYYY-MM-DD`, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show a "clear" affordance next to the trigger when a value is set. */
  clearable?: boolean;
  disabled?: boolean;
}

export function DateField({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder = "เลือกวันที่",
  clearable = false,
  disabled = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);
  const display = value ? formatThaiDate(value) : placeholder;

  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, "aria-describedby": describedBy, "aria-invalid": invalid }) => (
        <div className="flex items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                disabled={disabled}
                className={TRIGGER_CLASS}
              >
                <span className="truncate">{display}</span>
                <CalendarDays
                  size={ICON_SIZE.sm}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-body-muted)]"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={th}
                formatters={{ formatCaption }}
                selected={selected}
                onSelect={(day) => {
                  if (day) {
                    onChange(dateToIso(day));
                    setOpen(false);
                  }
                }}
                disabled={disabled}
              />
            </PopoverContent>
          </Popover>
          {clearable && value && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="ล้างวันที่"
              className={CLEAR_CLASS}
            >
              <X size={ICON_SIZE.md} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </Field>
  );
}
