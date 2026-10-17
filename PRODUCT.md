# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Church staff and admins working at a desk (desktop-friendly admin workflows) and care/group leaders working mostly one-handed on a phone (mobile-first leader workflows), both equally first-class. Church members are a third audience via the member PWA at `/app`.

## Product Purpose
Puntakit is becoming a Ministry Operating System: a Thai-first, data-driven app for People, Groups, Attendance, Events, Announcements, Ministries, Church profile and Reports, plus the Ministry OS layer (Ministry Activity, Feed, Timeline, Mission Inbox, Follow-up, Operations dashboard, Map). Success: ministry work is recorded and followed up from real data, not memory.

## Positioning
Two claims together: (1) a Ministry OS where `MissionActivity` is the core object and Feed, Timeline, Map and Operations are lenses over it; (2) Thai-first, built around the church's own care-group vocabulary and workflow.

## Operating Context
Admin on desktop; leaders on mobile during and after gatherings (attendance, follow-up, reporting); members on the installable PWA. Sign-in is first-party PIN auth with role-based access.

## Capabilities and Constraints
- Terminology: พันธกิจ = care group (`org_level = 'care'`, `/groups`); บอดี้ = level above (`body`); ฝ่ายงาน = ministry team (`/ministries`). Stored labels `รหัสแคร์` and `หนค. (ต้นฉบับ)` stay verbatim.
- Preserve existing business logic, routes, APIs, database schema and authorization.
- No mock data; numbers, names and emails come from the API, otherwise show an empty state.
- No destructive changes; no merge or deployment without explicit approval.
- Planned, not shipped: Notifications, cross-domain Search, Administration/RBAC UI.

## Brand Commitments
Thai-first UI in the Prompt font. Dark theme is the default (since 2026-10-15), light remains available. The existing system in `DESIGN.md` and `client/src/index.css` (Design System V2, shared components in `DesignSystem.tsx`) is binding: extend it, do not introduce a new visual world.

## Evidence on Hand
Product docs: `docs/PUNTAKIT_PRODUCT_ARCHITECTURE.md`, `docs/PUNTAKIT_IMPLEMENTATION_PLAN.md`, `brand-spec.md`, `design.md`, audits under `docs/audits/`. No testimonials, customer logos or external metrics exist; do not fabricate any.

## Product Principles
1. Real data only: an honest empty state beats a plausible number.
2. One core object (`MissionActivity`) viewed through lenses, not parallel silos.
3. Desktop for admins, thumb-reach for leaders; each workflow is designed for its actual device.
4. Thai first: wording follows the church's own vocabulary.
5. Extend the existing design system; never fork it.

## Accessibility & Inclusion
Touch targets at least 44px, visible `:focus-visible` rings, no horizontal scroll at 360–414px, status never conveyed by color alone, `prefers-reduced-motion` respected (per DESIGN.md §8).
