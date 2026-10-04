import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";

interface Option {
  id: string;
  name: string;
  nickname: string | null;
}

interface MemberPickerProps {
  /** Selected member id ("" = none). */
  value: string;
  /** Name to show for the selected member (the picker does not refetch it). */
  valueName: string;
  onChange: (id: string, name: string) => void;
  placeholder?: string;
}

const text = (m: Option) => (m.nickname ? `${m.name} (${m.nickname})` : m.name);

/**
 * Pick one member by typing a name or nickname. A dropdown of every member does
 * not work at a few hundred people, so this asks the API for the first 8 matches
 * as the person types (`/api/members?search=`). The chosen member shows as a
 * chip with a clear button. The listbox is keyboard-driven: arrows move the
 * highlight, Enter picks, Escape dismisses.
 */
export function MemberPicker({ value, valueName, onChange, placeholder = "พิมพ์ชื่อหรือชื่อเล่นเพื่อค้นหา" }: MemberPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const listboxVisible = options.length > 0 || failed || query.trim() !== "";

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setOptions([]);
      setFailed(false);
      setActiveIndex(-1);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      api
        .get<Option[]>(`/api/members?search=${encodeURIComponent(q)}&limit=8&sortBy=name&sortOrder=asc`)
        .then((rows) => active && (setOptions(rows ?? []), setFailed(false), setActiveIndex(-1)))
        .catch(() => active && (setOptions([]), setFailed(true), setActiveIndex(-1)));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-4 pr-1">
        <span className="type-caption-strong truncate text-[var(--color-ink)]">{valueName || "สมาชิกที่เลือก"}</span>
        <button
          type="button"
          onClick={() => onChange("", "")}
          aria-label="ล้างผู้ที่เลือก"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--color-body-muted)] hover:bg-[var(--color-canvas-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const pick = (m: Option) => {
    onChange(m.id, text(m));
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (query) {
        event.stopPropagation();
        setQuery("");
        setActiveIndex(-1);
      }
      return;
    }
    if (!options.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => {
        if (event.key === "ArrowDown") return i < 0 ? 0 : Math.min(i + 1, options.length - 1);
        return i <= 0 ? 0 : i - 1;
      });
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      pick(options[activeIndex]);
    }
  };

  return (
    <div className="relative">
      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={listboxVisible}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        aria-label="ค้นหาสมาชิก"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-3 text-sm text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
      />
      {listboxVisible && (
        <ul id={listId} role="listbox" className="mt-1.5 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          {failed ? (
            <li className="type-fine p-3 text-[var(--color-body-muted)]">ค้นหาไม่สำเร็จ ลองอีกครั้ง</li>
          ) : options.length === 0 ? (
            <li className="type-fine p-3 text-[var(--color-body-muted)]">ไม่พบสมาชิกที่ตรงกับ “{query.trim()}”</li>
          ) : (
            options.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected="false"
              >
                <button
                  type="button"
                  onClick={() => pick(m)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`type-caption flex min-h-11 w-full items-center px-3 text-left text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-focus)] ${
                    i === activeIndex ? "bg-[var(--color-canvas-soft)]" : ""
                  }`}
                >
                  {text(m)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
