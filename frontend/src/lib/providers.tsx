'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Create one QueryClient per browser session
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // Don't retry 4xx errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status?: number }).status;
            if (status && status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--surface2, #141420)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text, #eeeef8)',
            fontFamily: "'DM Sans', sans-serif",
          },
        }}
      />
    </QueryClientProvider>
  );
}
