import { createHash, randomBytes } from "node:crypto";
export function opaqueToken(bytes = 32) {
    return randomBytes(bytes).toString("base64url");
}
export function hashToken(value) {
    return createHash("sha256").update(value).digest("hex");
}
export function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}
export function sequenceValue(prefix, year, number) {
    return `${prefix}-${year}-${String(number).padStart(6, "0")}`;
}
//# sourceMappingURL=crypto.js.map