import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  FileText, 
  Activity, 
  ShieldAlert, 
  MapPin, 
  BrainCircuit, 
  ListTodo 
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
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
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/queue" element={<ProcessingQueue />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit" element={<AuditLogs />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/assessment-types" element={<AssessmentTypes />} />
            <Route path="/environment-types" element={<EnvironmentTypes />} />
            <Route path="/risk-types" element={<RiskTypes />} />
            <Route path="/ai-config" element={<AIConfiguration />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
