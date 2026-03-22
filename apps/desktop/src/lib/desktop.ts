import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  desktopBootstrapSchema,
  desktopClearRegistrationResponseSchema,
  desktopCreateRegistrationResponseSchema,
  desktopEventStateSchema,
  desktopQueryCompetitorsResponseSchema,
  desktopSetCompetitionGroupRequestSchema,
  desktopSyncStatusSchema,
  reservedCodeSchema,
  type DesktopBootstrap,
  type DesktopClaimReservedCodeRequest,
  type DesktopClearRegistrationRequest,
  type DesktopClearRegistrationResponse,
  type DesktopCreateRegistrationRequest,
  type DesktopCreateRegistrationResponse,
  type DesktopEventState,
  type DesktopQueryCompetitorsRequest,
  type DesktopQueryCompetitorsResponse,
  type DesktopSetCompetitionGroupRequest,
  type DesktopSyncStatus,
  type DesktopUpdateRegistrationPaymentRequest,
  type ReservedCode,
} from "@or/shared";

const SYNC_STATUS_EVENT = "desktop://sync-status";

export async function desktopBootstrap(): Promise<DesktopBootstrap> {
  return desktopBootstrapSchema.parse(await invoke("desktop_bootstrap"));
}

export async function desktopQueryCompetitors(
  request: DesktopQueryCompetitorsRequest,
): Promise<DesktopQueryCompetitorsResponse> {
  return desktopQueryCompetitorsResponseSchema.parse(
    await invoke("desktop_query_competitors", { request }),
  );
}

export async function desktopSelectEvent(eventId: string): Promise<DesktopEventState> {
  return desktopEventStateSchema.parse(await invoke("desktop_select_event", { eventId }));
}

export async function desktopCreateRegistration(
  request: DesktopCreateRegistrationRequest,
): Promise<DesktopCreateRegistrationResponse> {
  return desktopCreateRegistrationResponseSchema.parse(
    await invoke("desktop_create_registration", { request }),
  );
}

export async function desktopClearRegistration(
  request: DesktopClearRegistrationRequest,
): Promise<DesktopClearRegistrationResponse> {
  return desktopClearRegistrationResponseSchema.parse(
    await invoke("desktop_clear_registration", { request }),
  );
}

export async function desktopUpdateRegistrationPayment(
  request: DesktopUpdateRegistrationPaymentRequest,
): Promise<DesktopCreateRegistrationResponse> {
  return desktopCreateRegistrationResponseSchema.parse(
    await invoke("desktop_update_registration_payment", { request }),
  );
}

export async function desktopSetCompetitionGroup(
  request: DesktopSetCompetitionGroupRequest,
): Promise<void> {
  desktopSetCompetitionGroupRequestSchema.parse(request);
  await invoke("desktop_set_competition_group", { request });
}

export async function desktopGetReservedCodes(): Promise<ReservedCode[]> {
  return z.array(reservedCodeSchema).parse(await invoke("desktop_get_reserved_codes"));
}

export async function desktopClaimReservedCode(
  request: DesktopClaimReservedCodeRequest,
): Promise<DesktopCreateRegistrationResponse> {
  return desktopCreateRegistrationResponseSchema.parse(
    await invoke("desktop_claim_reserved_code", { request }),
  );
}

export async function desktopGetSyncStatus(): Promise<DesktopSyncStatus> {
  return desktopSyncStatusSchema.parse(await invoke("desktop_get_sync_status"));
}

export async function desktopForceSync(): Promise<void> {
  await invoke("desktop_force_sync");
}

export async function onDesktopSyncStatus(
  callback: (status: DesktopSyncStatus) => void,
): Promise<UnlistenFn> {
  return listen<DesktopSyncStatus>(SYNC_STATUS_EVENT, (event) => {
    callback(desktopSyncStatusSchema.parse(event.payload));
  });
}
