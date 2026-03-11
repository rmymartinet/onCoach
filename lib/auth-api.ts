type AuthPayload = {
  email: string;
  password: string;
  name?: string;
};

type AuthResult = {
  ok: boolean;
  message?: string;
};

function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8081";
}

async function postAuth(path: string, payload: AuthPayload): Promise<AuthResult> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => ({}))) as
      | { message?: string }
      | undefined;

    if (!response.ok) {
      return {
        ok: false,
        message: body?.message ?? "Authentication failed.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Network error. Check EXPO_PUBLIC_API_BASE_URL.",
    };
  }
}

export function signUpWithEmail(payload: AuthPayload) {
  return postAuth("/api/auth/sign-up/email", payload);
}

export function signInWithEmail(payload: AuthPayload) {
  return postAuth("/api/auth/sign-in/email", payload);
}
