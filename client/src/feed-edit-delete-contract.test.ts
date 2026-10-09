import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Feed edit/delete must ride on the endpoints and role sets that already exist:
 * `PUT /api/activities/:id` (guarded by `canManage`) and
 * `DELETE /api/activities/:id` (guarded by `requireRole(...DELETE_ROLES)`).
 *
 * These are static assertions on purpose. They lock the client to the server's
 * gate so a later edit cannot quietly widen who may edit or remove someone
 * else's record — the concrete failure this prevents is a page that grows an
 * inline role check (`user.role === "admin"`) while the server allows
 * `super_admin` and `ministry_leader` too.
 *
 * The server remains the authority on ownership: `server/routes/activities.test.ts`
 * proves the authorization outcomes end to end against a real database.
 */

const CLIENT_SRC = path.resolve(import.meta.dirname);
const REPO_ROOT = path.resolve(CLIENT_SRC, "..", "..");

const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), "utf8");

const feed = read("client/src/pages/Feed.tsx");
const confirmDialog = read("client/src/components/ConfirmDialog.tsx");
const roles = read("shared/roles.ts");
const activitiesRoute = read("server/routes/activities.ts");

/** A role list written out inline instead of taken from `shared/roles.ts`. */
const INLINE_ROLE_LITERAL = /\.role\s*===\s*"(super_admin|admin|staff|ministry_leader|group_leader)"/;

describe("Feed edit/delete contract (client ↔ server single source)", () => {
  it("takes both gates from shared/roles.ts, with no inline role list", () => {
    expect(feed, "Feed must import the shared role sets").toContain(
      'import { CREATE_ROLES, DELETE_ROLES, PRIVILEGED_ROLES } from "@shared/roles"'
    );
    expect(feed).not.toMatch(INLINE_ROLE_LITERAL);
  });

  it("mirrors the server's delete gate exactly", () => {
    // Delete is role-gated only — the route has no ownership branch, so the
    // client must not imply one either.
    expect(roles).toMatch(/export const DELETE_ROLES[\s\S]*?\["super_admin", "admin", "ministry_leader"\]/);
    expect(activitiesRoute).toMatch(/requireRole\(\.\.\.DELETE_ROLES\)/);
    expect(feed).toMatch(/user !== null && DELETE_ROLES\.includes\(user\.role\)/);
  });

  it("only offers the edit affordance where the server's canManage is knowable", () => {
    // PRIVILEGED_ROLES ∪ creator. The group-leader branch needs led-group data
    // this page does not load, so it gets no button — and a 403 if it tries.
    expect(feed).toMatch(/PRIVILEGED_ROLES\.includes\(user\.role\)/);
    expect(feed).toMatch(/user\.id === activity\.createdById/);
  });

  it("asks for confirmation on the shared ConfirmDialog before deleting", () => {
    expect(feed).toMatch(/<ConfirmDialog/);
    expect(confirmDialog, "ConfirmDialog must keep riding on the shared Modal").toContain("Modal");
  });

  it("cannot be double-submitted", () => {
    expect(feed).toMatch(/disabled=\{editBusyId === activity\.id\}/);
    expect(feed).toMatch(/disabled=\{deleteBusyId === activity\.id\}/);
    expect(feed).toMatch(/isSubmitting=\{deleting\}/);
    expect(feed).toMatch(/if \(!deleteTarget \|\| deleting\) return;/);
    expect(feed).toMatch(/if \(editBusyId \|\| submitting\) return;/);
  });

  it("calls the existing endpoints and invents none", () => {
    expect(feed).toMatch(/api\.put\(`\/api\/activities\/\$\{editingId\}`/);
    expect(feed).toMatch(/api\.delete\(`\/api\/activities\/\$\{deleteTarget\.id\}`\)/);
    expect(feed).not.toMatch(/api\.patch\(/);
    expect(feed).not.toMatch(/api\.post\(`\/api\/activities\/\$\{/);
  });

  it("loads participants and media before an edit so a save cannot drop them", () => {
    expect(feed).toMatch(/api\.get<ActivityDetail>\(`\/api\/activities\/\$\{activity\.id\}`\)/);
    expect(feed).toMatch(/detail\.participants\.map\(/);
    expect(feed).toMatch(/detail\.media\.map\(/);
    // A late answer from a card the user already left must not overwrite the form.
    expect(feed).toMatch(/editRequestRef\.current !== requestId/);
  });

  it("surfaces API failures instead of swallowing them", () => {
    expect(feed).toMatch(/setFormError\(withRecheckHint\(message, err\)\)/);
    expect(feed).toMatch(/setDeleteError\(message\)/);
    expect(feed).toMatch(/toast\.error\(message\)/);
    expect(confirmDialog).toMatch(/role="alert"/);
  });

  it("never saves an edit whose participants and media were not loaded", () => {
    // `PUT /:id` treats an omitted list as `[]` (D53), so a save without the
    // detail would clear the recorded people and photos. The dialog therefore
    // refuses to submit until the detail has loaded, and offers a retry.
    expect(feed).toMatch(/disabled=\{submitting \|\| detailLoading \|\| detailError !== null\}/);
    expect(feed).toMatch(/editingActivity && \(/);
    expect(feed).toMatch(/onClick=\{\(\) => void openEdit\(editingActivity\)\}/);
  });

  it("does not claim an edit changes the publish status", () => {
    expect(feed).toMatch(/สถานะเผยแพร่ไม่เปลี่ยนแปลงจากการแก้ไขนี้/);
  });
});
