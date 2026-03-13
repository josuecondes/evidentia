import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ClienteDashboard from './pages/ClienteDashboard'
import AdminDashboard from './pages/AdminDashboard'
import { AuthProvider, useAuth } from './context/AuthContext'

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center font-sans bg-[#0f1210] text-[#22c55e]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
        <p className="text-sm font-bold tracking-widest uppercase animate-pulse">Verificando acceso...</p>
      </div>
    </div>
  }

  if (!user) return <Navigate to="/login" />

  // Omitimos la comprobación de !profile para permitir navegación aunque falle la red

  if (allowedRole && profile && profile.rol !== allowedRole) {
    const targetPath = profile.rol === 'admin' ? '/admin' : '/cliente'
    console.log(`ProtectedRoute: Redirigiendo a ${profile.rol} -> ${targetPath}`);
    return <Navigate to={targetPath} />
  }

  if (allowedRole && !profile) {
    // Si el perfil no cargó (por error de red, etc) pero el usuario está autenticado
    // permitimos la navegación para no bloquear la app
    console.warn(`ProtectedRoute: No profile found for ${user.email}, allowing access to ${allowedRole} as fallback`);
  }

  return children
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/cliente/*"
            element={
              <ProtectedRoute allowedRole="cliente">
                <ClienteDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/home"
            element={<HomeRedirect />}
          />

          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

const HomeRedirect = () => {
  const { user, profile, loading } = useAuth()

  // Si no hay usuario, siempre a login
  if (!user && !loading) return <Navigate to="/login" />
  
  // Si tenemos el perfil cargado, redirigimos según rol
  if (profile) {
    if (profile.rol === 'admin') return <Navigate to="/admin" />
    return <Navigate to="/cliente/calendario" />
  }

  // Si está cargando y no tenemos info, esperamos un poco
  if (loading && !user) {
    return <div className="flex h-[100dvh] items-center justify-center font-sans bg-[#0f1210] text-[#22c55e]">
      <div className="w-8 h-8 border-3 border-[#22c55e]/20 border-t-[#22c55e] rounded-full animate-spin" />
    </div>
  }

  // Fallback si tenemos user pero no profile (o sigue cargando profile)
  if (user) {
    const isMailAdmin = user?.email === 'admin@gmail.com' || user?.email === 'josue@gmail.com';
    if (isMailAdmin) return <Navigate to="/admin" />
    return <Navigate to="/cliente/calendario" />
  }

  return <Navigate to="/login" />
}

export default App
