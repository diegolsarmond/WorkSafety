import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Plus, Edit2, Trash2, RefreshCw, AlertCircle, Power, PowerOff } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';
import { User, CreateUserData } from '../services/api';

interface UserFormData {
  email: string;
  password: string;
  is_staff: boolean;
}

export default function Users() {
  const { 
    users, 
    isLoading, 
    error, 
    fetchUsers, 
    createUser, 
    deactivateUser, 
    activateUser,
    clearError 
  } = useUsers();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ 
    email: '', 
    password: '', 
    is_staff: false 
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    try {
      if (editingUser) {
        // Atualização não implementada no backend (apenas ativar/desativar)
        setFormError('Edição direta não suportada. Use ativar/desativar.');
        return;
      } else {
        // Validação
        if (!formData.email || !formData.password) {
          setFormError('Email e senha são obrigatórios');
          return;
        }
        if (formData.password.length < 8) {
          setFormError('A senha deve ter pelo menos 8 caracteres');
          return;
        }
        
        const data: CreateUserData = {
          email: formData.email,
          password: formData.password,
          is_staff: formData.is_staff,
          is_active: true,
        };
        
        await createUser(data);
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      // Erro já está no hook, mas podemos mostrar no formulário também
      setFormError(error || 'Erro ao salvar usuário');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (actionLoading === user.id) return;
    
    const action = user.is_active ? 'desativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) {
      return;
    }

    setActionLoading(user.id);
    try {
      if (user.is_active) {
        await deactivateUser(user.id);
      } else {
        await activateUser(user.id);
      }
    } catch {
      // Erro já tratado no hook
    } finally {
      setActionLoading(null);
    }
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ 
        email: user.email, 
        password: '', 
        is_staff: user.is_staff 
      });
    } else {
      setEditingUser(null);
      resetForm();
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ email: '', password: '', is_staff: false });
    setEditingUser(null);
    setFormError(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  // Mapeia role para exibição amigável
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      inspector: 'Inspetor',
      user: 'Usuário',
      manager: 'Gerente',
    };
    return labels[role] || role;
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: 'Nome', accessor: (row: User) => row.name || '-' },
    { header: 'E-mail', accessor: 'email' as const },
    { 
      header: 'Papel', 
      accessor: (row: User) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.role === 'admin' || row.is_staff 
            ? 'bg-purple-100 text-purple-800' 
            : 'bg-blue-100 text-blue-800'
        }`}>
          {getRoleLabel(row.role)}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: (row: User) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.is_active 
            ? 'bg-emerald-100 text-emerald-800' 
            : 'bg-slate-100 text-slate-800'
        }`}>
          {row.is_active ? 'Ativo' : 'Inativo'}
        </span>
      )
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os usuários do sistema
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button 
            onClick={clearError}
            className="text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && users.length === 0 ? (
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
          </div>
          <p className="text-slate-500">Carregando usuários...</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Total de Usuários</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Usuários Ativos</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {users.filter(u => u.is_active).length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Administradores</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {users.filter(u => u.is_staff).length}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <Table
              data={users}
              columns={columns}
              actions={(row) => (
                <div className="flex justify-end space-x-2">
                  <button 
                    onClick={() => handleToggleStatus(row)} 
                    disabled={actionLoading === row.id}
                    className={`p-2 rounded-md transition-colors ${
                      row.is_active 
                        ? 'text-red-600 hover:bg-red-50 hover:text-red-700' 
                        : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                    } disabled:opacity-50`}
                    title={row.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                  >
                    {actionLoading === row.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : row.is_active ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            />
            
            {users.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <UsersIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">
                  Nenhum usuário encontrado
                </h3>
                <p className="text-sm text-slate-500">
                  Comece criando um novo usuário
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Senha <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-500 font-normal ml-1">
                      (mínimo 8 caracteres)
                    </span>
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_staff"
                    checked={formData.is_staff}
                    onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                  />
                  <label htmlFor="is_staff" className="ml-2 block text-sm text-slate-700">
                    Administrador (acesso total ao sistema)
                  </label>
                </div>

                <div className="bg-slate-50 rounded-md p-3 text-xs text-slate-600">
                  <p className="font-medium mb-1">Notas:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>O nome será gerado automaticamente a partir do email</li>
                    <li>O usuário receberá o papel &quot;Inspetor&quot; por padrão</li>
                    <li>Para editar, use ativar/desativar na lista</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon component for empty state
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
      />
    </svg>
  );
}
