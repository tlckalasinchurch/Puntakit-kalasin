/**
 * Recognises PostgreSQL unique-violation errors (SQLSTATE 23505) for a KNOWN
 * constraint, so a route can turn a race it understands into a 409 instead of
 * a 500. It deliberately does not match anything else: an unknown constraint,
 * or any other database error, must stay a 500.
 *
 * The error shape differs by driver: drizzle wraps pglite/postgres-js errors
 * (original under `cause`), Neon HTTP throws the original error directly. Both
 * carry `code` and `constraint`.
 */

const UNIQUE_VIOLATION = "23505";
const MAX_CAUSE_DEPTH = 4;

type PgLikeError = { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };

export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current && typeof current === "object"; depth += 1) {
    const candidate = current as PgLikeError;
    if (candidate.code === UNIQUE_VIOLATION) {
      if (candidate.constraint === constraintName) return true;
      // Some drivers omit `constraint`; the message names it:
      // `duplicate key value violates unique constraint "<name>"`.
      if (typeof candidate.message === "string" && candidate.message.includes(`"${constraintName}"`)) return true;
    }
    current = candidate.cause;
  }
  return false;
}

/** Constraint names the import routes know how to turn into a 409. */
export const KNOWN_UNIQUE_CONSTRAINTS = {
  importFileChecksum: "import_batches_file_checksum_unique",
} as const;
