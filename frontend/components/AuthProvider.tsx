"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { api, setClientToken, ApiError } from "@/lib/api/client";
import { Candidate, Recruiter } from "@/lib/types";

// ─── AuthProvider ─────────────────────────────────────────────────────────────
// Placed in the root layout. On every page load it:
//   1. Checks if Zustand has a persisted role/userId (user was previously logged in).
//   2. If yes, calls POST /auth/refresh to get a fresh access token using the
//      HttpOnly refresh cookie (browser sends it automatically).
//   3. If the refresh succeeds, stores the new access token in memory.
//   4. If the refresh fails (cookie expired/revoked), clears Zustand and
//      redirects to /login.
//   5. If Zustand has no role (fresh session), does nothing — middleware already
//      redirects unauthenticated users away from protected pages.
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const hydrated = useRef(false);

  const { role, userId, setAuth, setAccessToken, logout } = useAuthStore();

  useEffect(() => {
    // Only run once on mount
    if (hydrated.current) return;
    hydrated.current = true;

    // On a public page with no prior session, nothing to do
    if (!role || !userId) return;

    // We have persisted identity — try to refresh the access token silently
    ;(async () => {
      try {
        const res = await api.authRefresh();
        const { access_token, user } = res.data;

        // Store in Axios interceptor module memory
        setClientToken(access_token);
        // Update Zustand memory state (not persisted but available to components)
        setAccessToken(access_token);

        // Re-confirm identity (in case user or name changed)
        setAuth(
          res.data.role,
          (user as Candidate | Recruiter).id,
          (user as Candidate | Recruiter).full_name,
          access_token
        );

      } catch (err) {
        // Refresh failed — session is dead
        const code = err instanceof ApiError ? err.code : "";
        if (
          code === "REFRESH_EXPIRED" ||
          code === "MISSING_TOKEN" ||
          code === "TOKEN_REUSED" ||
          code === "INVALID_TOKEN"
        ) {
          logout();
          setClientToken(null);
          if (!PUBLIC_PATHS.includes(pathname)) {
            router.push("/login");
          }
        }
        // For network errors, keep the user on the page and let the
        // request interceptor handle per-request 401s.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
