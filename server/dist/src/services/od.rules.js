export function finalMemberStatus(input) {
  if (input.attendanceStatus === "PRESENT" || (input.hasVerifiedProof && input.organizerConfirmed))
    return "VERIFIED_ATTENDED";
  if (input.hasUploadedProof) return "NEEDS_REVIEW";
  return "NOT_VERIFIED";
}
//# sourceMappingURL=od.rules.js.map
