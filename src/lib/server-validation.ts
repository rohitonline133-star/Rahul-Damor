export type OtpPurpose = 'register' | 'login' | 'authenticate';

export function isSupportedOtpPurpose(value: unknown): value is OtpPurpose {
  return value === 'register' || value === 'login' || value === 'authenticate';
}

export function isValidOtpCode(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{6}$/.test(value.trim());
}

export function canAddGroupMembers(isAdmin: boolean, addMembersPermission: unknown): boolean {
  return isAdmin || addMembersPermission === true;
}

export function isCommunityGroupLinkValid(
  communityId: unknown,
  groupCommunityId: unknown,
  linkedGroupIds: unknown,
  groupId: unknown
): boolean {
  return typeof communityId === 'string' &&
    communityId.length > 0 &&
    groupCommunityId === communityId &&
    Array.isArray(linkedGroupIds) &&
    linkedGroupIds.includes(groupId);
}

export function isValidShippingAddress(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const address = value as Record<string, unknown>;
  return ['fullName', 'address', 'city', 'postalCode', 'country'].every((key) =>
    typeof address[key] === 'string' &&
    (address[key] as string).trim().length > 0 &&
    (address[key] as string).length <= 200
  );
}
