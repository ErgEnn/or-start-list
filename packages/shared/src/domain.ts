import { z } from "zod";

export const competitorSchema = z.object({
  competitorId: z.string().min(1),
  eolNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(["male", "female"]).nullable().optional(),
  dob: z.string().optional(),
  club: z.string().optional(),
  siCard: z.string().optional(),
});

export const classSchema = z.object({
  classId: z.string().min(1),
  eventId: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
});

export const courseSchema = z.object({
  courseId: z.string().min(1),
  eventId: z.string().min(1),
  classId: z.string().min(1),
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
});

export const eventSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string().nullable(),
});

export const quickFilterSchema = z.object({
  filterId: z.string().min(1),
  eventId: z.string().min(1),
  name: z.string().min(1),
  queryDefinition: z.string().min(1),
});

export const pricingRuleSchema = z.object({
  pricingRuleId: z.string().min(1),
  eventId: z.string().min(1),
  ruleName: z.string().min(1),
  payload: z.record(z.any()),
});

export const paymentGroupMemberSchema = z.object({
  competitorId: z.string().min(1),
  priceOverrideCents: z.number().int().nonnegative().nullable(),
});

export const competitionGroupSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(["male", "female"]).nullable(),
  minYear: z.number().int().nullable(),
  maxYear: z.number().int().nullable(),
  priceCents: z.number().int().nonnegative(),
});

export const paymentGroupSchema = z.object({
  paymentGroupId: z.string().min(1),
  name: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  globalPriceOverrideCents: z.number().int().nonnegative().nullable(),
  competitorIds: z.array(z.string().min(1)),
  competitors: z.array(paymentGroupMemberSchema),
});

export const registrationSchema = z.object({
  registrationId: z.string().uuid(),
  deviceId: z.string().min(1),
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
  courseId: z.string().min(1),
  competitionGroupName: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  createdAtDevice: z.string().datetime(),
  localSeq: z.number().int().nonnegative(),
});

export const registrationClearedSchema = z.object({
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
  createdAtDevice: z.string().datetime(),
  localSeq: z.number().int().nonnegative(),
});

export const syncStateSchema = z.object({
  deviceId: z.string().min(1),
  eventId: z.string().min(1),
  lastPulledVersion: z.number().int().nonnegative(),
  lastPushedSeqAck: z.number().int().nonnegative(),
  lastCompetitorRowVersion: z.number().int().nonnegative().default(0),
});

export type Competitor = z.infer<typeof competitorSchema>;
export type EventClass = z.infer<typeof classSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Event = z.infer<typeof eventSchema>;
export type QuickFilter = z.infer<typeof quickFilterSchema>;
export type PricingRule = z.infer<typeof pricingRuleSchema>;
export type PaymentGroupMember = z.infer<typeof paymentGroupMemberSchema>;
export type CompetitionGroup = z.infer<typeof competitionGroupSchema>;
export type PaymentGroup = z.infer<typeof paymentGroupSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type RegistrationCleared = z.infer<typeof registrationClearedSchema>;
export type SyncState = z.infer<typeof syncStateSchema>;
