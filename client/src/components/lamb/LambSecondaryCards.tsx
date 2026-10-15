import { Link } from "wouter";
import { ChevronRight, Headset, MapPin, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_SHELL_ROLES, hasRole } from "@shared/roles";
import { LambMascot } from "./LambMascot";

interface SecondaryCard {
  href: string;
  icon: typeof MapPin;
  title: string;
  detail: string;
  mascot?: "welcome" | "support";
  wide?: boolean;
  /** Roles that may open the destination; others do not see the card. */
  roles?: readonly string[];
}

const CARDS: SecondaryCard[] = [
  {
    href: "/app/group",
    icon: UserPlus,
    title: "ชวนเข้ากลุ่ม",
    detail: "ชวนสมาชิกใหม่มาร่วมพันธกิจด้วยกัน",
    mascot: "welcome",
    wide: true,
  },
  {
    href: "/map",
    icon: MapPin,
    title: "ดูแผนที่",
    detail: "กลุ่มของเรา",
    // /map is an admin-shell route: for a member it redirects straight back to /app.
    roles: ADMIN_SHELL_ROLES,
  },
  {
    href: "tel:043811800",
    icon: Headset,
    title: "ช่วยเหลือ",
    detail: "ติดต่อทีมงาน",
    mascot: "support",
  },
];

/**
 * Secondary cards — invite to group, view map, contact support.
 * Each maps to a real feature or a truthful unavailable state.
 */
export function LambSecondaryCards() {
  const { user } = useAuth();
  const visible = CARDS.filter(card => !card.roles || hasRole(user?.role, card.roles as typeof ADMIN_SHELL_ROLES));
  // An odd card left over after filtering takes the full row instead of leaving half of it empty.
  const cards = visible.map((card, i) => (i === visible.length - 1 && visible.length === 2 && !card.wide ? { ...card, wide: true } : card));
  return (
    <section aria-label="เมนูเสริม">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:h-full lg:grid-rows-[1fr_1fr]">
        {cards.map(({ href, icon: Icon, title, detail, mascot, wide }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--lamb-surface)] bg-[var(--lamb-mint)] p-4 shadow-[0_8px_24px_rgba(29,29,31,0.06)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C7C82] ${
              wide ? "col-span-2 min-h-[150px] sm:min-h-[160px] lg:min-h-0" : "min-h-[150px] lg:min-h-0"
            }`}
          >
            <span>
              <span className="flex items-center gap-2 font-bold text-[var(--lamb-primary)]">
                <Icon size={20} aria-hidden="true" />
                {title}
              </span>
              <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">
                {detail}
              </span>
            </span>
            {mascot && (
              <LambMascot
                pose={mascot}
                className="pointer-events-none absolute -right-2 -bottom-2 w-24 select-none"
              />
            )}
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="absolute right-3 bottom-3 text-[var(--lamb-primary)]/40"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
