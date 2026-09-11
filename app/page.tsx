'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hommed_user_session');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user.role === 'admin') {
            router.push('/admin/dashboard');
            return;
          } else if (user.role === 'caller') {
            router.push('/caller');
            return;
          }
        } catch (e) {}
      }
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center font-mono text-xs text-slate-400">
        Redirecting to Hommed Lead CRM...
      </div>
    </div>
  );
}
