import { useState } from "react";
import type { MembershipType } from "@shared/membership";

/**
 * The membership card. It draws only what the register gives it: no name,
 * number, photo or date is baked into artwork, so a changed photo or name is
 * simply the next render. Contact details are never part of the card.
 *
 * Visual language follows the owner's reference card (emerald field, gold rule
 * and frame, church emblem, nickname plate, big care-group number); sizing is
 * in `.pk-card` (index.css) so it scales from a phone to a wide dialog.
 */
export interface MemberCardData {
  name: string;
  nickname: string | null;
  /** Printed number, already zero-padded ("00304"), or null before one is assigned. */
  memberNo: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  careGroupName: string | null;
  bodyName: string | null;
  churchName: string;
  membership: { type: MembershipType | null; label: string; endsOn: string | null } | null;
}

const KIND_SHORT: Record<MembershipType, string> = {
  extraordinary: "วิสามัญ",
  ordinary: "สามัญ",
};

/** dd/mm/yyyy in Thailand's calendar day, whatever the viewer's timezone. */
export function formatCardDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+07:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** The first number in the care group's name ("แคร์ 13" -> "13"), or null. */
export function careNumberOf(careGroupName: string | null | undefined): string | null {
  const match = careGroupName?.match(/\d{1,3}/);
  return match ? String(Number(match[0])) : null;
}

/** What goes on the white plate: the nickname, else the first word of the name. */
export function plateTextOf(name: string, nickname: string | null): string {
  const nick = nickname?.trim();
  if (nick) return nick;
  return name.trim().split(/\s+/)[0] ?? name;
}

export function MemberCard({ card }: { card: MemberCardData }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const careNo = careNumberOf(card.careGroupName);
  const type = card.membership?.type ?? null;
  const joined = formatCardDate(card.joinedAt);
  const validUntil = formatCardDate(card.membership?.endsOn);
  const showPhoto = card.avatarUrl && !photoFailed;

  return (
    <article className="pk-card" aria-label={`บัตรสมาชิก ${card.name}`} data-testid="member-card">
      <svg className="pk-card__decor" viewBox="0 0 1000 630" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="pk-card-gold" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: "var(--card-gold-lo)" }} />
            <stop offset="0.45" style={{ stopColor: "var(--card-gold-hi)" }} />
            <stop offset="1" style={{ stopColor: "var(--card-gold-mid)" }} />
          </linearGradient>
          <radialGradient id="pk-card-glow" cx="0.82" cy="0.45" r="0.35">
            <stop offset="0" style={{ stopColor: "var(--card-emerald-hi)", stopOpacity: 0.9 }} />
            <stop offset="1" style={{ stopColor: "var(--card-emerald-hi)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <rect width="1000" height="630" fill="url(#pk-card-glow)" />
        {/* a quiet cross on the right, as in the reference */}
        <g style={{ fill: "var(--card-emerald-hi)", opacity: 0.55 }}>
          <rect x="868" y="300" width="22" height="170" rx="3" />
          <rect x="836" y="332" width="86" height="20" rx="3" />
        </g>
        <path d="M0 560 C 220 640 430 560 640 505 S 900 440 1000 420 L1000 630 L0 630 Z" style={{ fill: "var(--card-emerald-lo)", opacity: 0.7 }} />
        <path d="M0 548 C 220 628 430 548 640 493 S 900 428 1000 408" fill="none" stroke="url(#pk-card-gold)" strokeWidth="9" />
        <path d="M0 572 C 220 652 430 572 640 517 S 900 452 1000 432" fill="none" stroke="url(#pk-card-gold)" strokeWidth="3" opacity="0.8" />
      </svg>

      <figure className="pk-card__photo">
        {showPhoto ? (
          <img src={card.avatarUrl!} alt={`รูปถ่ายของ ${card.name}`} onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="pk-card__photo-empty">
            <strong aria-hidden="true">{card.name.trim().slice(0, 1)}</strong>
            <span>ยังไม่มีรูป</span>
          </div>
        )}
      </figure>

      <div className="pk-card__brand">
        <span className="pk-card__emblem" aria-hidden="true">
          <img src="/church-emblem.png" alt="" />
        </span>
        <p className="pk-card__brandline">TRUE LIFE IN CHRIST CHURCH</p>
        <p className="pk-card__ribbon">{card.churchName}</p>
      </div>

      {careNo && (
        <div className="pk-card__num" aria-label={`พันธกิจ ${careNo}`}>
          {careNo}
          <small>พันธกิจ</small>
        </div>
      )}

      <div className="pk-card__plate" title={plateTextOf(card.name, card.nickname)}>
        {plateTextOf(card.name, card.nickname)}
      </div>
      {type && <div className="pk-card__kind">{KIND_SHORT[type]}</div>}
      <p className="pk-card__name">{card.name}</p>
      <p className="pk-card__member">MEMBER</p>

      <dl className="pk-card__meta">
        <dt>หมายเลขสมาชิก</dt>
        <dd className="pk-card__no">{card.memberNo ? `No. ${card.memberNo}` : "No. —"}</dd>
        <dt>วันที่สมัคร</dt>
        <dd>{joined ? `สมัคร ${joined}` : ""}</dd>
      </dl>
      {validUntil && type && (
        <p className="pk-card__valid">
          <span className="pk-card__valid-type">{KIND_SHORT[type]} · </span>ถึง {validUntil}
        </p>
      )}
    </article>
  );
}
