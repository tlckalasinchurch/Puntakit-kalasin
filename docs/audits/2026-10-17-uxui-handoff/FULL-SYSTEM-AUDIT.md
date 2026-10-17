# Puntakit full-system theme / responsive / LINE audit (read-only) — 2026-10-17

Git: branch `docs/uxui-audit-handoff-20261017` @ b88b2c1 (1 unpushed docs commit over origin/main adf615b), tree clean, stash HOLD (BLOCKER 2) intact. No file changed by this audit.

Evidence legend: [S] static code read, [B] real Chromium run (Playwright, dev stack, demo role admin; touch emulation on tablet/phone), [P] production build served statically, [V] screenshot viewed, [NV] NOT VERIFIED.
Browser reality: only Chromium. Safari/WebKit, Android Chrome, real iOS and LINE In-App Browser were NOT run.

## B. Architecture map
- Theme: `ThemeProvider defaultTheme="dark" switchable` (App.tsx:275). State in useState; `.dark` class + `meta[theme-color]` + localStorage written in a useEffect (ThemeContext.tsx:33-52). No matchMedia / system preference.
- Tokens: `client/src/index.css` (2976 lines): `:root` V2 tokens (teal #0c7c82), `.dark` token remap (line ~1443), `--shell-nav-*` for both navs, `--clay-*` (only CareToday.tsx), `.pk-*` glass/premium classes dark-only. 11 `!important`, 32 `.dark` selectors.
- Hard-coded colour in TSX is low: hex in 5 files (chart.tsx 5, Members/MemberHome/Attendance 2 each), `dark:` in 3 files, palette classes in MemberHome (6), Logo, LambHero.
- Shells: AppLayout (Sidebar >=1024px `lg`, MobileBottomNav `lg:hidden`) and MemberAppLayout (own bottom nav, max-w 600-760px; `/app` home 1440px). Safe area: `viewport-fit=cover`, `--safe-*` vars, nav pads `--safe-b`. `--app-vh` = 100dvh with 100vh fallback (comment names LINE in-app browser).
- Auth: first-party PIN, cookie `puntakit_session` httpOnly, SameSite=Lax, Secure in prod, 7 day TTL (firstPartyAuth.ts:16,59-68). No OAuth, no LIFF, no external redirect.
- Routes: 35 in App.tsx; guards ADMIN_SHELL_ROLES / CREATE_ROLES / PRIVILEGED_ROLES / MEMBERSHIP_VIEW_ROLES / SUPER_ADMIN_ROLES / ADMIN_ROLES (not changed).
- Existing tests touching this: design-tokens, design-system-consistency, sidebar-contrast-contract, bottom-nav-contrast (new), ux-audit-regressions, viewport-and-install, premium-shell-contract, member-pwa-contract, home-a11y-contract.

## C. Findings
| ID | Sev | Finding | Evidence | Root cause | Fix direction |
|---|---|---|---|---|---|
| F1 | P1 | White flash for dark users before React mounts (dark is the default) | [P] prod build, JS off: html bg rgb(255,255,255) for OS-dark and OS-light; `.dark` absent. dist/index.html: render-blocking CSS, module JS deferred. [S] ThemeContext.tsx:34 adds `.dark` only in useEffect; index.css:7 `:root{background:#fff}` | theme applied after hydration; no pre-paint script | tiny inline script in index.html head sets class + theme-color from localStorage/default before CSS; keep ThemeContext as is. CSP impact [NV] |
| F2 | P2 | Mascot images show pale rectangles inside dark cards | [V] iPad 820 dark `/app`: 3 light boxes on dark teal cards. Assets `/lamb/*.webp` via LambMascot.tsx:9-12 | opaque light background baked into asset | transparent or dark-variant assets, or a tinted frame; assets from the user |
| F3 | P2 | Bottom nav is a flat full-width bar, not the floating pill the reference shows; on iPad 820 five items spread ~164px apart | [V] iPad portrait home/members; `.pk-nav` index.css ~1727; premium-shell-contract notes flat nav (commit 1327fae) | deliberate earlier decision (flat, no blur) | design decision, see roadmap Phase 2 |
| F4 | P2 | Avatar initials show Thai leading vowels (ไ โ แ เ) | [V] /members light iPad; [S] `slice(0,1)` in Attendance.tsx:756,980, Profile.tsx:43, DesignSystem.tsx:906, MemberCard.tsx:90; `initialOf` used only in Home.tsx | helper not adopted | use `initialOf` everywhere |
| F5 | P2 | Contrast: primary on accent-soft 4.27:1 (light) on 14px text; profile avatar 2.15:1 (dark) | [B] computed contrast 33 routes x dark+light @390 (earlier handoff P2-2/P2-3) | token pair | text ink token on soft fills; on-primary on teal avatar |
| F6 | P2 | Three overlapping visual systems | [S] V2 tokens + `--clay-*` (CareToday only) + `.pk-*` glass (dark only); [V] /care neumorphic vs flat elsewhere | incremental redesigns | converge /care onto V2 tokens; keep one elevation scale |
| F7 | P2 | LINE: CSV export opens `window.open(url,"_blank")` | [S] Attendance.tsx:512, Members.tsx:523, Reports.tsx:83 | download via new window | [NV] in LINE; test plan below; fallback: same-window `<a download>` |
| F8 | P3 | 100vh shells remain | [S] ErrorBoundary.tsx:32, ProtectedRoute.tsx:73, NotFound.tsx:11 use `min-h-screen`, while index.css:102 documents `--app-vh` | not migrated | use `--app-vh` |
| F9 | P3 | No system-preference option; first visit is dark regardless of OS | [S] no matchMedia in ThemeContext | product choice (PRODUCT.md) | optional "ตามระบบ" |
| F10 | P3 | Viewer Home heading without tiles; viewer still sees follow-up in sidebar | [V] earlier | after PR #62 | product decision |
| F11 | P3 | Email wraps mid-word on Profile @390; duplicate CTA in empty states; no `<main>` on /privacy /terms /404 | [V]/[B] | layout | small fixes |

Retracted: apparent overlap of `/church` "บันทึกข้อมูล" and bottom nav was a script artefact; after real wheel scroll the button spans y 683-727, nav top 776, hit-test lands on the button [B].

## D. Audit matrix (PASS / FAIL / NOT VERIFIED)
Cells cover all 30 audited routes unless noted. Chromium only.
| Check | iPhone 390 | iPad portrait 820 | iPad landscape 1180 | Laptop 1440 |
|---|---|---|---|---|
| Dark: theme class applies, no page errors | PASS | PASS | PASS | PASS |
| Light: theme class applies, no page errors | PASS | PASS | PASS | not run |
| No horizontal scroll | PASS | PASS | PASS | PASS |
| Navigation shows (bottom nav or sidebar) | PASS (bottom) | PASS (bottom; no sidebar) | PASS (sidebar; member app bottom) | PASS (sidebar) |
| Content clear of bottom nav at end of page | PASS | PASS | PASS | n/a |
| Touch targets >= 44px | PASS except 2 items (earlier audit) | not measured | not measured | not measured |
| Contrast text | FAIL F5 (390 only) | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED |
| Keyboard focus ring (/members, 8 Tabs) | - | - | - | PASS dark and light @1280 |
| First paint matches theme | FAIL F1 (all sizes; prod build) | | | |
| Safe area / dynamic toolbar | NOT VERIFIED (needs real iOS) | NOT VERIFIED | NOT VERIFIED | n/a |
| Orientation change live | NOT VERIFIED (both orientations rendered separately only) | | | |
| Keyboard open on mobile | NOT VERIFIED | | | |
| Safari / Android Chrome | NOT VERIFIED | | | |
| **LINE In-App Browser** (login, session, downloads, camera, theme, safe area) | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | n/a |

Per-role: only `admin` and `viewer` rendered. group_leader, ministry_leader, staff, member, super_admin NOT VERIFIED visually (their route guards read from code only).

## LINE In-App Browser — code facts and test plan
Facts [S]: no LIFF/LINE SDK, no OAuth, no callback route; PIN sign-in posts to same origin and navigates with `location.assign("/")` (PinSignInPage.tsx:45); cookie SameSite=Lax so same-site flows are fine; external LINE link only `https://line.me/ti/p/~id` with target=_blank (CareToday.tsx:379); PWA install prompt and push are feature-detected (pwa.ts) so absence in a WebView degrades silently; photo sheet uses `<input type=file capture=environment>` (MissionPhotoSheet.tsx:206).
ASSUMPTIONS (unverified): LINE's iOS WebView keeps its own cookie/localStorage jar, so a Safari login and the stored theme do not carry over; downloads via `window.open` may not work.
Test plan (needs a real iPhone and an Android phone with LINE, and a staging URL): open the link from a LINE chat; sign in with PIN; reload and background the app 5 min (session); toggle theme and reload; bottom nav vs home indicator; open the keyboard in a form (Members search, Church form) and check the bottom nav/save button; take a photo from the camera and from the library; tap each CSV export; tap the LINE contact link and return; airplane-mode the page for the error state. Record device, OS, LINE version, result.

## E. Root cause ranking
1. F1 theme boot (affects every page and every dark-default user, easiest fix).
2. F5/F4 token and helper adoption (several pages, small fixes).
3. F2 mascot assets (member home, dark mode).
4. F6 three visual systems (cause of "light/dark not satisfying" on /care and glass areas).
5. F3 nav style (design decision, affects all mobile pages).
6. F7/F8 LINE-specific risk (unknown until tested).
Why light/dark feels off (evidence-based): flash on load (F1), light boxes in dark (F2), low-contrast pairs (F5), and mixed elevation languages (F6). Tokens themselves are largely consistent (few hard-coded colours).

## F. Remediation roadmap (each phase = its own small PR, gates: pnpm check, test, build)
1. Theme boot + tokens: `client/index.html`, `client/src/contexts/ThemeContext.tsx` (only if needed), `client/src/index.css` (token pairs F5), new `client/src/theme-boot-contract.test.ts`. Risk: CSP blocking inline script [NV]; moderate. Test: contract test + Playwright no-JS/first-paint on prod build.
2. Shared components + nav: avatar (`DesignSystem.tsx`) + `initialOf`, `.pk-nav` styling (needs the floating-vs-flat decision), tablet nav spacing. Files: `index.css`, `MobileBottomNav.tsx`, `MemberAppLayout.tsx`, `premium-shell-contract.test.ts`, `ux-audit-regressions.test.ts`. Risk: tests pin the flat nav.
3. Member home: LambHero/LambMascot and assets (user provides transparent art), card radius and elevation.
4. Member, Care, Follow-up pages: converge /care off `--clay-*`, profile layout, empty states.
5. Admin and dashboard: tables on 820px, Home viewer heading.
6. LINE compatibility: run the test plan first; only then change export links / `--app-vh` leftovers (F7, F8). No LINE SDK unless the plan proves a need.
7. Accessibility and final: tablet contrast scan, focus order, text scaling 200%, reduced motion, regression tests, light/dark screenshot goldens.
Dependencies: 1 before 2-5; 6 needs real devices; 3 needs assets.

## G. Acceptance criteria (measurable)
- First paint background equals the active theme (dark user: no frame with rgb(255,255,255)) on the production build.
- Text contrast >= 4.5:1 (>= 3:1 large/icons) on all routes in both themes at 390, 820, 1180, 1440 (scripted scan, 0 failures).
- 0 horizontal scroll and 0 controls under 44x44 on touch viewports, all routes, both themes.
- Bottom nav never covers the last interactive element; respects `env(safe-area-inset-bottom)`.
- Avatars never start with a Thai leading vowel; test in `initials.test.ts` + a grep test for `slice(0, 1)` in avatar code.
- No page uses a palette or hex colour outside tokens (contract test).
- LINE: test plan executed on >= 1 iOS and 1 Android device with recorded results; login persists across reload; CSV export works or has a verified fallback.
- `pnpm check`, `pnpm test`, `pnpm build` green; CI green.

## H. Approval gate
Proposed Phase 1 (theme boot + contrast tokens). Files: client/index.html, client/src/index.css, client/src/contexts/ThemeContext.tsx (if needed), client/src/theme-boot-contract.test.ts (new). Test plan: new contract test, rerun the contrast script (390, both themes), prod-build first-paint probe, pnpm check/test/build. No change to routes, roles, API, DB, breakpoints, or brand teal.
