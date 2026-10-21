const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  ""
);
const TOKEN_KEY = "bh_api_token";

export const useVpsApi =
  String(import.meta.env.VITE_USE_VPS_API || "").toLowerCase() === "true";

export function getApiToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setApiToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export type ApiUser = {
  id: string;
  email: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  role?: "coach" | "aluno" | null;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, token }: RequestOptions = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error("VITE_API_URL não configurada");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const auth = token === undefined ? getApiToken() : token;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data && typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function apiLogin(email: string, password: string) {
  const data = await apiRequest<{ user: ApiUser; token: string }>(
    "/auth/login",
    { method: "POST", body: { email, password }, token: null }
  );
  setApiToken(data.token);
  return data;
}

export async function apiMe() {
  return apiRequest<{ user: ApiUser }>("/auth/me");
}

export async function apiLogout() {
  try {
    await apiRequest("/auth/logout", { method: "POST", body: {} });
  } finally {
    setApiToken(null);
  }
}

export async function apiColeman(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = []
) {
  return apiRequest<{
    reply: string;
    escalate?: boolean;
    reason?: string;
  }>("/api/coleman", {
    method: "POST",
    body: { message, history },
  });
}
