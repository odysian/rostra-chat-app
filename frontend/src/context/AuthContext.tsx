import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { User } from "../types";
import { getCurrentUser } from "../services/api";
import { setUnauthorizedHandler } from "../services/api";

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: (redirect?: boolean) => void;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isColdStart: boolean;
  authError: string | null;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isColdStart, setIsColdStart] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Incremented to trigger a re-run of the verify effect
  const [authAttempt, setAuthAttempt] = useState<number>(0);

  const retryAuth = () => {
    setAuthError(null);
    setAuthAttempt((prev) => prev + 1);
  };

  const logout = (redirect: boolean = false) => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsAuthenticating(false);
    setIsColdStart(false);
    setAuthError(null);

    if (redirect) {
      window.location.href = "/login";
    }
  };

  // Returns true if the error is an auth rejection (invalid/expired token)
  // vs a network/timeout issue where the server may just be starting up
  function isAuthError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('401') || msg.includes('unauthorized');
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    // Defer state setting to avoid cascading renders (lint: react-hooks/set-state-in-effect)
    const authTimer = setTimeout(() => {
      if (!cancelled) {
        setIsAuthenticating(true);
        setAuthError(null);
      }
    }, 0);

    // Show cold start notice after 5s of waiting
    const coldStartTimer = setTimeout(() => {
      if (!cancelled) setIsColdStart(true);
    }, 5000);

    // apiCall already retries 4 times with backoff (covers ~60s of cold start).
    // We just need to handle the final outcome correctly.
    getCurrentUser(token)
      .then((userData) => {
        if (cancelled) return;
        // Prevent deferred "start authenticating" state from overriding settled result.
        clearTimeout(authTimer);
        clearTimeout(coldStartTimer);
        setUser(userData);
        setIsAuthenticating(false);
        setIsColdStart(false);
      })
      .catch((err) => {
        if (cancelled) return;
        // Prevent deferred "start authenticating" state from overriding settled result.
        clearTimeout(authTimer);
        clearTimeout(coldStartTimer);

        if (isAuthError(err)) {
          // Token is invalid/expired — clear it and let ProtectedRoute redirect
          setToken(null);
          localStorage.removeItem("token");
          setIsAuthenticating(false);
          setIsColdStart(false);
        } else {
          // Network/timeout error — keep the token, show retry UI
          setIsAuthenticating(false);
          setIsColdStart(false);
          setAuthError(
            "Couldn't reach the server. It may still be starting up."
          );
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(authTimer);
      clearTimeout(coldStartTimer);
    };
  }, [token, authAttempt]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Clear authentication state immediately
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setIsAuthenticating(false);
      setIsColdStart(false);
      
      // Force immediate redirect to login
      window.location.href = "/login";
    });
  }, []); // Now logout is defined above

  const login = async (newToken: string) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    // Authentication state will be handled by the useEffect above
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token && !isAuthenticating && !!user,
        isAuthenticating,
        isColdStart,
        authError,
        retryAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
