import { createHash } from "node:crypto";
import { prisma } from "../prisma.js";
import { storage } from "../storage/storage.service.js";
import { AppError } from "../utils/http.js";
import { audit } from "./audit.service.js";
export async function uploadProof(input, req) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(input.mimeType))
        throw new AppError("Only JPG, PNG, WEBP, and PDF proofs are supported", 422, "UNSUPPORTED_FILE_TYPE");
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    const duplicate = await prisma.proof.findFirst({ where: { checksum } });
    const stored = await storage.upload({
        buffer: input.buffer,
        mimeType: input.mimeType,
        originalName: input.originalName,
        folder: `proofs/${input.eventId}`,
        visibility: "private",
    });
    const proof = await prisma.proof.create({
        data: {
            userId: input.userId,
            eventId: input.eventId,
            type: input.type,
            storageKey: stored.key,
            url: stored.url,
            originalFileName: input.originalName,
            mimeType: input.mimeType,
            fileSize: input.buffer.length,
            checksum,
            verificationStatus: duplicate ? "DUPLICATE" : "PENDING",
            verificationMetadata: duplicate
                ? { duplicateProofId: duplicate.id, riskSignal: "same_checksum" }
                : undefined,
        },
    });
    await prisma.fileRecord.create({
        data: {
            objectKey: stored.key,
            url: stored.url,
            originalName: input.originalName,
            mimeType: input.mimeType,
            fileSize: input.buffer.length,
            checksum,
            visibility: "PRIVATE",
            uploadedById: input.userId,
        },
    });
    await audit(req, "PROOF_UPLOADED", "Proof", proof.id, undefined, {
        id: proof.id,
        checksum,
        verificationStatus: proof.verificationStatus,
    });
    return proof;
}
export async function listProofs(input) {
    const where = {
        ...(input.status ? { verificationStatus: input.status } : {}),
        ...(input.eventId ? { eventId: input.eventId } : {}),
    };
    const [total, rows] = await prisma.$transaction([
        prisma.proof.count({ where }),
        prisma.proof.findMany({
            where,
            include: {
                user: { select: { fullName: true, email: true, department: true } },
                event: { select: { title: true } },
            },
            orderBy: { uploadedAt: "desc" },
            skip: (input.page - 1) * input.limit,
            take: input.limit,
        }),
    ]);
    return { total, rows };
}
export async function reviewProof(id, actorId, status, metadata, req) {
    const proof = await prisma.proof.findUnique({ where: { id } });
    if (!proof)
        throw new AppError("Proof not found", 404, "PROOF_NOT_FOUND");
    const updated = await prisma.proof.update({
        where: { id },
        data: {
            verificationStatus: status,
            verificationMetadata: metadata,
            reviewedById: actorId,
            reviewedAt: new Date(),
            verificationScore: status === "VERIFIED" ? 100 : status === "FLAGGED" ? 50 : 0,
        },
    });
    await audit(req, `PROOF_${status}`, "Proof", id, proof, updated);
    return updated;
}
export async function getProof(id, requesterId) {
    const proof = await prisma.proof.findUnique({
        where: { id },
        include: {
            event: true,
            user: { select: { id: true, fullName: true, email: true } },
        },
    });
    if (!proof || (requesterId && proof.userId !== requesterId))
        throw new AppError("Proof not found", 404, "PROOF_NOT_FOUND");
    return proof;
}
//# sourceMappingURL=proof.service.js.map