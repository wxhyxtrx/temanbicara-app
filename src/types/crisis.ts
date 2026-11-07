export type CrisisAlertSource = 'booking' | 'peer_ticket';
export type CrisisAlertDetectedBy = 'keyword' | 'manual';
export type CrisisAlertStatus = 'new' | 'handled' | 'false_alarm';

export interface CrisisAlertItem {
  id: string;
  source: CrisisAlertSource;
  booking_id: string | null;
  ticket_id: string | null;
  patient_id: string;
  patient_display_name: string;
  detected_by: CrisisAlertDetectedBy;
  reporter_id: string | null;
  reporter_name: string | null;
  category: string;
  snippet: string | null;
  hit_count: number;
  status: CrisisAlertStatus;
  handled_by: string | null;
  handler_name: string | null;
  handled_at: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface AdminCrisisAlertsResponse {
  success: boolean;
  data: CrisisAlertItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unhandled_count: number;
  };
}

export interface UpdateCrisisAlertDTO {
  status: 'handled' | 'false_alarm';
  admin_note?: string;
}

export interface ManualCrisisReportDTO {
  note?: string;
}
