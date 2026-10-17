import { PrismaClient } from "@prisma/client";

/**
 * Prisma's MongoDB connector compiles a `field: null` filter into
 *
 *   { $expr: { $and: [ { $eq: ["$field", null] }, { $ne: ["$field", "$$REMOVE"] } ] } }
 *
 * The `$$REMOVE` guard makes the filter skip documents where the field is
 * absent, and Prisma omits unset nullable fields on insert. A document created
 * without an explicit null can therefore never satisfy `where: { field: null }`.
 * On PostgreSQL the same filter compiles to a plain `IS NULL`, which does match.
 *
 * Those filters are load bearing here: soft deletes (`deletedAt`), session and
 * token revocation (`revokedAt`, `usedAt`) and unread notifications
 * (`readAt`, `deliveredAt`). With the field missing, every one of those lookups
 * silently returns nothing instead of erroring.
 *
 * Writing the null explicitly on create keeps the existing queries working
 * unchanged, so this is applied centrally here rather than at every call site.
 *
 * Keys are Prisma model names, which the query extension reports in
 * PascalCase. Only top-level writes are intercepted: Prisma does not route
 * nested relation creates through the extension, so `NotificationRecipient`
 * rows created via `notification.create({ recipients: { create: [...] } })`
 * set their `readAt`/`deliveredAt` nulls at that call site instead.
 */
const NULLABLE_DEFAULTS = {
  User: { deletedAt: null },
  Event: { deletedAt: null },
  Session: { revokedAt: null },
  AuthToken: { usedAt: null },
};

function withNullDefaults(model, data) {
  const defaults = NULLABLE_DEFAULTS[model];
  if (!defaults || !data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const merged = { ...defaults };
  // An explicit `undefined` means "not provided" in Prisma, so it must not
  // override the default we are adding.
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

export function createPrismaClient(options = {}) {
  return new PrismaClient(options).$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          if (args?.data) {
            args.data = withNullDefaults(model, args.data);
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (Array.isArray(args?.data)) {
            args.data = args.data.map((entry) => withNullDefaults(model, entry));
          }
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (args?.create) {
            args.create = withNullDefaults(model, args.create);
          }
          return query(args);
        },
      },
    },
  });
}

/**
 * MongoDB runs transactions under snapshot isolation and aborts the whole
 * transaction when two of them write the same document concurrently, which
 * Prisma reports as `P2034` ("Transaction failed due to a write conflict or a
 * deadlock"). PostgreSQL instead blocked the second writer until the first
 * committed, so a burst of registrations for a capacity-limited event used to
 * serialise rather than fail.
 *
 * The contended documents are the shared `Event.confirmedCount` counter and the
 * shared `SequenceCounter` key, so any realistic burst of concurrent requests
 * collides. `P2034` carries MongoDB's `TransientTransactionError` label, which
 * means the correct response is to retry the whole transaction rather than
 * catch it. Every callback passed below re-reads its state at the start of an
 * attempt, so re-running it is safe.
 */
const MAX_TRANSACTION_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 25;

function isWriteConflict(error) {
  return error?.code === "P2034";
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function withTransaction(prisma, callback, options = {}) {
  const maxAttempts = options.maxAttempts ?? MAX_TRANSACTION_ATTEMPTS;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(callback);
    } catch (error) {
      if (!isWriteConflict(error) || attempt >= maxAttempts) {
        throw error;
      }
      // Exponential backoff with jitter so retries do not re-collide in lockstep.
      const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(backoff + Math.random() * RETRY_BASE_DELAY_MS);
    }
  }
}
