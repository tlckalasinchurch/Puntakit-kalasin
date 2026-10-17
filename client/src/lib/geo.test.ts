import { describe, expect, it } from "vitest";
import { bodyColor, BODY_COLORS, formatCoordinate, googleMapsDirectionsUrl, NO_BODY_COLOR, parseCoordinates, toLatLng } from "./geo";

describe("parseCoordinates", () => {
  it.each([
    ["16.4322, 103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["16.4322,103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["16.4322 103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["(16.4322, 103.5061)", { lat: 16.4322, lng: 103.5061 }],
    ["-33.8688, 151.2093", { lat: -33.8688, lng: 151.2093 }],
    ["https://www.google.com/maps/@16.4322,103.5061,17z", { lat: 16.4322, lng: 103.5061 }],
    ["https://www.google.com/maps?q=16.4322,103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["https://maps.google.com/?q=16.4322%2C103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["https://www.google.com/maps?ll=16.43,103.5", { lat: 16.43, lng: 103.5 }],
    ["https://www.google.com/maps/search/?api=1&query=16.4322,103.5061", { lat: 16.4322, lng: 103.5061 }],
    ["https://www.google.com/maps/dir/?api=1&destination=16.4322,103.5061", { lat: 16.4322, lng: 103.5061 }],
  ])("reads %s", (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it("prefers the exact place marker (!3d!4d) over the viewport centre (@)", () => {
    const url = "https://www.google.com/maps/place/Foo/@16.5,103.6,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d16.4322!4d103.5061";
    expect(parseCoordinates(url)).toEqual({ lat: 16.4322, lng: 103.5061 });
  });

  it.each(["", "   ", "hello", "16.4322", "91, 103", "16, 181", "https://maps.app.goo.gl/abcdEFG", "1,2,3", "NaN, NaN"])(
    "rejects %j",
    (input) => {
      expect(parseCoordinates(input)).toBeNull();
    }
  );

  it("does not throw on a stray percent sign", () => {
    expect(parseCoordinates("100% 16.4322, 103.5061")).toBeNull();
    expect(parseCoordinates("16.4322, 103.5061%")).toBeNull();
  });
});

describe("coordinate helpers", () => {
  it("formats to six decimals", () => {
    expect(formatCoordinate(16.4322)).toBe("16.432200");
    expect(formatCoordinate(103.50611234)).toBe("103.506112");
  });

  it("reads stored text columns, and refuses missing or invalid values", () => {
    expect(toLatLng("16.4322", "103.5061")).toEqual({ lat: 16.4322, lng: 103.5061 });
    expect(toLatLng(null, "103.5061")).toBeNull();
    expect(toLatLng("16.4322", "")).toBeNull();
    expect(toLatLng("abc", "103")).toBeNull();
    expect(toLatLng("95", "103")).toBeNull();
  });

  it("builds the Google Maps directions link", () => {
    expect(googleMapsDirectionsUrl({ lat: 16.4322, lng: 103.5061 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=16.432200,103.506100"
    );
  });

  it("assigns each body a stable colour and a neutral one when there is no body", () => {
    expect(bodyColor(0)).toBe(BODY_COLORS[0]);
    expect(bodyColor(BODY_COLORS.length)).toBe(BODY_COLORS[0]);
    expect(bodyColor(-1)).toBe(NO_BODY_COLOR);
    expect(new Set(BODY_COLORS).size).toBe(BODY_COLORS.length);
  });
});
