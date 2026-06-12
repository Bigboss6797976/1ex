import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import {
  FiHome, FiGrid, FiUser, FiDollarSign,
  FiShield, FiSettings, FiList
} from 'react-icons/fi';

/* ─ lazy pages ─ */
const Deposit      = lazy(() => import('./Deposit'));
const Profile      = lazy(() => import('./pages/Profile'));
const KYC          = lazy(() => import('./pages/KYC'));
const Games        = lazy(() => import('./pages/Games'));

/* ─ protected route ─ */
function Protected({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

/* ─ bottom nav ─ */
function BottomNav() {
  const { pathname } = useLocation();
  const links = [
    { to:'/',        icon: FiHome,      label:'Home'    },
    { to:'/games',   icon: FiGrid,      label:'Games'   },
    { to:'/deposit', icon: FiDollarSign,label:'Deposit' },
    { to:'/profile', icon: FiUser,      label:'Profile' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700
      flex justify-around z-40 pb-safe">
      {links.map(l => (
        <Link key={l.to} to={l.to}
          className={`flex flex-col items-center py-3 px-4 transition ${
            pathname === l.to ? 'text-yellow-400' : 'text-gray-500 hover:text-white'
          }`}>
          <l.icon size={22} />
          <span className="text-xs mt-1 font-bold">{l.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/* ─ app shell ─ */
export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{
        style: { background:'#1f2937', color:'#fff', borderRadius:'12px' },
        success: { iconTheme: { primary:'#f59e0b', secondary:'#000' } },
      }} />

      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400" />
        </div>
      }>
        <Routes>
          <Route path="/"        element={<Games />} />
          <Route path="/games"   element={<Games />} />
          <Route path="/deposit" element={<Protected><Deposit /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/kyc"     element={<Protected><KYC /></Protected>} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      <BottomNav />
    </BrowserRouter>
  );
}
