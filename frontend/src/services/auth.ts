const API_URL = import.meta.env.VITE_API_URL ?? "";

async function fetchAuthApi(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Can't reach the AZZA API. Start the app with `npm run dev` and check that PostgreSQL is running.",
      );
    }
    throw error;
  }
}

export type User = {
  id: number;
  name: string;
  email: string;
};

type AuthResponse = {
  user?: User;
  error?: string;
  message?: string;
  resetToken?: string;
};

function isAuthResponse(data: unknown): data is AuthResponse {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;

  const value = data as Record<string, unknown>;
  const user = value.user;
  return (
    (value.error === undefined || typeof value.error === "string") &&
    (value.message === undefined || typeof value.message === "string") &&
    (value.resetToken === undefined || typeof value.resetToken === "string") &&
    (user === undefined ||
      (typeof user === "object" &&
        user !== null &&
        !Array.isArray(user) &&
        typeof (user as Record<string, unknown>).id === "number" &&
        typeof (user as Record<string, unknown>).name === "string" &&
        typeof (user as Record<string, unknown>).email === "string"))
  );
}

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  const body = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(body);
  } catch {
    if (body.trimStart().startsWith("<")) {
      throw new Error(
        `The AZZA API returned a webpage instead of JSON (HTTP ${response.status}). Check that the backend is running and the API URL is configured correctly.`,
      );
    }
    throw new Error(`The AZZA API returned an unreadable response (HTTP ${response.status}).`);
  }

  if (!isAuthResponse(data)) {
    throw new Error("The AZZA API returned an invalid response.");
  }

  return data;
}

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const response = await fetchAuthApi("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  const data = await readAuthResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Unable to create your account.");
  }

  if (!data.user) {
    throw new Error("Authentication service returned an invalid response.");
  }

  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetchAuthApi("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await readAuthResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Unable to log in.");
  }

  if (!data.user) {
    throw new Error("Authentication service returned an invalid response.");
  }

  return data.user;
}

export async function getCurrentUser(): Promise<User | null> {
  const response = await fetchAuthApi("/api/auth/me", {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  const data = await readAuthResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Unable to check authentication.");
  }

  return data.user ?? null;
}

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string; resetToken?: string }> {
  const response = await fetchAuthApi("/api/auth/request-password-reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  const data = await readAuthResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Unable to request password reset.");
  }

  return {
    message:
      data.message ??
      "If that email is registered, a password reset link will be sent.",
    ...(data.resetToken ? { resetToken: data.resetToken } : {}),
  };
}

export async function resetPassword(
  email: string,
  token: string,
  password: string,
): Promise<string> {
  const response = await fetchAuthApi("/api/auth/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, token, password }),
  });

  const data = await readAuthResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Unable to reset your password.");
  }

  return data.message ?? "Password reset successful.";
}

export async function logout(): Promise<void> {
  const response = await fetchAuthApi("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error("Unable to log out.");
  }
}
