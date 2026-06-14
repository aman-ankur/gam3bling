export function normalizeInviteCode(inviteCode: string): string {
  return inviteCode.trim().toUpperCase();
}

export function isValidInviteCode(inviteCode: string): boolean {
  return /^[A-Z0-9]{4,10}$/.test(normalizeInviteCode(inviteCode));
}
