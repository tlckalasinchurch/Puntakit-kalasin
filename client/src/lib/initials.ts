/**
 * The single character shown in a name's avatar.
 *
 * `name.slice(0, 1)` was wrong for Thai: names that start with a leading vowel (เ แ โ ใ ไ, as in
 * เอก, แสงเดือน, โชติ, ใจดี, ไพบูลย์) produced the vowel on its own, which is not a letter anyone
 * would read as an initial. The initial is the first consonant, as spoken.
 *
 * Rules:
 *  - leading spaces, punctuation, digits, emoji and Thai vowels/marks are skipped;
 *  - the first Thai consonant (ก–ฮ) or the first letter of any other script is the initial;
 *  - Latin letters are upper-cased;
 *  - a name with no letter at all gives "?" (what the shared avatar already used for an empty name).
 *
 * Titles ("นาย", "นางสาว", "ดร.") are not stripped: that is a naming policy, not a rendering bug.
 */
const THAI_BLOCK = /[\u0E00-\u0E7F]/;
const THAI_CONSONANT = /[\u0E01-\u0E2E]/;
// Built from a string: this tsconfig rejects the `u` flag on a regex literal, the runtime does not.
const LETTER = new RegExp("\\p{L}", "u");

export function initialOf(name: string | null | undefined): string {
  for (const char of name ?? "") {
    if (THAI_BLOCK.test(char) ? !THAI_CONSONANT.test(char) : !LETTER.test(char)) continue;
    return char.toLocaleUpperCase();
  }
  return "?";
}
