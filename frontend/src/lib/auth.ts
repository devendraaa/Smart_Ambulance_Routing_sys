"use client";

import { supabase } from "@/lib/supabase";

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isLoggedIn") === "true";
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("username");
}

export function getUser(): { id: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function logout() {
  if (typeof window === "undefined") return;
  supabase.auth.signOut();
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("username");
  localStorage.removeItem("user");
  // Clear all Supabase auth tokens from localStorage
  Object.keys(localStorage)
    .filter((key) => key.startsWith("sb-"))
    .forEach((key) => localStorage.removeItem(key));
}

export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  });

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Save to localStorage
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("username", data.user?.email || email);
  localStorage.setItem(
    "user",
    JSON.stringify({
      id: data.user?.id || "",
      email: data.user?.email || email,
    })
  );

  return { data, error };
}

export async function signInWithUsername(username: string, password: string) {
  return signIn(username, password);
}

export async function requireAuth(router: { push: (url: string) => void }) {
  if (!isLoggedIn()) {
    router.push("/login");
  }
}
