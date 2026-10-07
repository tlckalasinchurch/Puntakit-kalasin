import { thTH } from "@clerk/localizations";

/**
 * Thai localization with the gaps in Clerk's own `thTH` filled in.
 *
 * Verified against `@clerk/localizations`: upstream `thTH` leaves
 * `formFieldInputPlaceholder__username` and
 * `formFieldInputPlaceholder__signUpPassword` undefined, so Clerk falls back
 * to English and /login + /signup showed "Enter your username" and
 * "Create a password" as the only English strings on an otherwise Thai page.
 * Wording follows the style of neighbouring keys ("ใส่รหัสผ่านของคุณ",
 * "ใส่อีเมลหรือชื่อผู้ใช้").
 */
export const clerkThTH = {
  ...thTH,
  formFieldInputPlaceholder__username: "ใส่ชื่อผู้ใช้ของคุณ",
  formFieldInputPlaceholder__signUpPassword: "สร้างรหัสผ่าน",
};
