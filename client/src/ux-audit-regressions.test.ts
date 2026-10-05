import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for the 2026-10 UX/UI audit fixes.
 *
 * Like design-system-consistency.test.ts these are deliberately cheap and
 * structural: they pin the fix so it cannot silently regress, without trying
 * to verify pixels. Behaviour itself lives in the components these tests read.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

/** Strip comments so a documented example is not reported as a violation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("UX audit Batch A — accessibility foundations", () => {
  it("viewport meta does not disable pinch-zoom", () => {
    const html = read("client/index.html");
    const viewport = html.match(/<meta\s+name="viewport"[^>]*>/)?.[0] ?? "";
    expect(viewport).not.toEqual("");
    expect(viewport).not.toMatch(/maximum-scale/i);
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(viewport).toMatch(/width=device-width/);
  });

  it("login and sign-up pages link both legal documents", () => {
    const legal = read("client/src/components/LegalLinks.tsx");
    expect(legal).toMatch(/href="\/privacy"/);
    expect(legal).toMatch(/href="\/terms"/);
    for (const page of [
      "client/src/pages/ClerkSignInPage.tsx",
      "client/src/pages/ClerkSignUpPage.tsx",
    ]) {
      expect(read(page)).toMatch(/<LegalLinks\s*\/>/);
    }
  });

  it("Modal keeps keyboard users inside the dialog", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/"Tab"/); // explicit focus trap
    expect(src).toMatch(/openModalStack/); // only the topmost modal acts on Escape
    expect(src).toMatch(/tabIndex=\{-1\}/); // card is a focus fallback
  });

  it("Modal asks before discarding dirty form input", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/discardGuard/);
    // Dirtiness is detected from real user edits, not from snapshot diffing
    // that would misfire on programmatically filled forms.
    expect(src).toMatch(/addEventListener\("input",\s*markDirty,\s*true\)/);
    expect(src).toMatch(/addEventListener\("change",\s*markDirty,\s*true\)/);
    expect(src).toMatch(/มีข้อมูลที่ยังไม่ได้บันทึก/);
    expect(src).toMatch(/ปิดโดยไม่บันทึก/);
  });

  it("ActionButton and SectionHeader navigate internally through wouter Link", () => {
    const src = stripComments(read("client/src/components/DesignSystem.tsx"));
    expect(src).toContain('from "wouter"');
    expect(src).toMatch(/<Link\s+href=\{action\.href\}/);
    // Exactly one raw anchor may remain: the genuinely-external fallback.
    const rawAnchors = src.match(/<a\s+href=\{action\.href\}/g) ?? [];
    expect(rawAnchors.length).toBe(1);
  });

  it("ConfirmDialog still rides on the shared Modal", () => {
    expect(read("client/src/components/ConfirmDialog.tsx")).toMatch(
      /<Modal\s+open/
    );
  });
});

describe("UX audit Batch B — form safety and feedback", () => {
  const FORM_PAGES = [
    "client/src/pages/Announcements.tsx",
    "client/src/pages/Events.tsx",
    "client/src/pages/Ministries.tsx",
    "client/src/pages/Church.tsx",
    "client/src/pages/Feed.tsx",
    "client/src/pages/member/MemberProfile.tsx",
    "client/src/components/PrayerRequestModal.tsx",
  ] as const;

  it("every form surfaces submission failure inline, not only as a toast", () => {
    const offenders: string[] = [];
    for (const rel of FORM_PAGES) {
      const src = read(rel);
      if (!src.includes("FormError")) offenders.push(rel);
    }
    // Inbox has two forms, each with its own error state.
    const inbox = read("client/src/pages/Inbox.tsx");
    expect(inbox).toMatch(/\{captureError && <FormError>/);
    expect(inbox).toMatch(/\{publishError && <FormError>/);
    expect(
      offenders,
      `render the shared <FormError> in the form body:\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("Feed and PrayerRequestModal validate required fields inline, not via toast", () => {
    const feed = read("client/src/pages/Feed.tsx");
    expect(feed).toMatch(/<Field label="หัวข้อ" required error=\{titleError/);
    expect(feed).not.toMatch(/toast\.error\("กรุณากรอกหัวข้อ"\)/);

    const prayer = read("client/src/components/PrayerRequestModal.tsx");
    expect(prayer).toMatch(/error=\{titleError/);
    expect(prayer).toMatch(/error=\{contentError/);
    // The submit button stays enabled until the request starts; validation
    // happens on submit with inline errors.
    expect(prayer).toMatch(/disabled=\{submitting\}/);
  });

  it("removing a member from a group asks for confirmation", () => {
    const src = read("client/src/pages/Groups.tsx");
    // Two confirmations: delete group, and the previously unconfirmed member removal.
    expect(src.match(/<ConfirmDialog/g)?.length).toBe(2);
    expect(src).toMatch(/ยืนยันการนำออกจากกลุ่ม/);
    expect(src).toMatch(/setRemoveTarget\(gm\)/);
  });
});

describe("UX audit Batch C — navigation and data access", () => {
  it("Members keeps filters, page and the selected member in the URL", () => {
    const src = read("client/src/pages/Members.tsx");
    expect(src).toMatch(/useSearchParams\(\)/);
    for (const key of [
      "q",
      "area",
      "status",
      "membershipStatus",
      "page",
      "member",
    ]) {
      expect(src).toMatch(new RegExp(`p\\.(?:set|delete)\\("${key}"`));
    }
    // Deep links fetch the member directly; a dead id cleans itself from the URL.
    expect(src).toMatch(/\/api\/members\/\$\{selectedMemberId\}/);
    // List rows open the detail through the URL, not through object state.
    expect(src).not.toMatch(/setSelectedMember\(member\)/);
    expect(src).not.toMatch(/onClick=\{\(\) => setSelectedMember\(m\)\}/);
  });

  it("Feed, Inbox and FollowUps page through the server's meta, not silently capped", () => {
    for (const rel of [
      "client/src/pages/Feed.tsx",
      "client/src/pages/Inbox.tsx",
      "client/src/pages/FollowUps.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/getWithMeta</);
      expect(src).toMatch(/params\.set\("page", String\(pageToLoad\)\)/);
      expect(src).toMatch(/<ListPager/);
      expect(src).toMatch(/setMeta\(res\.meta \?\? null\)/);
    }
  });

  it("ListPager renders nothing when everything fits on one page", () => {
    const src = read("client/src/components/DesignSystem.tsx");
    expect(src).toMatch(/function ListPager/);
    expect(src).toMatch(/if \(totalPages <= 1\) return null;/);
    expect(src).toMatch(/aria-label="แบ่งหน้าข้อมูล"/);
  });
});

describe("UX audit Batch D — visual consistency and performance", () => {
  it("removed the dead legacy CSS blocks", () => {
    const css = read("client/src/index.css");
    for (const dead of [
      "metric-card",
      "journey-step",
      "activity-icon",
      "member-table",
      "hero-wash",
      "profile-stat",
      "danger-button",
      "data-scroll-reveal",
      "modal-full-button",
      "bar-col",
      "chart-tooltip",
    ]) {
      expect(css.includes(dead), `.dead class reintroduced: ${dead}`).toBe(
        false
      );
    }
  });

  it("live legacy surfaces use tokens, not hardcoded hex", () => {
    const css = read("client/src/index.css");
    for (const hex of [
      "#d88c1b",
      "#d6455e",
      "#f3c6a3",
      "#209364",
      "#e3f7ec",
      "#e4f1ff",
      "#fff4dc",
    ]) {
      expect(css.includes(hex), `hardcoded hex reintroduced: ${hex}`).toBe(
        false
      );
    }
    expect(css).toMatch(/\.mini-icon\.green/); // was missing while Profile used it
    expect(css).toMatch(/\.profile-footer-icon/);
  });

  it("loading labels use …, never ASCII dots", () => {
    const offenders: string[] = [];
    for (const rel of [
      "client/src/components/ConfirmDialog.tsx",
      "client/src/components/PrayerRequestModal.tsx",
      "client/src/pages/Attendance.tsx",
      "client/src/pages/Announcements.tsx",
      "client/src/pages/Feed.tsx",
      "client/src/pages/Inbox.tsx",
      "client/src/pages/Church.tsx",
      "client/src/pages/Events.tsx",
      "client/src/pages/Ministries.tsx",
    ]) {
      if (/กำลัง[^"]*\.\.\."/.test(read(rel))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("every page sets a per-route document title", () => {
    expect(read("client/src/hooks/usePageTitle.ts")).toMatch(
      /document\.title = /
    );
    const pages = [
      "Announcements",
      "Attendance",
      "Church",
      "ClerkSignInPage",
      "ClerkSignUpPage",
      "ComingSoon",
      "Events",
      "Feed",
      "FollowUps",
      "Groups",
      "Home",
      "Inbox",
      "Map",
      "Members",
      "Ministries",
      "NotFound",
      "Privacy",
      "Profile",
      "Reports",
      "Terms",
    ];
    for (const name of pages) {
      expect(
        read(`client/src/pages/${name}.tsx`).includes("usePageTitle("),
        `${name}.tsx misses usePageTitle`
      ).toBe(true);
    }
    for (const name of [
      "MemberAttendance",
      "MemberEvents",
      "MemberGroup",
      "MemberHome",
      "MemberProfile",
    ]) {
      expect(
        read(`client/src/pages/member/${name}.tsx`).includes("usePageTitle("),
        `${name}.tsx misses usePageTitle`
      ).toBe(true);
    }
  });

  it("fonts load via preconnected head links, not a blocking CSS @import", () => {
    const html = read("client/index.html");
    expect(html).toMatch(
      /rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"/
    );
    expect(html).toMatch(/fonts\.googleapis\.com\/css2\?family=Prompt/);
    expect(read("client/src/index.css")).not.toMatch(
      /@import\s+url\("https:\/\/fonts/
    );
  });

  it("Home ships no un-prioritised hero image as its LCP", () => {
    // The 2026-10 audit flagged the hero PNG as an un-dimensioned LCP image;
    // the home redesign since removed it entirely (search + care CTA lead the
    // section now). If a hero image ever returns, it must be dimensioned and
    // prioritised.
    const src = read("client/src/pages/Home.tsx");
    const heroImg = src.match(/<img[^>]*IDENTITY_IMAGE[^>]*>/);
    if (heroImg) {
      expect(heroImg[0]).toMatch(/fetchPriority="high"/);
      expect(heroImg[0]).toMatch(/width=/);
      expect(heroImg[0]).toMatch(/height=/);
    }
  });

  it("Reports stats use th-TH number formatting", () => {
    const src = read("client/src/pages/Reports.tsx");
    expect(
      src.match(/toLocaleString\("th-TH"/g)?.length
    ).toBeGreaterThanOrEqual(5);
    expect(src).toMatch(/tabular-nums/);
  });
});

describe("UX audit Batch E — remaining low-severity items", () => {
  it("GlobalSearch is a real search field with a Cmd/Ctrl+K accelerator", () => {
    const src = read("client/src/components/GlobalSearch.tsx");
    expect(src).toMatch(/type="search"/);
    expect(src).toMatch(/autoComplete="off"/);
    expect(src).toMatch(/spellCheck=\{false\}/);
    expect(src).toMatch(/metaKey \|\| event\.ctrlKey/);
    expect(src).toMatch(/"Escape" && query/);
  });

  it("theme-color follows the in-app theme toggle, not prefers-color-scheme", () => {
    const html = read("client/index.html");
    expect(html).toMatch(/<meta name="theme-color" content="#f5f5f7" \/>/);
    expect(html).not.toMatch(/theme-color[^>]*media=/);
    const ctx = read("client/src/contexts/ThemeContext.tsx");
    expect(ctx).toMatch(/meta\[name="theme-color"\]/);
    expect(ctx).toMatch(/"#000000" : "#f5f5f7"/);
  });

  it("ErrorBoundary speaks Thai and announces itself", () => {
    const src = read("client/src/components/ErrorBoundary.tsx");
    expect(src).toMatch(/role="alert"/);
    expect(src).toMatch(/เกิดข้อผิดพลาดที่ไม่คาดคิด/);
    expect(src).not.toMatch(/An unexpected error occurred/);
  });

  it("option fetches never masquerade as empty lists", () => {
    const feed = read("client/src/pages/Feed.tsx");
    expect(feed).toMatch(/setGroupsError\(true\)/);
    expect(feed).toMatch(/loadGroups/);
    expect(feed).not.toMatch(/catch\(\(\) => setGroups\(\[\]\)\)/);
    const attendance = read("client/src/pages/Attendance.tsx");
    expect(attendance).toMatch(/ตัวกรองกลุ่มยังใช้ไม่ได้ในตอนนี้/);
    expect(attendance.match(/catch\(\(\) => \{\}\)/g) ?? []).toEqual([]);
  });

  it("both shells provide a skip link and a named main landmark", () => {
    for (const rel of [
      "client/src/components/layout/AppLayout.tsx",
      "client/src/components/layout/MemberAppLayout.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/ข้ามไปที่เนื้อหาหลัก/);
      expect(src).toMatch(/<main id="/);
    }
  });

  it("opaque code fields opt out of spellcheck and autofill; touch gestures stay snappy", () => {
    const attendance = read("client/src/pages/Attendance.tsx");
    expect(attendance).toMatch(/spellCheck=\{false\}/);
    expect(attendance).toMatch(/autoComplete="off"/);
    const css = read("client/src/index.css");
    expect(css).toMatch(/touch-action: manipulation/);
    expect(css).toMatch(/-webkit-tap-highlight-color: transparent/);
  });
});

describe("UX audit Batch F — pages added after the first audit", () => {
  const NEW_PAGES = [
    "client/src/pages/CareToday.tsx",
    "client/src/pages/ImportData.tsx",
    "client/src/pages/ImportDuplicates.tsx",
    "client/src/pages/ImportOrgData.tsx",
    "client/src/pages/OrgChart.tsx",
  ] as const;

  it("every new page sets a per-route document title", () => {
    for (const rel of NEW_PAGES) {
      expect(
        read(rel).includes("usePageTitle("),
        `${rel} misses usePageTitle`
      ).toBe(true);
    }
  });

  it("no nonexistent tokens or hardcoded hex in new pages", () => {
    const src = read("client/src/pages/ImportOrgData.tsx");
    expect(src).not.toMatch(/--color-danger/);
    expect(src).not.toMatch(/#b42318/);
    expect(src).toMatch(/var\(--color-error\)/);
  });

  it("ErrorState gets a friendly Thai title with the raw message behind technical", () => {
    for (const rel of [
      "client/src/pages/ImportData.tsx",
      "client/src/pages/ImportDuplicates.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/<ErrorState\s|<ErrorState$/m);
      expect(src).toMatch(/technical=\{error\}/);
      expect(src).not.toMatch(/description=\{error\}/);
    }
  });

  it("duplicate candidates are paged, not rendered 100 at once", () => {
    const src = read("client/src/pages/ImportDuplicates.tsx");
    expect(src).toMatch(/CARDS_PER_PAGE = 20/);
    expect(src).toMatch(/<ListPager/);
  });

  it("ImportData precheck dump sits behind a technical disclosure", () => {
    const src = read("client/src/pages/ImportData.tsx");
    expect(src).toMatch(/<details className="mt-3">/);
    expect(src).toMatch(/รายละเอียดทางเทคนิคของผลตรวจ/);
  });

  it("MemberPicker is a keyboard-usable combobox with 44px targets", () => {
    const src = read("client/src/components/MemberPicker.tsx");
    expect(src).toMatch(/aria-activedescendant/);
    expect(src).toMatch(/ArrowDown/);
    expect(src).toMatch(/size-11/);
    expect(src).not.toMatch(/size-9/);
  });

  it("MobileBottomNav marks the active item with a shape cue, not colour alone", () => {
    const src = read("client/src/components/layout/MobileBottomNav.tsx");
    expect(src).toMatch(/bg-\[var\(--color-accent-soft\)\]/);
  });

  it("Sidebar drawer closes on Escape with focus moved in and restored", () => {
    const src = read("client/src/components/layout/Sidebar.tsx");
    expect(src).toMatch(/drawerRef/);
    expect(src).toMatch(/"Escape"/);
    expect(src).not.toMatch(/hover:bg-white\/10/);
  });
});

describe("Audit 2026-10-04 — permissions, error states and mobile forms", () => {
  it("admin-shell routes are gated by role sets from shared/roles.ts", () => {
    const app = read("client/src/App.tsx");
    expect(app).toMatch(/ADMIN_SHELL_ROLES/);
    expect(app).toMatch(
      /<Route path="\/members">\s*<ProtectedRoute allow=\{ADMIN_SHELL_ROLES\}>/
    );
    expect(app).toMatch(
      /<Route path="\/reports">\s*<ProtectedRoute allow=\{PRIVILEGED_ROLES\}>/
    );
    expect(app).toMatch(
      /<Route path="\/import\/org">\s*<ProtectedRoute allow=\{ADMIN_ROLES\}>/
    );
    // The member PWA stays open to every signed-in role.
    expect(app).toMatch(/<Route path="\/app">\s*<ProtectedRoute>/);
  });

  it("ProtectedRoute sends member accounts to /app and shows a Thai denial for others", () => {
    const src = read("client/src/components/ProtectedRoute.tsx");
    expect(src).toMatch(/navigate\("\/app"\)/);
    expect(src).toMatch(/data-testid="route-denied"/);
    expect(src).toContain("คุณไม่มีสิทธิ์เปิดหน้านี้");
  });

  it("an expired session on any API call re-syncs auth instead of looping on 'connection failed'", () => {
    expect(read("client/src/lib/api.ts")).toMatch(/UNAUTHORIZED_EVENT/);
    expect(read("client/src/contexts/AuthContext.tsx")).toMatch(
      /useResyncOnUnauthorized\(retry\)/
    );
  });

  it("ErrorBoundary hides the stack trace outside development", () => {
    const src = read("client/src/components/ErrorBoundary.tsx");
    expect(src).toMatch(/import\.meta\.env\.DEV\s*&&/);
    expect(src).toContain("กลับหน้าหลัก");
  });

  it("form-level errors add the 'check the data' hint only for rejected input", () => {
    for (const page of [
      "Announcements",
      "Events",
      "Ministries",
      "Church",
      "Inbox",
      "Members",
      "Groups",
      "Feed",
    ]) {
      const src = read(`client/src/pages/${page}.tsx`);
      expect(src, `${page}.tsx`).not.toMatch(
        /\$\{message\} กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง/
      );
      expect(src, `${page}.tsx`).toMatch(/withRecheckHint\(/);
    }
  });

  it("text fields are at least 16px on phones so iOS Safari does not zoom on focus", () => {
    for (const page of [
      "Church",
      "Attendance",
      "Feed",
      "Events",
      "Announcements",
      "Ministries",
      "Reports",
      "Inbox",
    ]) {
      const src = read(`client/src/pages/${page}.tsx`);
      expect(src, `${page}.tsx`).toMatch(
        /min-h-11 w-full[^"]*text-base md:text-sm/
      );
    }
  });

  it("the bottom-nav menu button lines up with its siblings", () => {
    const src = read("client/src/components/layout/MobileBottomNav.tsx");
    expect(src).toMatch(
      /<span aria-hidden="true" className="flex size-9 items-center justify-center">\s*<Menu/
    );
  });

  it("index.css has a global :focus-visible fallback and no dangling design-doc reference", () => {
    const css = read("client/src/index.css");
    expect(css).toMatch(/:where\([^)]*\):focus-visible/);
    expect(css).not.toContain("PUNTAKIT_DESIGN_SYSTEM_V2.md");
  });

  it("brand-spec.md uses the same Sunken colour as index.css", () => {
    const sunken = read("client/src/index.css").match(
      /--color-canvas-sunken:\s*(#[0-9a-f]{6})/i
    )?.[1];
    expect(sunken).toBeTruthy();
    expect(read("brand-spec.md").toLowerCase()).toContain(
      sunken!.toLowerCase()
    );
  });

  it("a render error stays inside the page area so the shell keeps working", () => {
    expect(read("client/src/components/layout/AppLayout.tsx")).toMatch(
      /<RouteErrorBoundary>\{children\}<\/RouteErrorBoundary>/
    );
    expect(read("client/src/components/layout/MemberAppLayout.tsx")).toMatch(
      /<RouteErrorBoundary>\{children\}<\/RouteErrorBoundary>/
    );
    const src = read("client/src/components/RouteErrorBoundary.tsx");
    expect(src).toMatch(/resetKey/);
    expect(src).toMatch(/import\.meta\.env\.DEV/);
  });

  it.each(["Announcements", "Events", "Ministries", "Church"])(
    "%s shows Thai field errors next to the control, not only a browser tooltip",
    page => {
      const src = read(`client/src/pages/${page}.tsx`);
      expect(src).toMatch(/noValidate/);
      expect(src).toMatch(/requiredErrors\(form,/);
      expect(src).toMatch(/fieldErrorsFrom\(err\)/);
      expect(src).toMatch(/error=\{fieldErrors\./);
    }
  );

  it("quick follow-up buttons cannot be double-clicked", () => {
    expect(read("client/src/pages/Members.tsx")).toMatch(
      /disabled=\{creatingFollowUp\}/
    );
    expect(read("client/src/pages/Feed.tsx")).toMatch(
      /disabled=\{followUpActivityId !== null\}/
    );
  });
});

describe("UX audit P1 fixes — interaction race and accessibility guards", () => {
  it("serializes attendance status mutations per member and ignores stale responses", () => {
    const src = read("client/src/pages/Attendance.tsx");
    expect(src).toMatch(/statusRequestRef/);
    expect(src).toMatch(/pendingStatus/);
    expect(src).toMatch(/disabled=\{pendingStatus\[m\.id\] !== undefined\}/);
    expect(src).toMatch(
      /statusRequestRef\.current\.get\(memberId\) !== requestId/
    );
    expect(src).toMatch(/attendanceRef\.current/);
  });

  it("guards attendance loaders and renders a retryable summary error", () => {
    const src = read("client/src/pages/Attendance.tsx");
    expect(src).toMatch(/liveRequestRef/);
    expect(src).toMatch(/absenteesRequestRef/);
    expect(src).toMatch(/summaryRequestRef/);
    expect(src).toMatch(/summaryError/);
    expect(src).toMatch(/title="โหลดสรุปการเข้าร่วมไม่สำเร็จ"/);
  });

  it("guards shared resource loads against stale responses and unmounts", () => {
    const src = read("client/src/hooks/useResource.ts");
    expect(src).toMatch(/requestSeq/);
    expect(src).toMatch(/mounted/);
    expect(src).toMatch(/requestId !== requestSeq\.current/);
    expect(src).toMatch(
      /mounted\.current && requestId === requestSeq\.current/
    );
  });

  it("resets Inbox pagination and prevents duplicate row transitions", () => {
    const src = read("client/src/pages/Inbox.tsx");
    expect(src).toMatch(/setPage\(1\);\s*void load\(1\)/);
    expect(src).toMatch(/transitioningIds/);
    expect(src).toMatch(/transitioningRows/);
    expect(src).toMatch(/disabled=\{transitioningRows\[row\.id\]\}/);
  });

  it("keeps the mobile sidebar inside a modal focus loop", () => {
    const src = read("client/src/components/layout/Sidebar.tsx");
    expect(src).toMatch(/event\.key !== "Tab"/);
    expect(src).toMatch(/aria-modal=\{open \? "true" : undefined\}/);
    expect(src).toMatch(/event\.shiftKey/);
  });

  it("uses accessible MemberPicker option state and announcements", () => {
    const src = read("client/src/components/MemberPicker.tsx");
    expect(src).toMatch(/aria-autocomplete="list"/);
    expect(src).toMatch(/aria-selected=\{i === activeIndex\}/);
    expect(src).toMatch(/role="status"[\s\S]*aria-live="polite"/);
    expect(src).not.toMatch(/role="option"[\s\S]*?<button/);
  });

  it("clears PrayerRequestModal state on intentional close", () => {
    const src = read("client/src/components/PrayerRequestModal.tsx");
    expect(src).toMatch(/const resetForm = \(\) =>/);
    expect(src).toMatch(/const handleClose = \(\) =>/);
    expect(src).toMatch(/onClose=\{handleClose\}/);
    expect(src).toMatch(/onClick=\{handleClose\}/);
  });
});
