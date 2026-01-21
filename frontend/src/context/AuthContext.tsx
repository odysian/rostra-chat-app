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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isColdStart, setIsColdStart] = useState<boolean>(false);

  // Declare logout BEFORE it's used in useEffect
  const logout = (redirect: boolean = false) => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setIsAuthenticating(false);
    setIsColdStart(false);
    
    if (redirect) {
      // Use window.location for immediate redirect (more reliable than React Router)
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    if (token) {
      // Defer state setting to avoid cascading renders
      const authTimer = setTimeout(() => {
        setIsAuthenticating(true);
      }, 0);
      
      // 5-second cold start detection timer
      const coldStartTimer = setTimeout(() => {
        setIsColdStart(true);
      }, 5000);

      // 10-second timeout for getCurrentUser call
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, 10000);

      getCurrentUser(token)
        .then((userData) => {
          clearTimeout(authTimer);
          clearTimeout(coldStartTimer);
          clearTimeout(timeoutId);
          setUser(userData);
          setIsAuthenticating(false);
          setIsColdStart(false);
        })
        .catch(() => {
          clearTimeout(authTimer);
          clearTimeout(coldStartTimer);
          clearTimeout(timeoutId);
          setToken(null);
          localStorage.removeItem("token");
          setIsAuthenticating(false);
          setIsColdStart(false);
        });

      return () => {
        clearTimeout(authTimer);
        clearTimeout(coldStartTimer);
        clearTimeout(timeoutId);
      };
    }
  }, [token]);

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
