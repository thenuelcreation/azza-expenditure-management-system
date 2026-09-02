const API_URL = "http://localhost:4000";

export type User = {
  id?: number;
  name: string;
  email: string;
};

type AuthResponse = {
  user?: User;
  error?: string;
};

export async function signup(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/signup`, {
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

  const data: AuthResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to create your account.");
  }

  if (!data.user) {
    throw new Error("Authentication service returned an invalid response.");
  }

  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
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

  const data: AuthResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to log in.");
  }

  if (!data.user) {
    throw new Error("Authentication service returned an invalid response.");
  }

  return data.user;
}

export async function getCurrentUser(): Promise<User | null> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  const data: AuthResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to check authentication.");
  }

  return data.user ?? null;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok && response.status !== 204) {
    throw new Error("Unable to log out.");
  }
}
