import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth()
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function AppRoutes() {
    const { isAuthenticated } = useAuth()

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
                        <div className="p-8">
                            <h1 className="text-2xl font-bold">Chat (Coming Soon)</h1>
                        </div>
                    </ProtectedRoute>
                }
            />
            <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App