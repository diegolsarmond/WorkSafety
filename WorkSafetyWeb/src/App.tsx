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
import { useTranslation } from 'react-i18next';

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
import { getCurrentUser, clearTokens, isAuthenticated as hasAuthSession } from './services/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Hook para verificar autenticação
function useAuth() {
  const user = getCurrentUser();
  const isAuthenticated = hasAuthSession();
  
  const logout = () => {
    clearTokens();
    const basePath = import.meta.env.MODE === 'production' ? '/worksafety/admin/login' : '/login';
    window.location.href = basePath;
  };
  
  return { user, isAuthenticated, logout };
}

const Dashboard = () => {
  const { t } = useTranslation();
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('Dashboard')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">{t('Avaliações Pendentes')}</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">12</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">{t('Relatórios Gerados')}</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">48</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500">{t('Usuários Ativos')}</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">5</p>
        </div>
      </div>
    </div>
  );
};

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Fila de Processamento', href: '/queue', icon: ListTodo },
  { name: 'Relatórios', href: '/reports', icon: FileText },
  { name: 'Logs/Auditoria', href: '/audit', icon: Activity },
  { name: 'Usuários', href: '/users', icon: Users },
  { name: 'Tipos de Avaliação', href: '/assessment-types', icon: Settings },
  { name: 'Tipos de Ambiente', href: '/environment-types', icon: MapPin },
  { name: 'Tipos de Risco', href: '/risk-types', icon: ShieldAlert },
  { name: 'Configuração IA', href: '/ai-config', icon: BrainCircuit },
];

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem('appLanguage', lang);
  };

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
              {t(item.name)}
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
              {user?.name || user?.email || t('Usuário')}
            </p>
            <p className="text-xs text-slate-500 capitalize truncate">
              {user?.role === 'admin' ? t('Administrador') : t('Inspetor')}
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="language-select" className="sr-only">{t('Idioma')}</label>
          <select
            id="language-select"
            value={i18n.language}
            onChange={handleLanguageChange}
            className="mt-1 block w-full rounded-md border-slate-300 py-1 pl-3 pr-10 text-xs focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 shadow-sm border bg-white text-slate-700"
          >
            <option value="pt">{t('Português')}</option>
            <option value="en">{t('Inglês')}</option>
          </select>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4" />
          {t('Sair')}
        </button>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 bg-slate-50">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  // Use /worksafety/admin basename in production, / in development
  const basename = import.meta.env.MODE === 'production' ? '/worksafety/admin' : '/';
  
  return (
    <Router basename={basename}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/queue"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProcessingQueue />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Reports />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AuditLogs />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayout>
                <UsersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assessment-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <AssessmentTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/environment-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EnvironmentTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/risk-types"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RiskTypes />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-config"
          element={
            <ProtectedRoute requireAdmin>
              <AppLayout>
                <AIConfiguration />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
