import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  FileText, 
  Activity, 
  ShieldAlert, 
  MapPin, 
  BrainCircuit, 
  ListTodo,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import AssessmentTypes from './pages/AssessmentTypes';
import EnvironmentTypes from './pages/EnvironmentTypes';
import RiskTypes from './pages/RiskTypes';
import AIConfiguration from './pages/AIConfiguration';
import ProcessingQueue from './pages/ProcessingQueue';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import UsersPage from './pages/Users';
import Login from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getCurrentUser, clearTokens } from './services/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Hook para verificar autenticação
function useAuth() {
  const user = getCurrentUser();
  const isAuthenticated = !!localStorage.getItem('access_token');
  
  const logout = () => {
    clearTokens();
    window.location.href = '/admin/login';
  };
  
  return { user, isAuthenticated, logout };
}

const Dashboard = () => (
  <div className="p-8 max-w-6xl mx-auto">
    <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">Avaliações Pendentes</h3>
        <p className="text-3xl font-bold text-slate-900 mt-2">12</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">Relatórios Gerados</h3>
        <p className="text-3xl font-bold text-slate-900 mt-2">48</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-sm font-medium text-slate-500">Usuários Ativos</h3>
        <p className="text-3xl font-bold text-slate-900 mt-2">5</p>
      </div>
    </div>
  </div>
);

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Fila de Processamento', href: '/admin/queue', icon: ListTodo },
  { name: 'Relatórios', href: '/admin/reports', icon: FileText },
  { name: 'Logs/Auditoria', href: '/admin/audit', icon: Activity },
  { name: 'Usuários', href: '/admin/users', icon: Users },
  { name: 'Tipos de Avaliação', href: '/admin/assessment-types', icon: Settings },
  { name: 'Tipos de Ambiente', href: '/admin/environment-types', icon: MapPin },
  { name: 'Tipos de Risco', href: '/admin/risk-types', icon: ShieldAlert },
  { name: 'Configuração IA', href: '/admin/ai-config', icon: BrainCircuit },
];

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center px-6 border-b border-slate-200">
        <ShieldAlert className="h-6 w-6 text-emerald-600 mr-2" />
        <span className="text-lg font-bold text-slate-900">WorkSafety Admin</span>
      </div>
      
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
              )}
            >
              <item.icon
                className={cn(
                  isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-500',
                  'mr-3 h-5 w-5 flex-shrink-0'
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center mb-3">
          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.name || user?.email || 'Usuário'}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">
              {user?.role === 'admin' ? 'Administrador' : 'Inspetor'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/admin/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/queue"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProcessingQueue />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Reports />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AuditLogs />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayout>
                <UsersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/assessment-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AssessmentTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/environment-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EnvironmentTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/risk-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RiskTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/ai-config"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayout>
                <AIConfiguration />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
