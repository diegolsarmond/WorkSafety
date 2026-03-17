import React, { useEffect, useState } from 'react';
import { Table } from '../components/Table';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchWithToken } from '../services/api';

interface AIThreshold {
  id: number;
  threshold_value: string;
  threshold_type: string;
  threshold_type_display: string;
  description: string;
  updated_at: string;
  updated_by: number | null;
  updated_by_email: string | null;
}

export default function AIConfiguration() {
  const [thresholds, setThresholds] = useState<AIThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentThreshold, setCurrentThreshold] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  const fetchThresholds = async () => {
    setLoading(true);
    try {
      // Buscar threshold atual
      const res = await fetchWithToken('/api/admin/ai-thresholds/confidence/current/');
      const data = await res.json();
      setThresholds([data]);
      setCurrentThreshold(parseFloat(data.threshold_value));
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThresholds();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchWithToken('/api/admin/ai-thresholds/confidence/', {
        method: 'PUT',
        body: JSON.stringify({ threshold_value: currentThreshold }),
      });
      fetchThresholds();
      alert(t('Configuração salva com sucesso!'));
    } catch (error) {
      console.error('Failed to save', error);
      alert(t('Erro ao salvar configuração.'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { header: 'ID', accessor: 'id' as const },
    { header: t('Tipo'), accessor: 'threshold_type_display' as const },
    { header: t('Valor (%)'), accessor: 'threshold_value' as const },
    { 
      header: t('Data de Atualização'), 
      accessor: (row: AIThreshold) => new Date(row.updated_at).toLocaleString('pt-BR')
    },
    { header: t('Atualizado por'), accessor: 'updated_by_email' as const },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('Configuração da Inteligência Artificial')}</h1>

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-medium text-slate-900 mb-4">{t('Threshold de Confiança')}</h2>
        <p className="text-sm text-slate-500 mb-6">
          {t('Defina o limiar mínimo de confiança para que a IA classifique automaticamente um risco. Valores abaixo deste limiar serão marcados como "INCONCLUSIVO" e exigirão validação humana.')}
        </p>
        
        <div className="flex items-end space-x-4">
          <div className="w-64">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('Valor do Limiar (%)')}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={currentThreshold}
              onChange={(e) => setCurrentThreshold(Number(e.target.value))}
              className="block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm p-2 border"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? t('Salvando...') : t('Salvar Configuração')}
          </button>
        </div>
      </div>

      <h2 className="text-lg font-medium text-slate-900 mb-4">{t('Histórico de Alterações')}</h2>
      {loading ? (
        <div className="text-center py-10 text-slate-500">{t('Carregando...')}</div>
      ) : (
        <Table data={thresholds} columns={columns} />
      )}
    </div>
  );
}
