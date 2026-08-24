import { TeamMemberRole } from "@prisma/client";
import { prisma } from "../prisma.js";
import { opaqueToken } from "../utils/crypto.js";
import { AppError } from "../utils/http.js";
export async function createTeam(eventId, leaderId, name) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.registrationType !== "TEAM")
        throw new AppError("This is not a team event", 409, "NOT_TEAM_EVENT");
    const existing = await prisma.teamMember.findFirst({
        where: { userId: leaderId, team: { eventId, status: { not: "CANCELLED" } } },
    });
    if (existing)
        throw new AppError("You already belong to a team for this event", 409, "ALREADY_IN_TEAM");
    return prisma.team.create({
        data: {
            eventId,
            leaderId,
            name,
            inviteCode: opaqueToken(8),
            members: { create: { userId: leaderId, role: TeamMemberRole.LEADER } },
        },
        include: { members: true },
    });
}
export async function joinTeam(inviteCode, userId) {
    return prisma.$transaction(async (tx) => {
        const team = await tx.team.findUnique({
            where: { inviteCode },
            include: { event: true, members: true },
        });
        if (!team || team.status === "CANCELLED")
            throw new AppError("Team invite is invalid", 404, "TEAM_NOT_FOUND");
        if (team.event.maxTeamSize && team.members.length >= team.event.maxTeamSize)
            throw new AppError("Team is full", 409, "TEAM_FULL");
        const already = await tx.teamMember.findFirst({
            where: { userId, team: { eventId: team.eventId, status: { not: "CANCELLED" } } },
        });
        if (already)
            throw new AppError("You already belong to a team for this event", 409, "ALREADY_IN_TEAM");
        await tx.teamMember.create({ data: { teamId: team.id, userId } });
        const updated = await tx.team.findUniqueOrThrow({
            where: { id: team.id },
            include: { members: true },
        });
        if (team.event.minTeamSize && updated.members.length >= team.event.minTeamSize)
            await tx.team.update({ where: { id: team.id }, data: { status: "CONFIRMED" } });
        return updated;
    });
}
export async function leaveTeam(teamId, userId) {
    const member = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        include: { team: true },
    });
    if (!member)
        throw new AppError("Team membership not found", 404, "TEAM_MEMBERSHIP_NOT_FOUND");
    if (member.role === "LEADER")
        throw new AppError("The team leader cannot leave; transfer leadership or cancel the team", 409, "LEADER_CANNOT_LEAVE");
    await prisma.teamMember.delete({ where: { id: member.id } });
}
export async function getTeam(id) {
    const team = await prisma.team.findUnique({
        where: { id },
        include: {
            event: { select: { title: true, minTeamSize: true, maxTeamSize: true } },
            members: {
                include: { user: { select: { id: true, fullName: true, email: true, department: true } } },
            },
        },
    });
    if (!team)
        throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
    return team;
}
//# sourceMappingURL=team.service.js.map