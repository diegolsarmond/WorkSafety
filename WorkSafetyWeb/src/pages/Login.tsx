import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();
  const { t } = useTranslation();

  // Redireciona se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      await login({ email, password });
      // Redireciona para home após login bem-sucedido
      navigate('/admin/dashboard', { replace: true });
    } catch {
      // Erro já está tratado no hook
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <ShieldAlert className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t('WorkSafety Admin')}</h1>
          <p className="text-slate-500 mt-1">
            {t('Sistema de Gestão de Segurança do Trabalho')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {t('Acesse sua conta')}
          </h2>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 flex items-start">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-slate-700"
              >
                {t('E-mail')}
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                placeholder="admin@worksafety.gov"
                disabled={isLoading}
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-slate-700"
              >
                {t('Senha')}
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  {t('Entrando...')}
                </>
              ) : (
                t('Entrar')
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a 
              href="#" 
              className="text-sm text-emerald-600 hover:text-emerald-500"
              onClick={(e) => {
                e.preventDefault();
                alert(t('Funcionalidade em desenvolvimento'));
              }}
            >
              {t('Esqueceu a senha?')}
            </a>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            {t('Credenciais de demonstração:')}<br />
            <span className="font-mono">admin@worksafety.gov / admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
