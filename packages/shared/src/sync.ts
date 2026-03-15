import { z } from "zod";
import {
  classSchema,
  competitionGroupSchema,
  competitorSchema,
  courseSchema,
  eventSchema,
  paymentGroupSchema,
  pricingRuleSchema,
  quickFilterSchema,
  registrationClearedSchema,
  registrationSchema,
  reservedCodeClaimedPayloadSchema,
} from "./domain";

export const outboxItemSchema = z.discriminatedUnion("type", [
  z.object({
    localSeq: z.number().int().nonnegative(),
    type: z.literal("registration_created"),
    payload: registrationSchema,
    createdAt: z.string().min(1),
    status: z.enum(["pending", "synced", "failed"]),
  }),
  z.object({
    localSeq: z.number().int().nonnegative(),
    type: z.literal("registration_cleared"),
    payload: registrationClearedSchema,
    createdAt: z.string().min(1),
    status: z.enum(["pending", "synced", "failed"]),
  }),
  z.object({
    localSeq: z.number().int().nonnegative(),
    type: z.literal("reserved_code_claimed"),
    payload: reservedCodeClaimedPayloadSchema,
    createdAt: z.string().min(1),
    status: z.enum(["pending", "synced", "failed"]),
  }),
]);

export const pushRequestSchema = z.object({
  eventId: z.string().min(1),
  fromSeqExclusive: z.number().int().nonnegative(),
  items: z.array(outboxItemSchema),
});

export const pushResponseSchema = z.object({
  ackSeqInclusive: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  rejected: z.array(
    z.object({
      localSeq: z.number().int().nonnegative(),
      code: z.string().min(1),
    }),
  ),
});

export const pullResponseSchema = z.object({
  version: z.number().int().nonnegative(),
  mode: z.enum(["snapshot", "delta"]),
  data: z.object({
    event: eventSchema.optional(),
    competitors: z.array(competitorSchema),
    classes: z.array(classSchema),
    courses: z.array(courseSchema),
    filters: z.array(quickFilterSchema),
    pricing: z.array(pricingRuleSchema),
    registrations: z.array(registrationSchema),
  }),
});

export const heartbeatRequestSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["online", "offline", "degraded"]).default("online"),
  appVersion: z.string().min(1),
  platform: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const competitorDeltaItemSchema = z.object({
  rowVersion: z.number().int().nonnegative(),
  competitorId: z.string().min(1),
  changeType: z.enum(["upsert", "delete"]),
  competitor: competitorSchema.nullable(),
  changedAt: z.string().datetime(),
});

export const competitorDeltaResponseSchema = z.object({
  currentVersion: z.number().int().nonnegative(),
  latestRowVersion: z.number().int().nonnegative(),
  nextSinceRowVersion: z.number().int().nonnegative(),
  nextAfterCompetitorId: z.string(),
  hasMore: z.boolean(),
  changes: z.array(competitorDeltaItemSchema),
});

export const sourceCompetitorDeltaResponseSchema = competitorDeltaResponseSchema;

export const paymentGroupsResponseSchema = z.object({
  paymentGroups: z.array(paymentGroupSchema),
});

export const competitionGroupsResponseSchema = z.object({
  competitionGroups: z.array(competitionGroupSchema),
});

export type OutboxItem = z.infer<typeof outboxItemSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;
export type PushResponse = z.infer<typeof pushResponseSchema>;
export type PullResponse = z.infer<typeof pullResponseSchema>;
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export type CompetitorDeltaItem = z.infer<typeof competitorDeltaItemSchema>;
export type CompetitorDeltaResponse = z.infer<typeof competitorDeltaResponseSchema>;
export type SourceCompetitorDeltaResponse = z.infer<typeof sourceCompetitorDeltaResponseSchema>;
export type PaymentGroupsResponse = z.infer<typeof paymentGroupsResponseSchema>;
export type CompetitionGroupsResponse = z.infer<typeof competitionGroupsResponseSchema>;
