import { Suspense } from 'react';
import Login from '@/components/views/login-page';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-950" />}>
      <Login />
    </Suspense>
  );
}
