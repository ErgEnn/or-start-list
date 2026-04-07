use diesel::{
    sql_types::{BigInt, Integer, Nullable, Text},
    QueryableByName,
};
use serde::{Deserialize, Serialize};

pub const SYNC_STATUS_EVENT: &str = "desktop://sync-status";
pub const SELECTED_EVENT_KEY: &str = "selectedEventId";
pub const PORTAL_BASE_URL_KEY: &str = "portalBaseUrl";
pub const DEVICE_ID_KEY: &str = "deviceId";
pub const API_KEY_KEY: &str = "apiKey";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSyncStatus {
    pub status: String,
    pub last_successful_sync_at: Option<String>,
    pub last_error: Option<String>,
    pub last_error_detail: Option<String>,
    pub pending_registrations: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct BaseCompetitorRow {
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub eol_number: String,
    #[diesel(sql_type = Text)]
    pub first_name: String,
    #[diesel(sql_type = Text)]
    pub last_name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub gender: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub dob: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub club: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub si_card: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorRow {
    pub competitor_id: String,
    pub eol_number: String,
    pub first_name: String,
    pub last_name: String,
    pub gender: Option<String>,
    pub dob: Option<String>,
    pub club: Option<String>,
    pub si_card: Option<String>,
    pub available_competition_groups: Vec<CompetitionGroupPayload>,
    pub selected_competition_group_name: Option<String>,
    pub price_cents: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct CourseRow {
    #[diesel(sql_type = Text)]
    pub event_id: String,
    #[diesel(sql_type = Text)]
    pub course_id: String,
    #[diesel(sql_type = Text)]
    pub class_id: String,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = BigInt)]
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    #[diesel(sql_type = Text)]
    pub event_id: String,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub start_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentGroupMemberPayload {
    pub competitor_id: String,
    pub price_override_cents: Option<i64>,
    #[serde(default)]
    pub compensated_events: Option<i64>,
    #[serde(default)]
    pub events_attended: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentGroupPayload {
    pub payment_group_id: String,
    pub name: String,
    pub color_hex: Option<String>,
    pub global_price_override: Option<i64>,
    #[serde(default)]
    pub sort_order: i32,
    pub competitor_ids: Vec<String>,
    pub competitors: Vec<PaymentGroupMemberPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct PaymentGroupRow {
    #[diesel(sql_type = Text)]
    pub payment_group_id: String,
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub color_hex: Option<String>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub global_price_override: Option<i64>,
    #[diesel(sql_type = Integer)]
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct PaymentGroupMemberRow {
    #[diesel(sql_type = Text)]
    pub payment_group_id: String,
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub price_override_cents: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub compensated_events: Option<i64>,
    #[diesel(sql_type = BigInt)]
    pub events_attended: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapPreferencePayload {
    pub competitor_id: String,
    pub course_name: String,
    pub waterproof_map: bool,
}

#[derive(Debug, Clone, QueryableByName)]
pub struct MapPreferenceRow {
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub course_name: String,
    #[diesel(sql_type = Integer)]
    pub waterproof_map: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitionGroupPayload {
    pub name: String,
    pub gender: Option<String>,
    pub min_year: Option<i64>,
    pub max_year: Option<i64>,
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct CompetitionGroupRow {
    #[diesel(sql_type = Text)]
    pub name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub gender: Option<String>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub min_year: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    pub max_year: Option<i64>,
    #[diesel(sql_type = BigInt)]
    pub price_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct RecentRegistrationRow {
    #[diesel(sql_type = Text)]
    pub registration_id: String,
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub competitor_name: String,
    #[diesel(sql_type = Text)]
    pub course_id: String,
    #[diesel(sql_type = Text)]
    pub course_name: String,
    #[diesel(sql_type = Text)]
    pub competition_group_name: String,
    #[diesel(sql_type = BigInt)]
    pub price_cents: i64,
    #[diesel(sql_type = BigInt)]
    pub paid_price_cents: i64,
    #[diesel(sql_type = Text)]
    pub payment_method: String,
    #[diesel(sql_type = Text)]
    pub created_at_device: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct AllRegistrationRow {
    #[diesel(sql_type = Text)]
    pub registration_id: String,
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub eol_number: String,
    #[diesel(sql_type = Text)]
    pub first_name: String,
    #[diesel(sql_type = Text)]
    pub last_name: String,
    #[diesel(sql_type = Text)]
    pub course_id: String,
    #[diesel(sql_type = Text)]
    pub course_name: String,
    #[diesel(sql_type = BigInt)]
    pub paid_price_cents: i64,
    #[diesel(sql_type = Text)]
    pub created_at_device: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct SelectedRegistrationRow {
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub course_id: String,
    #[diesel(sql_type = Text)]
    pub competition_group_name: String,
    #[diesel(sql_type = BigInt)]
    pub paid_price_cents: i64,
    #[diesel(sql_type = Text)]
    pub payment_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct CompetitionGroupSelectionRow {
    #[diesel(sql_type = Text)]
    pub competitor_id: String,
    #[diesel(sql_type = Text)]
    pub competition_group_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedRegistrationInfo {
    pub course_id: String,
    pub paid_price_cents: i64,
    pub payment_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEventState {
    pub selected_event_id: String,
    pub courses: Vec<CourseRow>,
    pub selected_courses_by_competitor: std::collections::HashMap<String, String>,
    pub selected_registrations_by_competitor: std::collections::HashMap<String, SelectedRegistrationInfo>,
    pub recent_registrations: Vec<RecentRegistrationRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopQueryCompetitorsRequest {
    pub filter_id: String,
    pub query: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopQueryCompetitorsResponse {
    pub rows: Vec<CompetitorRow>,
    pub grouped_count: i64,
    pub indexed_count: i64,
    pub visible_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBootstrapResponse {
    pub events: Vec<EventRow>,
    pub payment_groups: Vec<PaymentGroupPayload>,
    pub map_preferences: Vec<MapPreferencePayload>,
    pub competition_groups: Vec<CompetitionGroupPayload>,
    pub sync_status: DesktopSyncStatus,
    pub event_state: DesktopEventState,
    pub query_result: DesktopQueryCompetitorsResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCreateRegistrationRequest {
    pub event_id: String,
    pub competitor_id: String,
    pub course_id: String,
    pub competition_group_name: String,
    pub paid_price_cents: i64,
    pub payment_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCreateRegistrationResponse {
    pub selected_event_id: String,
    pub courses: Vec<CourseRow>,
    pub selected_courses_by_competitor: std::collections::HashMap<String, String>,
    pub selected_registrations_by_competitor: std::collections::HashMap<String, SelectedRegistrationInfo>,
    pub recent_registrations: Vec<RecentRegistrationRow>,
    pub push_result: Option<PushResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopClearRegistrationRequest {
    pub event_id: String,
    pub competitor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateRegistrationPaymentRequest {
    pub event_id: String,
    pub competitor_id: String,
    pub paid_price_cents: i64,
    pub payment_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSetCompetitionGroupRequest {
    pub event_id: String,
    pub competitor_id: String,
    pub competition_group_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName)]
#[serde(rename_all = "camelCase")]
pub struct ReservedCodeRow {
    #[diesel(sql_type = Text)]
    pub code: String,
    #[diesel(sql_type = BigInt)]
    pub is_reserved: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservedCodePayload {
    pub code: String,
    pub is_reserved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopClaimReservedCodeRequest {
    pub code: String,
    pub event_id: String,
    pub course_id: String,
    pub competition_group_name: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub gender: String,
    pub dob: String,
    pub club: Option<String>,
    pub si_card: Option<String>,
    pub is_manual_eol: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReservedCodeClaimedPayload {
    pub code: String,
    pub competitor_id: String,
    pub eol_number: String,
    pub first_name: String,
    pub last_name: String,
    pub gender: Option<String>,
    pub dob: Option<String>,
    pub club: Option<String>,
    pub si_card: Option<String>,
    pub is_manual_eol: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationPayload {
    pub registration_id: String,
    pub device_id: String,
    pub event_id: String,
    pub competitor_id: String,
    pub course_id: String,
    pub competition_group_name: String,
    pub price_cents: i64,
    pub paid_price_cents: i64,
    pub payment_method: String,
    pub created_at_device: String,
    pub local_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationClearedPayload {
    pub event_id: String,
    pub competitor_id: String,
    pub created_at_device: String,
    pub local_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboxItem {
    pub local_seq: i64,
    #[serde(rename = "type")]
    pub item_type: String,
    pub payload: serde_json::Value,
    pub created_at: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResponse {
    pub ack_seq_inclusive: i64,
    pub accepted_count: i64,
    pub rejected: Vec<RejectedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectedItem {
    pub local_seq: i64,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSyncCycleRequest {
    pub since_competitor_version: i64,
    pub event_versions: std::collections::HashMap<String, i64>,
    pub pending_registrations: Vec<OutboxItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSyncCycleResponse {
    pub ack_seq_inclusive: i64,
    pub accepted_count: i64,
    pub rejected: Vec<RejectedItem>,
    pub events: Vec<EventRow>,
    pub payment_groups: Vec<PaymentGroupPayload>,
    pub map_preferences: Vec<MapPreferencePayload>,
    pub competition_groups: Vec<CompetitionGroupPayload>,
    pub competitor_delta: CompetitorDeltaResponse,
    pub event_snapshots: Vec<PullPayload>,
    pub reserved_codes: Vec<ReservedCodePayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorDeltaResponse {
    pub current_version: i64,
    pub latest_row_version: i64,
    pub next_since_row_version: i64,
    pub next_after_competitor_id: String,
    pub has_more: bool,
    pub changes: Vec<CompetitorDeltaItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitorDeltaItem {
    pub row_version: i64,
    pub competitor_id: String,
    pub change_type: String,
    pub competitor: Option<BaseCompetitorRow>,
    pub changed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassRow {
    pub class_id: String,
    pub event_id: String,
    pub name: String,
    pub short_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterRow {
    pub filter_id: String,
    pub event_id: String,
    pub name: String,
    pub query_definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingRow {
    pub pricing_rule_id: String,
    pub event_id: String,
    pub rule_name: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullData {
    pub event: Option<EventRow>,
    pub competitors: Vec<BaseCompetitorRow>,
    pub classes: Vec<ClassRow>,
    pub courses: Vec<CourseRow>,
    pub filters: Vec<FilterRow>,
    pub pricing: Vec<PricingRow>,
    pub registrations: Vec<RegistrationPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullPayload {
    pub version: i64,
    pub mode: String,
    pub data: PullData,
}

#[derive(QueryableByName)]
pub struct CountRow {
    #[diesel(sql_type = BigInt)]
    pub count: i64,
}

#[derive(QueryableByName)]
pub struct ConfigRow {
    #[diesel(sql_type = Text)]
    pub config_key: String,
    #[diesel(sql_type = Text)]
    pub config_value: String,
}

#[derive(QueryableByName)]
pub struct ConfigValueRow {
    #[diesel(sql_type = Text)]
    pub config_value: String,
}

#[derive(QueryableByName)]
pub struct EventVersionRow {
    #[diesel(sql_type = Text)]
    pub event_id: String,
    #[diesel(sql_type = BigInt)]
    pub version: i64,
}

#[derive(QueryableByName)]
pub struct SyncMetaRow {
    #[diesel(sql_type = BigInt)]
    pub last_competitor_version: i64,
    #[diesel(sql_type = Nullable<Text>)]
    pub last_successful_sync_at: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub last_sync_error: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    pub last_sync_error_detail: Option<String>,
    #[diesel(sql_type = Text)]
    pub worker_status: String,
}

#[derive(QueryableByName)]
pub struct OutboxRow {
    #[diesel(sql_type = Text)]
    pub payload: String,
    #[diesel(sql_type = Text)]
    pub created_at: String,
    #[diesel(sql_type = Text)]
    pub status: String,
    #[diesel(sql_type = Text)]
    pub item_type: String,
    #[diesel(sql_type = BigInt)]
    pub local_seq: i64,
}

#[derive(QueryableByName)]
pub struct TableColumnRow {
    #[diesel(sql_type = Text)]
    pub name: String,
}
