import { CertificateStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { storage } from "../storage/storage.service.js";
import { opaqueToken, sequenceValue } from "../utils/crypto.js";
import { AppError } from "../utils/http.js";
import { notifyUsers } from "./notification.service.js";
import { audit } from "./audit.service.js";
function certificatePdf(name, event, number) {
    const content = `BT /F1 26 Tf 80 700 Td (Certificate of Participation) Tj /F1 18 Tf 0 -70 Td (${name.replace(/[()]/g, "")}) Tj /F1 14 Tf 0 -45 Td (has successfully participated in ${event.replace(/[()]/g, "")}) Tj /F1 10 Tf 0 -60 Td (Certificate Number: ${number}) Tj ET`;
    const objects = [
        `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,
        `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,
        `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
        `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
        `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const object of objects) {
        offsets.push(Buffer.byteLength(pdf));
        pdf += object + "\n";
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => String(offset).padStart(10, "0") + " 00000 n ")
        .join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}
async function nextCertificateNumber(tx, year) {
    const key = `CERT-EVT-${year}`;
    await tx.sequenceCounter.upsert({ where: { key }, update: {}, create: { key, value: 0 } });
    const counter = await tx.sequenceCounter.update({
        where: { key },
        data: { value: { increment: 1 } },
    });
    return sequenceValue("CERT-EVT", year, counter.value);
}
export async function generateCertificates(eventId, actorId, req) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event)
        throw new AppError("Event not found", 404, "EVENT_NOT_FOUND");
    if (!event.certificateEnabled)
        throw new AppError("Certificates are disabled for this event", 409, "CERTIFICATES_DISABLED");
    const eligible = await prisma.attendance.findMany({
        where: { eventId, status: "PRESENT" },
        include: { user: { select: { id: true, fullName: true } }, registration: true },
    });
    const generated = [];
    for (const attendance of eligible) {
        const existing = await prisma.certificate.findFirst({
            where: { eventId, userId: attendance.userId, status: "ISSUED" },
        });
        if (existing) {
            generated.push({ id: existing.id, certificateNumber: existing.certificateNumber });
            continue;
        }
        const certificateNumber = await prisma.$transaction((tx) => nextCertificateNumber(tx, new Date().getUTCFullYear()));
        const pdf = certificatePdf(attendance.user.fullName, event.title, certificateNumber);
        const stored = await storage.upload({
            buffer: pdf,
            mimeType: "application/pdf",
            originalName: `${certificateNumber}.pdf`,
            folder: `certificates/${eventId}`,
            visibility: "private",
        });
        const certificate = await prisma.certificate.create({
            data: {
                certificateNumber,
                eventId,
                userId: attendance.userId,
                registrationId: attendance.registrationId,
                storageKey: stored.key,
                certificateUrl: stored.url,
                verificationToken: opaqueToken(24),
            },
        });
        generated.push({ id: certificate.id, certificateNumber });
    }
    if (generated.length)
        await notifyUsers(eligible.map((row) => row.userId), "CERTIFICATE_AVAILABLE", "Your certificate is available", `Certificates for ${event.title} are ready.`);
    await audit(req, "CERTIFICATES_GENERATED", "Event", eventId, undefined, {
        count: generated.length,
        actorId,
    });
    return generated;
}
export async function listMyCertificates(userId) {
    return prisma.certificate.findMany({
        where: { userId },
        include: { event: { select: { title: true, startAt: true, organizer: true } } },
        orderBy: { issuedAt: "desc" },
    });
}
export async function verifyCertificate(certificateNumber) {
    const certificate = await prisma.certificate.findUnique({
        where: { certificateNumber },
        include: { event: { include: { organizer: true } }, user: { select: { fullName: true } } },
    });
    if (!certificate || certificate.status !== CertificateStatus.ISSUED || certificate.revokedAt)
        return { valid: false };
    return {
        valid: true,
        certificate: {
            certificateNumber: certificate.certificateNumber,
            participant: certificate.user.fullName,
            event: certificate.event.title,
            organizer: certificate.event.organizer?.name,
            eventDate: certificate.event.startAt,
            issuedAt: certificate.issuedAt,
        },
    };
}
export async function revokeCertificate(id, req) {
    const certificate = await prisma.certificate.findUnique({ where: { id } });
    if (!certificate)
        throw new AppError("Certificate not found", 404, "CERTIFICATE_NOT_FOUND");
    const updated = await prisma.certificate.update({
        where: { id },
        data: { status: "REVOKED", revokedAt: new Date() },
    });
    await audit(req, "CERTIFICATE_REVOKED", "Certificate", id, certificate, updated);
    return updated;
}
//# sourceMappingURL=certificate.service.js.map