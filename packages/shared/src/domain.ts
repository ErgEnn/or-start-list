import { z } from "zod";

export const competitorSchema = z.object({
  competitorId: z.string().min(1),
  eolNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
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

export const registrationSchema = z.object({
  registrationId: z.string().uuid(),
  deviceId: z.string().min(1),
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
  courseId: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
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
export type QuickFilter = z.infer<typeof quickFilterSchema>;
export type PricingRule = z.infer<typeof pricingRuleSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type SyncState = z.infer<typeof syncStateSchema>;
