"use client";

import { useState, useCallback } from "react";
import type { User, Role } from "@/types";

const MOCK_MEMBER: User = {
  id: "1",
  name: "Rahim Uddin",
  email: "rahim@example.com",
  role: "member",
  status: "active",
  phone: "+880 1712-345678",
  bkash: "01712-345678",
  telegram: "@rahim_uddin",
  bio: "Full-stack developer working with Node.js and React.",
  memberSince: "January 2026",
  expiresAt: "April 30, 2026",
};

const MOCK_ADMIN: User = {
  id: "admin-1",
  name: "Foyzul Karim",
  email: "foyzul@example.com",
  role: "admin",
  status: "active",
};

export function useMockAuth() {
  const [user, setUser] = useState<User | null>(MOCK_MEMBER);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback((role: Role = "member") => {
    setIsLoading(true);
    setTimeout(() => {
      setUser(role === "admin" ? MOCK_ADMIN : MOCK_MEMBER);
      setIsLoading(false);
    }, 300);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchRole = useCallback((role: Role) => {
    setUser(role === "admin" ? MOCK_ADMIN : MOCK_MEMBER);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    logout,
    switchRole,
  };
}
