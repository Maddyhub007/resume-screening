"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState } from "@/lib/types";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null,
      userId: null,
      userName: null,
      setAuth: (role, userId, userName) => set({ role, userId, userName }),
      logout: () => set({ role: null, userId: null, userName: null }),
    }),
    {
      name: process.env.NEXT_PUBLIC_AUTH_STORAGE_KEY ?? "ats-auth-v1",
    }
  )
);
