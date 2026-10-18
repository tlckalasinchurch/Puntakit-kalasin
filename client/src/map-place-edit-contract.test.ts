import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * On /map a person who may edit a group can set its coordinates, place photo and landmark /
 * meeting details in one dialog, and the coordinates and the text are saved by ONE
 * `PUT /api/groups/:id`. (The photo is a binary upload to /api/media and is stored as soon as it
 * is chosen; it cannot travel in a JSON PUT.) Vitest has no DOM here, so this reads the source.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const page = read("client/src/pages/Map.tsx");
const picker = read("client/src/components/map/LocationPicker.tsx");
const fields = read("client/src/components/map/PlaceFields.tsx");

describe("one PUT saves coordinates and place details together", () => {
  it("the map page saves latitude, longitude and the trimmed place fields in a single request", () => {
    const save = page.slice(page.indexOf("const savePlace"), page.indexOf("return (", page.indexOf("const savePlace")));
    expect(save.match(/api\.put\(/g)).toHaveLength(1);
    expect(save).toMatch(/const patch = placePatchOf\(draft\)/);
    expect(save).toMatch(/api\.put\(`\/api\/groups\/\$\{group\.id\}`, \{ latitude, longitude, \.\.\.patch \}\)/);
  });

  it("a failed save keeps the dialog open and says why", () => {
    const save = page.slice(page.indexOf("const savePlace"), page.indexOf("return (", page.indexOf("const savePlace")));
    expect(save).toMatch(/toast\.error\(/);
    expect(save).toMatch(/throw err/);
  });

  it("the saved values are mirrored into the list so the card is current without a reload", () => {
    expect(page).toMatch(/\.\.\.g, latitude, longitude, \.\.\.patch/);
  });
});

describe("the picker dialog carries the place fields", () => {
  it("LocationPicker renders optional children (the place fields) inside the dialog", () => {
    expect(picker).toMatch(/children\?: ReactNode/);
    expect(picker).toMatch(/\{children\}/);
  });

  it("the map page passes PlaceFields only for the group being edited", () => {
    expect(page).toMatch(/<PlaceFields/);
    expect(page).toMatch(/pickerGroup && \(\s*<PlaceFields/);
  });

  it("PlaceFields has the landmark text, day, time and place inputs with the server's length limits, and the photo field", () => {
    expect(fields).toMatch(/maxLength=\{3000\}/);
    expect(fields).toMatch(/maxLength=\{100\}/);
    expect(fields).toMatch(/maxLength=\{300\}/);
    expect(fields).toContain("GroupPhotoField");
    expect(fields).toMatch(/canEdit/);
  });

  it("the card button says it edits the photo and details too", () => {
    expect(page).toMatch(/แก้ไขพิกัด รูป และรายละเอียด/);
    expect(page).toMatch(/ปักพิกัดและเพิ่มรูป/);
  });
});

describe("only people who may edit see the edit controls (unchanged rules)", () => {
  it("the card's edit button and the photo controls are both gated by canEdit", () => {
    expect(page).toMatch(/\{canEdit && \(\s*<Button type="button" variant="outline" className="w-full" onClick=\{onPin\}>/);
    expect(page).toMatch(/<GroupPhotoField groupId=\{group\.id\} groupName=\{group\.name\} url=\{group\.coverUrl\} canEdit=\{canEdit\}/);
  });

  it("a group with no photo shows no frame to someone who cannot edit (no placeholder image)", () => {
    const photo = read("client/src/components/groups/GroupPhotoField.tsx");
    expect(photo).toMatch(/if \(!hasPhoto && !canEdit\) return null;/);
  });
});

describe("theme", () => {
  it("the picker pin uses the Teal primary, not the retired orange", () => {
    expect(picker).toMatch(/const PIN_COLOR = "#0c7c82"/);
    expect(picker).not.toMatch(/#e8560a|#ff6115/i);
  });

  it("PlaceFields uses design tokens, not raw colours", () => {
    expect(fields).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(fields).toMatch(/var\(--color-/);
  });
});
