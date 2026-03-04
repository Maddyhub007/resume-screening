"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Shape ────────────────────────────────────────────────────────────────────
// accessToken lives in memory ONLY — never persisted to localStorage.
// role / userId / userName are persisted so the UI survives a page refresh
// (the middleware will call /auth/refresh on mount to re-validate).

interface AuthState {
  // Persisted (across page refreshes)
  role:     "candidate" | "recruiter" | null;
  userId:   string | null;
  userName: string | null;

  // Memory-only (cleared on page reload — re-hydrated via /auth/refresh)
  accessToken: string | null;

  // Actions
  setAuth: (
    role:        "candidate" | "recruiter",
    userId:      string,
    userName:    string,
    accessToken: string
  ) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role:        null,
      userId:      null,
      userName:    null,
      accessToken: null,   // NOT in partialize — never hits localStorage

      setAuth: (role, userId, userName, accessToken) =>
        set({ role, userId, userName, accessToken }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ role: null, userId: null, userName: null, accessToken: null }),
    }),
    {
      name: process.env.NEXT_PUBLIC_AUTH_STORAGE_KEY ?? "ats-auth-v1",
      // Only persist identity — access token lives in memory only
      partialize: (state) => ({
        role:     state.role,
        userId:   state.userId,
        userName: state.userName,
      }),
    }
  )
);
