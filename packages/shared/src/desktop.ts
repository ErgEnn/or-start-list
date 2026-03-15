import { z } from "zod";
import { competitionGroupSchema, competitorSchema, courseSchema, eventSchema, paymentGroupSchema, reservedCodeSchema } from "./domain";
import { competitorDeltaResponseSchema, outboxItemSchema, pullResponseSchema, pushResponseSchema } from "./sync";

export const desktopSyncStatusSchema = z.object({
  status: z.enum(["idle", "syncing", "online", "offline"]),
  lastSuccessfulSyncAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  lastErrorDetail: z.string().nullable().optional(),
  pendingRegistrations: z.number().int().nonnegative(),
});

export const desktopCompetitorRowSchema = competitorSchema.extend({
  gender: z.enum(["male", "female"]).nullable(),
  dob: z.string().nullable(),
  club: z.string().nullable(),
  siCard: z.string().nullable(),
  availableCompetitionGroups: z.array(competitionGroupSchema),
  selectedCompetitionGroupName: z.string().nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
});

export const desktopRecentRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  competitorId: z.string().min(1),
  competitorName: z.string().min(1),
  courseId: z.string().min(1),
  courseName: z.string().min(1),
  competitionGroupName: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  createdAtDevice: z.string().datetime(),
});

export const desktopQueryCompetitorsRequestSchema = z.object({
  filterId: z.string().min(1).default("all"),
  query: z.string().default(""),
});

export const desktopQueryCompetitorsResponseSchema = z.object({
  rows: z.array(desktopCompetitorRowSchema),
  groupedCount: z.number().int().nonnegative(),
  indexedCount: z.number().int().nonnegative(),
  visibleCount: z.number().int().nonnegative(),
});

export const desktopEventStateSchema = z.object({
  selectedEventId: z.string(),
  courses: z.array(courseSchema),
  selectedCoursesByCompetitor: z.record(z.string()),
  recentRegistrations: z.array(desktopRecentRegistrationSchema),
});

export const desktopBootstrapSchema = z.object({
  events: z.array(eventSchema),
  paymentGroups: z.array(paymentGroupSchema),
  competitionGroups: z.array(competitionGroupSchema),
  syncStatus: desktopSyncStatusSchema,
  eventState: desktopEventStateSchema,
  queryResult: desktopQueryCompetitorsResponseSchema,
});

export const desktopCreateRegistrationRequestSchema = z.object({
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
  courseId: z.string().min(1),
  competitionGroupName: z.string().min(1),
});

export const desktopCreateRegistrationResponseSchema = desktopEventStateSchema.extend({
  pushResult: pushResponseSchema.nullable().optional(),
});

export const desktopClearRegistrationRequestSchema = z.object({
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
});

export const desktopClearRegistrationResponseSchema = desktopEventStateSchema;

export const desktopSetCompetitionGroupRequestSchema = z.object({
  eventId: z.string().min(1),
  competitorId: z.string().min(1),
  competitionGroupName: z.string().min(1),
});

export const desktopClaimReservedCodeRequestSchema = z.object({
  code: z.string().min(1),
  eventId: z.string().min(1),
  courseId: z.string().min(1),
  competitionGroupName: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(["male", "female"]),
  dob: z.string().min(1),
  club: z.string().optional(),
  siCard: z.string().optional(),
  isManualEol: z.boolean().optional(),
});

export const deviceSyncCycleRequestSchema = z.object({
  sinceCompetitorVersion: z.number().int().nonnegative(),
  eventVersions: z.record(z.string(), z.number().int().nonnegative()),
  pendingRegistrations: z.array(outboxItemSchema),
});

export const deviceSyncCycleResponseSchema = z.object({
  ackSeqInclusive: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  rejected: pushResponseSchema.shape.rejected,
  events: z.array(eventSchema),
  paymentGroups: z.array(paymentGroupSchema),
  competitionGroups: z.array(competitionGroupSchema),
  competitorDelta: competitorDeltaResponseSchema,
  eventSnapshots: z.array(pullResponseSchema),
  reservedCodes: z.array(reservedCodeSchema),
});

export type DesktopSyncStatus = z.infer<typeof desktopSyncStatusSchema>;
export type DesktopCompetitorRow = z.infer<typeof desktopCompetitorRowSchema>;
export type DesktopRecentRegistration = z.infer<typeof desktopRecentRegistrationSchema>;
export type DesktopQueryCompetitorsRequest = z.infer<typeof desktopQueryCompetitorsRequestSchema>;
export type DesktopQueryCompetitorsResponse = z.infer<typeof desktopQueryCompetitorsResponseSchema>;
export type DesktopEventState = z.infer<typeof desktopEventStateSchema>;
export type DesktopBootstrap = z.infer<typeof desktopBootstrapSchema>;
export type DesktopCreateRegistrationRequest = z.infer<typeof desktopCreateRegistrationRequestSchema>;
export type DesktopCreateRegistrationResponse = z.infer<typeof desktopCreateRegistrationResponseSchema>;
export type DesktopClearRegistrationRequest = z.infer<typeof desktopClearRegistrationRequestSchema>;
export type DesktopClearRegistrationResponse = z.infer<typeof desktopClearRegistrationResponseSchema>;
export type DesktopSetCompetitionGroupRequest = z.infer<typeof desktopSetCompetitionGroupRequestSchema>;
export type DesktopClaimReservedCodeRequest = z.infer<typeof desktopClaimReservedCodeRequestSchema>;
export type DeviceSyncCycleRequest = z.infer<typeof deviceSyncCycleRequestSchema>;
export type DeviceSyncCycleResponse = z.infer<typeof deviceSyncCycleResponseSchema>;
