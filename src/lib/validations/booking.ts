import { z } from 'zod';

export const createBookingSchema = z.object({
  psikolog_id: z
    .string()
    .uuid('Format ID psikolog tidak valid'),
  start_at: z
    .string()
    .refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format start_at harus berupa timestamp ISO yang valid',
    }),
  keluhan: z
    .string()
    .trim()
    .min(20, 'Keluhan minimal 20 karakter')
    .max(1000, 'Keluhan maksimal 1000 karakter'),
});

export const rescheduleBookingSchema = z.object({
  new_start_at: z
    .string()
    .refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format new_start_at harus berupa timestamp ISO yang valid',
    }),
});

export const bookingQuerySchema = z.object({
  scope: z.enum(['upcoming', 'history']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;
