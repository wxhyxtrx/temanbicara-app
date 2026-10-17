import { z } from 'zod';

export const scheduleSlotSchema = z
  .object({
    weekday: z
      .number()
      .int('Hari harus berupa bilangan bulat')
      .min(0, 'Hari minimal 0 (Minggu)')
      .max(6, 'Hari maksimal 6 (Sabtu)'),
    start_hour: z
      .number()
      .int('Jam mulai harus berupa bilangan bulat')
      .min(0, 'Jam mulai minimal 0')
      .max(23, 'Jam mulai maksimal 23'),
    end_hour: z
      .number()
      .int('Jam selesai harus berupa bilangan bulat')
      .min(1, 'Jam selesai minimal 1')
      .max(24, 'Jam selesai maksimal 24'),
  })
  .refine((data) => data.end_hour > data.start_hour, {
    message: 'Jam selesai (end_hour) harus lebih besar dari jam mulai (start_hour)',
    path: ['end_hour'],
  });

export const updateScheduleSchema = z
  .object({
    weekly: z.array(scheduleSlotSchema),
  })
  .refine(
    (data) => {
      // Kelompokkan per weekday
      const byDay = new Map<number, { start_hour: number; end_hour: number }[]>();
      for (const slot of data.weekly) {
        const list = byDay.get(slot.weekday) ?? [];
        list.push(slot);
        byDay.set(slot.weekday, list);
      }

      // Cek maksimal 10 rentang per hari
      for (const [, slots] of byDay) {
        if (slots.length > 10) return false;
      }

      // Cek tumpang tindih (overlap) di hari yang sama
      for (const [, slots] of byDay) {
        const sorted = [...slots].sort((a, b) => a.start_hour - b.start_hour);
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].end_hour > sorted[i + 1].start_hour) {
            return false;
          }
        }
      }

      return true;
    },
    {
      message: 'Rentang jam di hari yang sama tidak boleh tumpang tindih atau melebihi 10 rentang per hari',
      path: ['weekly'],
    }
  );

export const createTimeOffSchema = z
  .object({
    start_at: z.string().refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format start_at harus berupa ISO timestamp yang valid',
    }),
    end_at: z.string().refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format end_at harus berupa ISO timestamp yang valid',
    }),
    reason: z
      .string()
      .trim()
      .max(500, 'Alasan libur maksimal 500 karakter')
      .nullable()
      .optional(),
  })
  .refine((data) => new Date(data.end_at).getTime() > new Date(data.start_at).getTime(), {
    message: 'Waktu selesai (end_at) harus lebih besar dari waktu mulai (start_at)',
    path: ['end_at'],
  });

export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type UpdateScheduleDTO = z.infer<typeof updateScheduleSchema>;
export type CreateTimeOffDTO = z.infer<typeof createTimeOffSchema>;
