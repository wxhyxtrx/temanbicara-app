import { PATCH as updateHandler } from '@/app/api/users/[id]/route';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return updateHandler(req, context);
}
