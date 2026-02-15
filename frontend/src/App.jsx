import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ChatList from './pages/ChatList'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Stories from './pages/Stories'
import Admin from './pages/Admin'
import { useAuth } from './contexts/AuthContext'

function RequireToken({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function ProtectedRoute({ children }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }) {
  const { token } = useAuth()
  const loc = useLocation()
  const addParam = new URLSearchParams(loc.search).get('add') === '1'
  const isAddAccount = (loc.pathname === '/login' || loc.pathname === '/register') && addParam
  if (token && !isAddAccount) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/verify-email" element={<RequireToken><VerifyEmail /></RequireToken>} />
        <Route path="/" element={<Layout />}>
          <Route index element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
          <Route path="chat/:chatId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="stories" element={<ProtectedRoute><Stories /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
