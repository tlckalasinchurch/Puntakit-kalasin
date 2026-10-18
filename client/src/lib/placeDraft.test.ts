import { describe, expect, it } from "vitest";
import { EMPTY_PLACE_DRAFT, placeDraftOf, placePatchOf } from "./placeDraft";

describe("placeDraftOf", () => {
  it("copies the editable place fields, turning missing values into empty strings", () => {
    expect(
      placeDraftOf({ description: "ตรงข้ามร้านค้า", meetingDay: "พุธ", meetingTime: null, meetingLocation: undefined })
    ).toEqual({ description: "ตรงข้ามร้านค้า", meetingDay: "พุธ", meetingTime: "", meetingLocation: "" });
  });

  it("an empty draft is all empty strings", () => {
    expect(EMPTY_PLACE_DRAFT).toEqual({ description: "", meetingDay: "", meetingTime: "", meetingLocation: "" });
  });
});

describe("placePatchOf", () => {
  it("trims every field so stray spaces are never stored", () => {
    expect(
      placePatchOf({ description: "  ซอยข้างวัด \n", meetingDay: " พุธ ", meetingTime: " 19:00 ", meetingLocation: " บ้านคุณสมชาย " })
    ).toEqual({ description: "ซอยข้างวัด", meetingDay: "พุธ", meetingTime: "19:00", meetingLocation: "บ้านคุณสมชาย" });
  });

  it("keeps empty strings (not null) so a cleared field is cleared on the server", () => {
    expect(placePatchOf({ description: "   ", meetingDay: "", meetingTime: "", meetingLocation: "" })).toEqual({
      description: "",
      meetingDay: "",
      meetingTime: "",
      meetingLocation: "",
    });
  });

  it("keeps multi-line descriptions intact inside the trimmed text", () => {
    expect(placePatchOf({ ...EMPTY_PLACE_DRAFT, description: "บรรทัด 1\nบรรทัด 2" }).description).toBe("บรรทัด 1\nบรรทัด 2");
  });
});
