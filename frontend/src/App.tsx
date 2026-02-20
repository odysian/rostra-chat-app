import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatLayout from "./components/ChatLayout";
import AuthLoadingOverlay from "./components/AuthLoadingOverlay";
import ErrorBoundary from "./components/ErrorBoundary";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  const { isAuthenticated, isAuthenticating, authError } = useAuth();
  const debugOverlayMode =
    import.meta.env.DEV
      ? new URLSearchParams(window.location.search).get("debugAuthOverlay")
      : null;
  const forceColdStartOverlay = debugOverlayMode === "coldstart";

  if (forceColdStartOverlay) {
    return <AuthLoadingOverlay forceColdStart />;
  }

  // Show overlay while verifying token, or when server is unreachable (retry UI)
  if (isAuthenticating || authError) {
    return <AuthLoadingOverlay />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/chat" /> : <Login />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/chat" /> : <Register />}
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <WebSocketProvider>
              <ChatLayout />
            </WebSocketProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/chat" /> : <LandingPage />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
