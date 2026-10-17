export interface ScheduleWeeklyItem {
  id?: string;
  weekday: number;
  start_hour: number;
  end_hour: number;
}

export interface TimeOffItem {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at?: string;
}

export interface CounselorScheduleData {
  weekly: ScheduleWeeklyItem[];
  time_off: TimeOffItem[];
  booking_paused: boolean;
  extension_price_coins: number | null;
  suspended_until: string | null;
}

export interface ConflictingBooking {
  id: string;
  start_at: string;
}

export interface CreateTimeOffResult extends TimeOffItem {
  conflicting_bookings: ConflictingBooking[];
}

export class ScheduleApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ScheduleApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new ScheduleApiError(res.status, errorMsg, json?.error, json?.details);
  }
  return json;
}

export const scheduleClient = {
  async getSchedule(): Promise<{ success: boolean; data: CounselorScheduleData }> {
    const res = await fetch('/api/counselor/schedule', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: CounselorScheduleData }>(res);
  },

  async updateSchedule(weekly: { weekday: number; start_hour: number; end_hour: number }[]): Promise<{
    success: boolean;
    data: { weekly: ScheduleWeeklyItem[] };
    message?: string;
  }> {
    const res = await fetch('/api/counselor/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ weekly }),
    });
    return handleResponse<{
      success: boolean;
      data: { weekly: ScheduleWeeklyItem[] };
      message?: string;
    }>(res);
  },

  async createTimeOff(payload: {
    start_at: string;
    end_at: string;
    reason?: string | null;
  }): Promise<{ success: boolean; data: CreateTimeOffResult; message?: string }> {
    const res = await fetch('/api/counselor/time-off', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: CreateTimeOffResult; message?: string }>(res);
  },

  async deleteTimeOff(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/counselor/time-off/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },
};
