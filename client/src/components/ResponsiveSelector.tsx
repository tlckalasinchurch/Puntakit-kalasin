import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import {
  filterSelectorOptions,
  type SelectorOption,
} from "@/components/responsiveSelectorLogic";

export interface SelectorGroup {
  label: string;
  options: SelectorOption[];
}
export type { SelectorOption } from "@/components/responsiveSelectorLogic";

interface ResponsiveSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  options?: SelectorOption[];
  groups?: SelectorGroup[];
  placeholder?: string;
  label: string;
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
  ariaInvalid?: boolean | "false" | "true" | "grammar" | "spelling";
  className?: string;
}

const triggerClass =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-left text-base text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const optionClass =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 text-left text-[var(--color-ink)] transition-colors hover:bg-[var(--color-state-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)]";

export function ResponsiveSelector({
  value,
  onValueChange,
  options = [],
  groups = [],
  placeholder = "เลือก…",
  label,
  emptyLabel,
  disabled = false,
  id,
  describedBy,
  ariaInvalid,
  className,
}: ResponsiveSelectorProps) {
  const isMobile = useIsMobile();
  const [isTouchLayout, setIsTouchLayout] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const allOptions = useMemo(
    () => [...options, ...groups.flatMap(group => group.options)],
    [options, groups]
  );
  const selected = allOptions.find(option => option.value === value);
  const isSearchable = allOptions.length > 8;
  const filteredOptions = filterSelectorOptions(options, query);
  const filteredGroups = groups
    .map(group => ({ ...group, options: filterSelectorOptions(group.options, query) }))
    .filter(group => group.options.length > 0);

  useEffect(() => {
    const touchMedia = window.matchMedia("(pointer: coarse)");
    const updateTouchLayout = () => {
      setIsTouchLayout(touchMedia.matches || navigator.maxTouchPoints > 0);
    };
    updateTouchLayout();
    touchMedia.addEventListener("change", updateTouchLayout);
    return () => touchMedia.removeEventListener("change", updateTouchLayout);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
  };

  const optionList = (
    <div id={listId} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
      {emptyLabel && (
        <button type="button" className={optionClass} onClick={() => choose("")} aria-selected={!value} role="option">
          <span>{emptyLabel}</span>
          {!value && <Check size={18} aria-hidden="true" className="text-[var(--color-primary-ink)]" />}
        </button>
      )}
      {filteredOptions.map(option => (
        <SelectorOptionRow key={option.value} option={option} selected={option.value === value} onChoose={choose} />
      ))}
      {filteredGroups.map(group => (
        <div key={group.label} className="mt-2 first:mt-0">
          <p className="type-fine px-3 py-1.5 font-semibold text-[var(--color-body-muted)]">{group.label}</p>
          {group.options.map(option => (
            <SelectorOptionRow key={option.value} option={option} selected={option.value === value} onChoose={choose} />
          ))}
        </div>
      ))}
      {query.trim() && filteredOptions.length === 0 && filteredGroups.length === 0 && (
        <p role="status" aria-live="polite" className="type-caption p-4 text-[var(--color-body-muted)]">ไม่พบรายการที่ตรงกับ “{query.trim()}”</p>
      )}
    </div>
  );

  const search = (className = "") => (
    <div className={cn("relative", className)}>
      <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="ค้นหารายการ…"
        aria-label={`ค้นหา${label}`}
        className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-10 pr-3 text-base text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] md:text-sm"
      />
    </div>
  );

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-describedby={describedBy}
      aria-invalid={ariaInvalid}
      className={cn(triggerClass, className)}
    >
      <span className={cn("truncate", !selected && "text-[var(--color-body-muted)]")}>{selected?.label ?? placeholder}</span>
      <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
    </button>
  );

  if (isMobile || isTouchLayout) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <button type="button" id={id} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-describedby={describedBy} aria-invalid={ariaInvalid} className={cn(triggerClass, className)} onClick={() => setOpen(true)}>
          <span className={cn("truncate", !selected && "text-[var(--color-body-muted)]")}>{selected?.label ?? placeholder}</span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[var(--color-body-muted)]" />
        </button>
        <SheetContent side="bottom" className="z-[60] h-[min(88dvh,44rem)] max-h-[100dvh] gap-3 overflow-hidden rounded-t-[var(--radius-lg)] border-t border-[var(--color-hairline)] px-4 pb-[calc(1rem+var(--safe-b))]">
          <SheetHeader className="px-0 pb-0"><SheetTitle>{label}</SheetTitle><SheetDescription>เลือกจากข้อมูลที่มีสิทธิ์เข้าถึง</SheetDescription></SheetHeader>
          {isSearchable && search()}
          {optionList}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden p-1">
        {isSearchable && search("p-1")}
        {optionList}
      </PopoverContent>
    </Popover>
  );
}

function SelectorOptionRow({ option, selected, onChoose }: { option: SelectorOption; selected: boolean; onChoose: (value: string) => void }) {
  return (
    <button type="button" role="option" aria-selected={selected} className={cn(optionClass, selected && "bg-[var(--color-surface-selected)] font-semibold")} onClick={() => onChoose(option.value)}>
      <span className="truncate">{option.label}</span>
      {selected && <Check size={18} aria-hidden="true" className="shrink-0 text-[var(--color-primary-ink)]" />}
    </button>
  );
}
