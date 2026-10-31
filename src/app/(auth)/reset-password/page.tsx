import { Suspense } from 'react';
import ResetPasswordView from '@/components/views/reset-password';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <ResetPasswordView />
    </Suspense>
  );
}
