import { Suspense } from 'react';
import ForgotPasswordView from '@/components/views/forgot-password';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <ForgotPasswordView />
    </Suspense>
  );
}
