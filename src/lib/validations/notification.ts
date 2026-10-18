import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const markNotificationsReadSchema = z
  .object({
    all: z.boolean().optional(),
    ids: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine(
    (data) => data.all === true || (Array.isArray(data.ids) && data.ids.length > 0),
    {
      message: 'Harus menyertakan all: true atau array ids non-kosong',
    }
  );

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
