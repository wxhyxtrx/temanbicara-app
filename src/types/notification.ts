export type NotificationType =
  | 'booking_new'
  | 'booking_cancelled'
  | 'psikolog_cancelled_choice'
  | 'session_reminder_60'
  | 'session_reminder_10'
  | 'session_started'
  | 'completed'
  | 'auto_cancelled_late'
  | 'no_show'
  | 'reschedule'
  | 'extension_requested'
  | 'extension_approved'
  | 'extension_declined'
  | 'tip_received'
  | 'strike_added'
  | 'suspended'
  | 'peer_pool_new_ticket'
  | 'peer_ticket_claimed'
  | 'peer_session_started'
  | 'peer_greeting_reminder_3'
  | 'peer_new_message'
  | 'peer_ticket_reopened'
  | 'peer_claim_timeout'
  | 'peer_session_closed'
  | 'peer_session_closed_by_patient'
  | 'peer_ticket_archived'
  | 'peer_review_received'
  | 'peer_tip_received';

export interface NotificationEntity {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsListResponse {
  success: boolean;
  data: NotificationEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unread_count: number;
}
