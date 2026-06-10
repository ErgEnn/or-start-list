import type { PaymentGroup, PaymentGroupMember } from '@or/shared';

export function isWithinCompensatedLimit(member: PaymentGroupMember): boolean {
  if (member.compensatedEvents == null) return true;
  return (member.eventsAttended ?? 0) < member.compensatedEvents;
}

export function findActivePaymentGroup(
  paymentGroups: PaymentGroup[],
  competitorId: string,
): PaymentGroup | null {
  for (const group of paymentGroups) {
    const member = group.competitors.find((m) => m.competitorId === competitorId);
    if (member && isWithinCompensatedLimit(member)) {
      return group;
    }
  }
  return null;
}
