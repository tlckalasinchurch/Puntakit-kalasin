import { useId, useState } from "react";
import { Search, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ICON_SIZE } from "@/lib/icon-sizes";
import { cn } from "@/lib/utils";

// The search contract today covers members only (name, nickname, phone, email via
// GET /api/members?search=). Extend this one component when groups/places/events join.
const PLACEHOLDER = "ค้นหาสมาชิก";
const LABEL = "ค้นหาสมาชิก";
const SCOPE_HINT = "ค้นหาด้วยชื่อ ชื่อเล่น เบอร์โทร หรืออีเมล";

export function globalSearchPath(query: string) {
  return `/members?search=${encodeURIComponent(query)}`;
}

interface GlobalSearchProps {
  variant?: "compact" | "prominent";
  className?: string;
}

export function GlobalSearch({
  variant = "compact",
  className,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const hintId = useId();
  const prominent = variant === "prominent";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(globalSearchPath(trimmed));
  };

  return (
    <div className={cn("w-full", className)}>
      <form
        role="search"
        aria-label={LABEL}
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            size={ICON_SIZE.md}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-body-muted)]"
          />
          <Input
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={PLACEHOLDER}
            aria-label={LABEL}
            aria-describedby={prominent ? hintId : undefined}
            title={SCOPE_HINT}
            className={cn(
              "rounded-[var(--radius-pill)] bg-[var(--color-canvas)] pl-11 pr-11 text-[var(--color-ink)] placeholder:text-[var(--color-body-muted)]",
              prominent ? "h-12 text-[17px] md:text-[17px]" : "h-11"
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างการค้นหา"
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-circle)] text-[var(--color-body-muted)] outline-none hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)]"
            >
              <X size={ICON_SIZE.xs} />
            </button>
          )}
        </div>
        {prominent && (
          <Button type="submit" className="h-12 shrink-0">
            ค้นหา
          </Button>
        )}
      </form>
      {prominent && (
        <p
          id={hintId}
          className="type-caption mt-2 pl-4 text-[var(--color-body-muted)]"
        >
          {SCOPE_HINT}
        </p>
      )}
    </div>
  );
}
