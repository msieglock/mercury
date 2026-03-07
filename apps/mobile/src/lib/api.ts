import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8787";

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  method?: RequestMethod;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync("mercury_session");
}

async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync("mercury_session", token);
}

async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync("mercury_session");
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers: customHeaders } = options;
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API Error ${response.status}: ${errorBody || response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T = unknown>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: Record<string, unknown>) =>
    apiRequest<T>(endpoint, { method: "POST", body }),

  put: <T = unknown>(endpoint: string, body?: Record<string, unknown>) =>
    apiRequest<T>(endpoint, { method: "PUT", body }),

  patch: <T = unknown>(endpoint: string, body?: Record<string, unknown>) =>
    apiRequest<T>(endpoint, { method: "PATCH", body }),

  delete: <T = unknown>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};

export { getToken, setToken, clearToken, API_URL };
