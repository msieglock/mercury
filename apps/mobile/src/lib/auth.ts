import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_URL, getToken, setToken, clearToken, apiRequest } from "./api";

WebBrowser.maybeCompleteAuthSession();

const redirectUrl = Linking.createURL("/(auth)/callback");

async function handleOAuthFlow(provider: "google" | "microsoft") {
  const authUrl = `${API_URL}/auth/${provider}?redirect_url=${encodeURIComponent(redirectUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

  if (result.type === "success") {
    const url = new URL(result.url);
    const token = url.searchParams.get("token");

    if (token) {
      await setToken(token);
    }
  }
}

export async function signInWithGoogle() {
  await handleOAuthFlow("google");
}

export async function signInWithMicrosoft() {
  await handleOAuthFlow("microsoft");
}

export async function signOut() {
  await clearToken();
}

export async function getSession() {
  const token = await getToken();
  return token ? { token } : null;
}

export async function getUser() {
  const token = await getToken();
  if (!token) return null;

  try {
    return await apiRequest<{ id: string; email: string; name: string }>(
      "/auth/me"
    );
  } catch {
    return null;
  }
}
