import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchWithToken } from '../services/api';

interface AssessmentType {
  id: number;
  name: string;
  description: string;
  active: number;
}

export default function AssessmentTypes() {
  const [types, setTypes] = useState<AssessmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssessmentType | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const { t } = useTranslation();

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await fetchWithToken('/api/admin/assessment-types/');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTypes(data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await fetchWithToken(`/api/admin/assessment-types/${editingType.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(formData),
        });
      } else {
        await fetchWithToken('/api/admin/assessment-types/', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      setEditingType(null);
      setFormData({ name: '', description: '' });
      fetchTypes();
    } catch (error) {
      console.error('Failed to save', error);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (confirm(t('Tem certeza que deseja desativar este tipo?'))) {
      try {
        await fetchWithToken(`/api/admin/assessment-types/${id}/deactivate/`, { method: 'POST' });
        fetchTypes();
      } catch (error) {
        console.error('Failed to deactivate', error);
      }
    }
  };

  const openModal = (type?: AssessmentType) => {
    if (type) {
      setEditingType(type);
      setFormData({ name: type.name, description: type.description || '' });
    } else {
      setEditingType(null);
      setFormData({ name: '', description: '' });
    }
    setIsModalOpen(true);
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: t('Nome'), accessor: 'name' as const },
    { header: t('Descrição'), accessor: 'description' as const },
    { 
      header: t('Status'), 
      accessor: (row: AssessmentType) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
          {row.active ? t('Ativo') : t('Inativo')}
        </span>
      )
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('Tipos de Avaliação')}</h1>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('Novo Tipo')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">{t('Carregando...')}</div>
      ) : (
        <Table
          data={types}
          columns={columns}
          actions={(row) => (
            <div className="flex justify-end space-x-2">
              <button onClick={() => openModal(row)} className="text-indigo-600 hover:text-indigo-900">
                <Edit2 className="h-4 w-4" />
              </button>
              {row.active === 1 && (
                <button onClick={() => handleDeactivate(row.id)} className="text-red-600 hover:text-red-900">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold mb-4">{editingType ? t('Editar Tipo') : t('Novo Tipo')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('Nome')}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('Descrição')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
                    rows={3}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('Cancelar')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {t('Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
