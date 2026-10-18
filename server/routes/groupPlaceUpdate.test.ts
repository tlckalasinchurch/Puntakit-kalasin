import { describe, expect, it } from "vitest";
import { groupInputSchema } from "../../shared/validation.js";

/**
 * `PUT /api/groups/:id` parses `groupInputSchema.partial()` (server/routes/groups.ts). The map's
 * location dialog sends the coordinates and the place text in that one request, so the schema must
 * accept exactly that body, and must let each text field be cleared with an empty string.
 */
const update = groupInputSchema.partial();

describe("the map dialog's single PUT body", () => {
  it("accepts coordinates together with landmark, day, time and place", () => {
    const parsed = update.safeParse({
      latitude: "16.432200",
      longitude: "103.506100",
      description: "ตรงข้ามร้านค้า ซอยข้างวัด\nบ้านรั้วสีขาว",
      meetingDay: "ทุกวันพุธ",
      meetingTime: "19:00",
      meetingLocation: "บ้านตัวอย่าง",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts empty strings so a cleared field is cleared on the server", () => {
    const parsed = update.safeParse({ latitude: "16.4", longitude: "103.5", description: "", meetingDay: "", meetingTime: "", meetingLocation: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.description).toBe("");
  });

  it("enforces the limits the dialog's inputs also set (3000 / 100 / 300)", () => {
    expect(update.safeParse({ description: "ก".repeat(3001) }).success).toBe(false);
    expect(update.safeParse({ meetingDay: "ก".repeat(101) }).success).toBe(false);
    expect(update.safeParse({ meetingTime: "1".repeat(101) }).success).toBe(false);
    expect(update.safeParse({ meetingLocation: "ก".repeat(301) }).success).toBe(false);
    expect(update.safeParse({ description: "ก".repeat(3000), meetingDay: "ก".repeat(100), meetingLocation: "ก".repeat(300) }).success).toBe(true);
  });

  it("still rejects coordinates outside the valid range", () => {
    expect(update.safeParse({ latitude: "91", longitude: "103" }).success).toBe(false);
    expect(update.safeParse({ latitude: "16", longitude: "181" }).success).toBe(false);
    expect(update.safeParse({ latitude: "abc", longitude: "103" }).success).toBe(false);
  });
});
