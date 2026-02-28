// src/lib/store/appStore.ts
// Global client state — persisted to localStorage.
// Only stores ephemeral session data: current resume_id, job_id, selected candidate.
// Server state (API data) lives in TanStack Query, not here.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ParsedResume, RankedCandidate } from '@/types';

interface AppState {
  // Current resume session
  resumeId: string | null;
  parsedResume: ParsedResume | null;

  // Current job context
  jobId: string | null;

  // Recruiter selected candidate for analysis
  selectedCandidate: RankedCandidate | null;

  // Actions
  setResume: (id: string, data: ParsedResume) => void;
  clearResume: () => void;
  setJobId: (id: string) => void;
  clearJobId: () => void;
  setSelectedCandidate: (c: RankedCandidate | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      resumeId: null,
      parsedResume: null,
      jobId: null,
      selectedCandidate: null,

      setResume: (id, data) => set({ resumeId: id, parsedResume: data }),
      clearResume: () => set({ resumeId: null, parsedResume: null }),
      setJobId: (id) => set({ jobId: id }),
      clearJobId: () => set({ jobId: null }),
      setSelectedCandidate: (c) => set({ selectedCandidate: c }),
      reset: () => set({ resumeId: null, parsedResume: null, jobId: null, selectedCandidate: null }),
    }),
    {
      name: 'talentai-session',
      storage: createJSONStorage(() => {
        // Safe SSR — fall back to noop if window not available
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
    },
  ),
);
