import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * Import writes are super_admin only on the server (`requireImportWriter`). The UI mirrors
 * that so nobody is shown a control that can only answer 403 - but the API stays the
 * security boundary. Reading import results is unchanged (`PRIVILEGED_ROLES`).
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const WRITE_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ["client/src/pages/ImportData.tsx", "canImport"],
  ["client/src/pages/ImportDuplicates.tsx", "canDecide"],
  ["client/src/pages/ImportMergeApprovals.tsx", "canAct"],
  ["client/src/pages/ImportOrgData.tsx", "isSuperAdmin"],
];
const READ_ROUTES = ["/import", "/import/duplicates", "/import/merge-approvals"];
const READ_PAGES = ["ImportData", "ImportDuplicates", "ImportMergeApprovals"];

describe("import write gates", () => {
  it("the server guard is the super_admin set", () => {
    const guard = read("server/middleware/importAccess.ts");
    expect(guard).toContain("requireRole(...SUPER_ADMIN_ROLES)");
  });

  it.each(WRITE_FLAGS)("%s decides writes with SUPER_ADMIN_ROLES (%s)", (file, flag) => {
    const src = read(file);
    expect(src).toMatch(new RegExp(`const ${flag} = hasRole\\(user\\?\\.role, SUPER_ADMIN_ROLES\\);`));
    expect(src, "ADMIN_ROLES would let admin see controls the API refuses").not.toMatch(/(?<!SUPER_)\bADMIN_ROLES\b/);
  });

  it.each(READ_PAGES)("%s keeps reading on PRIVILEGED_ROLES", (page) => {
    expect(read(`client/src/pages/${page}.tsx`)).toMatch(/const canRead = hasRole\(user\?\.role, PRIVILEGED_ROLES\);/);
  });

  it.each(READ_ROUTES)("route %s stays readable by PRIVILEGED_ROLES", (route) => {
    expect(read("client/src/App.tsx")).toMatch(
      new RegExp(`<Route path="${route}">\\s*<ProtectedRoute allow=\\{PRIVILEGED_ROLES\\}`)
    );
  });

  it("route /import/org is super_admin only (every call behind it is a write)", () => {
    expect(read("client/src/App.tsx")).toMatch(/<Route path="\/import\/org">\s*<ProtectedRoute allow=\{SUPER_ADMIN_ROLES\}/);
  });

  it("the org-data link on /import is shown only to who may write", () => {
    expect(read("client/src/pages/ImportData.tsx")).toMatch(/\.\.\.\(canImport \? \[\{ label: "โหลดข้อมูลผังองค์กร", href: "\/import\/org" \}\] : \[\]\)/);
  });

  it("the sidebar entry to the read page is left on PRIVILEGED_ROLES", () => {
    const sidebar = read("client/src/components/layout/Sidebar.tsx");
    expect(sidebar).toMatch(/path: "\/import",\s*icon: FileSpreadsheet,\s*roles: PRIVILEGED_ROLES/);
  });
});
