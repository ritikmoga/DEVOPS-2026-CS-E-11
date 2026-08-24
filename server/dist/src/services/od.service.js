import { prisma } from "../prisma.js";
import { AppError } from "../utils/http.js";
import { sequenceValue } from "../utils/crypto.js";
import { audit } from "./audit.service.js";
import { finalMemberStatus } from "./od.rules.js";
async function nextODNumber(tx, year) {
    const key = `OD-${year}`;
    await tx.sequenceCounter.upsert({ where: { key }, update: {}, create: { key, value: 0 } });
    const counter = await tx.sequenceCounter.update({
        where: { key },
        data: { value: { increment: 1 } },
    });
    return sequenceValue("OD", year, counter.value);
}
export async function createApplication(input) {
    const event = await prisma.event.findUnique({ where: { id: input.eventId } });
    if (!event || !event.odEnabled)
        throw new AppError("OD is not enabled for this event", 409, "OD_NOT_ENABLED");
    const existing = await prisma.oDApplication.findFirst({
        where: {
            studentId: input.studentId,
            eventId: input.eventId,
            status: { notIn: ["CANCELLED", "REJECTED"] },
        },
    });
    if (existing)
        throw new AppError("You already have an OD application for this event", 409, "DUPLICATE_OD_APPLICATION");
    const ids = [...new Set([input.studentId, ...(input.memberIds ?? [])])];
    const users = await prisma.user.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true },
    });
    if (users.length !== ids.length)
        throw new AppError("One or more OD participants are invalid", 422, "INVALID_OD_MEMBER");
    return prisma.$transaction(async (tx) => {
        const application = await tx.oDApplication.create({
            data: {
                studentId: input.studentId,
                eventId: input.eventId,
                reason: input.reason,
                startDate: input.startDate,
                endDate: input.endDate,
                applicationNumber: await nextODNumber(tx, new Date().getUTCFullYear()),
                members: { create: ids.map((userId) => ({ userId })) },
            },
            include: { members: true },
        });
        return application;
    });
}
export async function getApplication(id, requesterId) {
    const application = await prisma.oDApplication.findUnique({
        where: { id },
        include: {
            event: true,
            student: {
                select: { id: true, fullName: true, email: true, department: true, enrollmentNumber: true },
            },
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            department: true,
                            enrollmentNumber: true,
                        },
                    },
                },
            },
            approvals: {
                include: { approver: { select: { fullName: true, email: true } } },
                orderBy: { createdAt: "asc" },
            },
            completion: true,
            proofs: true,
        },
    });
    if (!application ||
        (requesterId &&
            application.studentId !== requesterId &&
            !application.members.some((member) => member.userId === requesterId)))
        throw new AppError("OD application not found", 404, "OD_NOT_FOUND");
    return application;
}
export async function listMyApplications(userId, page, limit) {
    const where = { OR: [{ studentId: userId }, { members: { some: { userId } } }] };
    const [total, rows] = await prisma.$transaction([
        prisma.oDApplication.count({ where }),
        prisma.oDApplication.findMany({
            where,
            include: { event: { select: { title: true, slug: true, startAt: true } }, members: true },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);
    return { total, rows };
}
export async function submitApplication(id, requesterId, req) {
    const application = await getApplication(id, requesterId);
    if (application.studentId !== requesterId)
        throw new AppError("Only the applicant can submit this OD request", 403, "FORBIDDEN");
    if (!["DRAFT", "REJECTED"].includes(application.status))
        throw new AppError("This OD application cannot be submitted in its current state", 409, "INVALID_OD_STATE");
    const updated = await prisma.oDApplication.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date(), currentApprovalLevel: "FACULTY" },
    });
    await audit(req, "OD_SUBMITTED", "ODApplication", id, application, updated);
    return updated;
}
export async function decideApplication(id, actorId, level, decision, comments) {
    const application = await prisma.oDApplication.findUnique({
        where: { id },
        include: { approvals: true },
    });
    if (!application)
        throw new AppError("OD application not found", 404, "OD_NOT_FOUND");
    const allowed = {
        FACULTY: ["SUBMITTED", "UNDER_REVIEW"],
        HOD: ["FACULTY_APPROVED"],
        FINAL: ["COMPLETION_SUBMITTED", "FLAGGED"],
    };
    if (!allowed[level].includes(application.status))
        throw new AppError(`This application is not ready for ${level.toLowerCase()} review`, 409, "INVALID_OD_APPROVAL_STAGE");
    const nextStatus = decision === "REJECTED"
        ? "REJECTED"
        : decision === "REQUESTED_CHANGES"
            ? "DRAFT"
            : level === "FACULTY"
                ? "FACULTY_APPROVED"
                : level === "HOD"
                    ? "HOD_APPROVED"
                    : "VERIFIED";
    const updated = await prisma.$transaction(async (tx) => {
        const approval = await tx.oDApproval.create({
            data: { odApplicationId: id, approverId: actorId, level, decision, comments },
        });
        const next = await tx.oDApplication.update({
            where: { id },
            data: {
                status: nextStatus,
                currentApprovalLevel: decision === "APPROVED" && level === "FACULTY"
                    ? "HOD"
                    : decision === "APPROVED" && level === "HOD"
                        ? null
                        : level,
            },
        });
        if (level === "HOD" && decision === "APPROVED")
            await tx.oDApplication.update({ where: { id }, data: { status: "COMPLETION_PENDING" } });
        return { application: next, approval };
    });
    return updated;
}
export async function submitCompletion(input, req) {
    const application = await getApplication(input.odApplicationId, input.submittedById);
    if (!["COMPLETION_PENDING", "EVENT_COMPLETED", "FLAGGED"].includes(application.status))
        throw new AppError("Completion cannot be submitted at this stage", 409, "INVALID_COMPLETION_STATE");
    const result = await prisma.$transaction(async (tx) => {
        const completion = await tx.completionSubmission.upsert({
            where: { odApplicationId: input.odApplicationId },
            update: {
                participationConfirmed: input.participationConfirmed,
                organizerConfirmation: input.organizerConfirmation ?? false,
                eventResult: input.eventResult,
                remarks: input.remarks,
                submittedById: input.submittedById,
                submittedAt: new Date(),
            },
            create: {
                odApplicationId: input.odApplicationId,
                participationConfirmed: input.participationConfirmed,
                organizerConfirmation: input.organizerConfirmation ?? false,
                eventResult: input.eventResult,
                remarks: input.remarks,
                submittedById: input.submittedById,
                submittedAt: new Date(),
            },
        });
        const members = await tx.oDApplicationMember.findMany({
            where: { odApplicationId: input.odApplicationId },
        });
        const registrations = await tx.registration.findMany({
            where: {
                eventId: application.eventId,
                userId: { in: members.map((member) => member.userId) },
            },
            include: { attendance: true },
        });
        const proofs = await tx.proof.findMany({ where: { odApplicationId: input.odApplicationId } });
        let verified = 0;
        for (const member of members) {
            const attendance = registrations.find((registration) => registration.userId === member.userId)?.attendance;
            const memberProof = proofs.some((proof) => proof.userId === member.userId && proof.verificationStatus === "VERIFIED");
            const uploadedProof = proofs.some((proof) => proof.userId === member.userId);
            const finalStatus = finalMemberStatus({
                attendanceStatus: attendance?.status,
                hasVerifiedProof: memberProof,
                hasUploadedProof: uploadedProof,
                organizerConfirmed: Boolean(input.organizerConfirmation),
            });
            if (finalStatus === "VERIFIED_ATTENDED")
                verified++;
            await tx.oDApplicationMember.update({
                where: { id: member.id },
                data: {
                    finalStatus,
                    participationStatus: finalStatus,
                    attendanceVerified: attendance?.status === "PRESENT",
                    proofVerified: memberProof,
                },
            });
        }
        const applicationStatus = verified === members.length ? "VERIFIED" : "FLAGGED";
        const updated = await tx.oDApplication.update({
            where: { id: input.odApplicationId },
            data: { status: applicationStatus, currentApprovalLevel: "FINAL" },
        });
        return {
            completion,
            application: updated,
            verifiedCount: verified,
            memberCount: members.length,
        };
    });
    await audit(req, "OD_COMPLETION_SUBMITTED", "ODApplication", input.odApplicationId, application, result.application);
    return result;
}
export async function listAllApplications(input) {
    const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.eventId ? { eventId: input.eventId } : {}),
        ...(input.search
            ? {
                OR: [
                    { applicationNumber: { contains: input.search, mode: "insensitive" } },
                    { student: { fullName: { contains: input.search, mode: "insensitive" } } },
                ],
            }
            : {}),
    };
    const [total, rows] = await prisma.$transaction([
        prisma.oDApplication.count({ where }),
        prisma.oDApplication.findMany({
            where,
            include: {
                event: { select: { title: true, startAt: true } },
                student: { select: { fullName: true, email: true, department: true } },
                members: { include: { user: { select: { fullName: true, department: true } } } },
            },
            orderBy: { createdAt: "desc" },
            skip: (input.page - 1) * input.limit,
            take: input.limit,
        }),
    ]);
    return { total, rows };
}
//# sourceMappingURL=od.service.js.map