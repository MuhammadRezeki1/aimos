import { DUMMY_CREDENTIALS } from "@/constants/dummyCredentials";
import type { LoginPayload } from "@/types/auth";

export const AUTH_STORAGE_KEY = "aimos_auth_session";

export function validateLogin(payload: LoginPayload) {
  return (
    payload.username === DUMMY_CREDENTIALS.username &&
    payload.password === DUMMY_CREDENTIALS.password
  );
}

export function saveSession(username: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ isAuthenticated: true, username })
  );
}

export function getSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { isAuthenticated: boolean; username: string };
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
