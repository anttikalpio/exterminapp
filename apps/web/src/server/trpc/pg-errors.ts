import { TRPCError } from "@trpc/server";

type PgError = {
  code?: string;
  constraint_name?: string;
  column_name?: string;
  column?: string;
  detail?: string;
  message?: string;
};

/**
 * Translate a raw postgres-js driver error into a user-friendly TRPCError.
 * Always throws — never returns.
 */
export function throwFriendlyPgError(err: unknown, entity: string): never {
  // If it's already a TRPCError (e.g. re-thrown), let it bubble up.
  if (err instanceof TRPCError) throw err;

  const e = err as PgError;
  const code = e?.code;

  if (code === "23505") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `A ${entity} with these details already exists`,
      cause: err,
    });
  }
  if (code === "23502") {
    const column = e.column_name || e.column;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: column
        ? `Required field missing: ${column}`
        : "A required field is missing",
      cause: err,
    });
  }
  if (code === "23503") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Referenced record not found",
      cause: err,
    });
  }
  if (code === "22001") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One of the values is too long for its field",
      cause: err,
    });
  }

  // Unknown DB error — log server-side so the terminal shows the real cause,
  // surface a short message to the client.
  console.error(`[pg-error] ${entity} save failed:`, err);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: e?.detail || e?.message || "Database error",
    cause: err,
  });
}
