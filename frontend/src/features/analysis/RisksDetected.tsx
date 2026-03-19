import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Share2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  MapPin,
  XCircle,
  CheckCircle2,
  Send,
  Loader2,
  RefreshCw,
  ImageOff,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import { canValidate } from '@/services/risk/riskService';
import { useAnalysisStore } from '@/store/analysisStore';
import type { RiskItem, AssessmentStatus } from '@/types/risk';

// =============================================================================
// Componentes Auxiliares
// =============================================================================

/** Badge de severidade do risco */
function SeverityBadge({ severity }: { severity: string }) {
  const styles = {
    CRITICAL: 'bg-red-50 text-red-600 border-red-200',
    HIGH: 'bg-orange-50 text-orange-600 border-orange-200',
    MEDIUM: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    LOW: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider border ${
        styles[severity as keyof typeof styles] || styles.LOW
      }`}
    >
      {severity}
    </span>
  );
}

/** Badge de status do risco */
function StatusBadge({ status }: { status: string }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-600',
    ai_detected: 'bg-blue-50 text-blue-600',
    validated: 'bg-green-50 text-green-600',
    rejected: 'bg-red-50 text-red-600',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    pending: 'Pending',
    ai_detected: 'AI Detected',
    validated: 'Validated',
    rejected: 'Rejected',
    error: 'Error',
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        styles[status as keyof typeof styles] || styles.pending
      }`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

/** Miniatura da evidência */
function EvidenceThumbnail({
  url,
  alt,
  onClick,
}: {
  url: string | null;
  alt: string;
  onClick?: () => void;
}) {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 hover:border-teal-500 transition-colors"
    >
      <img
        src={url}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
        loading="lazy"
      />
    </button>
  );
}

/** Card de risco individual */
interface RiskCardProps {
  risk: RiskItem;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onPreviewEvidence: (url: string, alt: string) => void;
}

function RiskCard({
  risk,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  onPreviewEvidence,
}: RiskCardProps) {
  return (
    <div className="p-4 hover:bg-gray-50/50 transition-colors">
      <div className="flex gap-4">
        {/* Checkbox para seleção */}
        <div className="mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
              isSelected
                ? 'bg-teal-500 border-teal-500 text-white'
                : 'border-gray-300 hover:border-teal-500 cursor-pointer'
            }`}
          >
            {isSelected && <CheckCircle2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-lg mb-1 break-words">
              {risk.reason || risk.description}
            </h3>
            <StatusBadge status={risk.risk_status} />
          </div>

          {risk.rule_id && (
            <div className="mb-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                {risk.rule_id}
              </span>
            </div>
          )}

          {/* Localização */}
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {risk.bounding_box && risk.bounding_box.length === 4
                ? `bbox: [${risk.bounding_box.join(', ')}]`
                : risk.location || 'No bounding box'}
            </span>
          </div>

          {/* Severidade e Confiança */}
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={risk.severity} />
            {risk.ai_confidence && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
                <span className="text-xs font-medium text-teal-700">
                  {risk.ai_confidence}
                </span>
                <span className="text-xs text-teal-500">confidence</span>
              </div>
            )}
          </div>

          {/* Evidência e Recomendações */}
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            {risk.evidence && (
              <EvidenceThumbnail
                url={risk.evidence.thumbnail_url}
                alt={`Evidence for ${risk.description}`}
                onClick={() => {
                  if (risk.evidence?.thumbnail_url) {
                    onPreviewEvidence(
                      risk.evidence.thumbnail_url,
                      `Evidence for ${risk.description}`
                    );
                  }
                }}
              />
            )}

            <div className="flex-1 min-w-0">
              {risk.recommendations.length > 0 && (
                <div className="space-y-1">
                  {risk.recommendations.slice(0, isExpanded ? undefined : 1).map((rec) => (
                    <div
                      key={rec.id}
                      className={`text-sm p-2 rounded-lg ${
                        rec.priority === 'critical'
                          ? 'bg-red-50 text-red-700'
                          : rec.priority === 'high'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <span className="font-medium">{rec.title}:</span>{' '}
                      {rec.description}
                    </div>
                  ))}
                </div>
              )}

              {risk.recommendations.length > 1 && (
                <button
                  onClick={onToggle}
                  className="mt-2 text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  {isExpanded ? (
                    <>
                      Show less <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Show {risk.recommendations.length - 1} more{' '}
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado de Loading */
function LoadingState({ message }: { message: string }) {
  const isProcessingAI = message.includes('AI');
  
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {isProcessingAI ? (
        <>
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">AI Analysis in Progress</h3>
          <p className="text-gray-600 text-center max-w-sm">{message}</p>
          <p className="text-sm text-gray-400 mt-4">This may take a few moments...</p>
        </>
      ) : (
        <>
          <Loader2 className="w-12 h-12 animate-spin text-teal-600 mb-4" />
          <p className="text-gray-600 text-center">{message}</p>
        </>
      )}
    </div>
  );
}

/** Estado de Erro */
function ErrorState({
  message,
  canRetry,
  onRetry,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Error loading assessment</h3>
      <p className="text-gray-600 text-center mb-6 max-w-sm">{message}</p>
      {canRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      )}
    </div>
  );
}

/** Estado Vazio */
function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <ShieldCheck className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">No risks detected</h3>
      <p className="text-gray-600 text-center mb-6 max-w-sm">
        Great news! Our AI analysis didn't find any safety risks in this assessment.
      </p>
      <Button onClick={onBack} variant="outline">
        Back to home
      </Button>
    </div>
  );
}

/** Status Badge do ciclo de vida */
function LifecycleStatusBadge({ status }: { status: AssessmentStatus }) {
  const styles: Record<AssessmentStatus, string> = {
    draft: 'bg-gray-100 text-gray-600',
    captured: 'bg-blue-50 text-blue-600',
    synced: 'bg-purple-50 text-purple-600',
    ai_reviewed: 'bg-teal-50 text-teal-600',
    human_validated: 'bg-green-50 text-green-600',
    finalized: 'bg-gray-800 text-white',
    error: 'bg-red-50 text-red-600',
    error_ai: 'bg-red-50 text-red-600',
  };

  const labels: Record<AssessmentStatus, string> = {
    draft: 'Draft',
    captured: 'Captured',
    synced: 'Synced',
    ai_reviewed: 'AI Reviewed',
    human_validated: 'Validated',
    finalized: 'Finalized',
    error: 'Error',
    error_ai: 'AI Error',
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${
        styles[status] || styles.draft
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

// =============================================================================
// Componente Principal
// =============================================================================

export function RisksDetected() {
  const navigate = useNavigate();
  const location = useLocation();
  const { assessmentId: storeAssessmentId } = useAnalysisStore();
  
  // Obter assessmentId da URL ou do state de navegação, com fallback para a store
  const assessmentId = location.state?.assessmentId || storeAssessmentId;
  
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [evidenceModal, setEvidenceModal] = useState<{ url: string; alt: string } | null>(null);
  
  const {
    screenState,
    assessment,
    filteredRisks,
    riskCounts,
    filters,
    setFilters,
    refresh,
    validateAssessment,
    isValidating,
    validationError,
  } = useRiskAssessment(assessmentId, {
    autoFetch: true,
    refreshInterval: 30000, // Refresh a cada 30s para atualizações da IA
  });

  // Debug logs
  useEffect(() => {
    console.log('[RisksDetected] State:', {
      assessmentId,
      screenState,
      risksCount: assessment?.risks.length,
      filteredRisksCount: filteredRisks.length,
      assessmentStatus: assessment?.status,
    });
  }, [screenState, assessment, filteredRisks, assessmentId]);
  
  const toggleRiskExpanded = (riskId: string) => {
    setExpandedRisks((prev) => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };
  
  const toggleRiskSelected = (riskId: string) => {
    setSelectedRisks((prev) => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };
  
  const selectedCount = selectedRisks.size;
  const allSelected = filteredRisks.length > 0 && selectedRisks.size === filteredRisks.length;
  
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRisks(new Set());
    } else {
      setSelectedRisks(new Set(filteredRisks.map((r) => r.id)));
    }
  };
  
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setFilters({ ...filters, search: term });
  };
  
  const handleSeverityFilter = (severity: string) => {
    const currentSeverities = filters.severity || [];
    const newSeverities = currentSeverities.includes(severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW')
      ? currentSeverities.filter((s) => s !== severity)
      : [...currentSeverities, severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'];
    setFilters({ ...filters, severity: newSeverities });
  };
  
  const totalRisks = assessment?.risks.length || 0;
  const complianceScore = assessment?.compliance_score || 100;
  const canValidateAssessment = assessment ? canValidate(assessment.status) : false;

  useEffect(() => {
    if (!evidenceModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEvidenceModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [evidenceModal]);
  
  // Se não tem assessmentId válido, mostra erro
  if (!assessmentId || assessmentId === 'risks') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center p-4 bg-white shadow-sm">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 ml-4">Risks Detected</h1>
        </header>
        <ErrorState
          message="No assessment selected. Please start a new analysis."
          canRetry={false}
          onRetry={() => navigate('/analysis/new')}
        />
      </div>
    );
  }
  
  // Renderizar estado específico
  if (screenState.type === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center p-4 bg-white shadow-sm">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 ml-4">Risks Detected</h1>
        </header>
        <LoadingState message={screenState.message} />
      </div>
    );
  }
  
  if (screenState.type === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center p-4 bg-white shadow-sm">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 ml-4">Risks Detected</h1>
        </header>
        <ErrorState
          message={screenState.message}
          canRetry={screenState.canRetry}
          onRetry={refresh}
        />
      </div>
    );
  }
  
  if (screenState.type === 'empty') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="flex items-center p-4 bg-white shadow-sm">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 ml-4">Risks Detected</h1>
        </header>
        <EmptyState onBack={() => navigate('/home')} />
      </div>
    );
  }
  
  // Estado com dados
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-start sm:items-center justify-between gap-3 p-4 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-start min-w-0">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="ml-4 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight break-words">
              Risks Detected
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-sm text-gray-500 break-words">
                {assessment?.title || 'Assessment'} • {filteredRisks.length} risks
              </p>
              {assessment && <LifecycleStatusBadge status={assessment.status} />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-full transition-colors ${
              showFilters ? 'bg-teal-100 text-teal-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Download className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search risks..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          
          {/* Severity filters */}
          <div className="flex gap-2 flex-wrap">
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => handleSeverityFilter(sev)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  filters.severity?.includes(sev)
                    ? 'bg-teal-50 border-teal-300 text-teal-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {sev} ({riskCounts[sev] || 0})
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-36 sm:pb-40 max-w-3xl lg:max-w-4xl mx-auto w-full">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-red-500 font-bold text-xs sm:text-sm tracking-widest uppercase text-center">
              <AlertTriangle className="w-4 h-4" /> Total Risks
            </div>
            <span className="text-4xl sm:text-5xl font-black text-gray-900">
              {String(totalRisks).padStart(2, '0')}
            </span>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-teal-600 font-bold text-xs sm:text-sm tracking-widest uppercase text-center">
              <ShieldCheck className="w-4 h-4" /> Compliance
            </div>
            <span className="text-4xl sm:text-5xl font-black text-gray-900">{complianceScore}%</span>
          </div>
        </div>

        {/* Risk List */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <FileText className="w-5 h-5 text-teal-600" /> Action Checklist
            </div>
            <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).toUpperCase()}
            </span>
          </div>

          {/* Select All Header */}
          {filteredRisks.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : selectedCount > 0
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-300'
                }`}>
                  {allSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {selectedCount > 0 && !allSelected && (
                    <div className="w-2 h-2 bg-teal-500 rounded-sm" />
                  )}
                </div>
                <span>
                  {selectedCount === 0
                    ? 'Select all'
                    : `${selectedCount} selected`}
                </span>
              </button>
              
              {selectedCount > 0 && (
                <button
                  onClick={() => setSelectedRisks(new Set())}
                  className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {filteredRisks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No risks match the current filters.
              </div>
            ) : (
              filteredRisks.map((risk) => (
                <div key={risk.id}>
                  <RiskCard
                    risk={risk}
                    isExpanded={expandedRisks.has(risk.id)}
                    onToggle={() => toggleRiskExpanded(risk.id)}
                    isSelected={selectedRisks.has(risk.id)}
                    onSelect={() => toggleRiskSelected(risk.id)}
                    onPreviewEvidence={(url, alt) => setEvidenceModal({ url, alt })}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{validationError}</p>
          </div>
        )}
      </main>

      {evidenceModal && (
        <div
          className="fixed inset-0 z-30 bg-black/70 p-4 sm:p-8 flex items-center justify-center"
          onClick={() => setEvidenceModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Evidence image preview"
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEvidenceModal(null)}
              className="absolute -top-12 right-0 sm:top-3 sm:right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-gray-800 flex items-center justify-center"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={evidenceModal.url}
              alt={evidenceModal.alt}
              className="w-full max-h-[80vh] object-contain rounded-xl bg-black"
            />
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:gap-4 z-20" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-3xl lg:max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="flex-1 h-12 sm:h-14 text-base sm:text-lg text-red-500 hover:bg-red-50 font-bold"
          onClick={() => navigate('/analysis/validation')}
        >
          <XCircle className="w-6 h-6 mr-2" /> Reject
        </Button>
        
        {canValidateAssessment ? (
          <Button
            onClick={() => validateAssessment()}
            disabled={isValidating}
            className="flex-1 h-12 sm:h-14 text-base sm:text-lg bg-teal-600 text-white hover:bg-teal-700 font-bold border-none"
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Validating...
              </>
            ) : (
              <>
                Validate <CheckCircle2 className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => navigate('/analysis/validation')}
            className="flex-1 h-12 sm:h-14 text-base sm:text-lg bg-gray-100 text-gray-400 hover:bg-gray-200 font-bold border-none"
          >
            Confirm <Send className="w-5 h-5 ml-2" />
          </Button>
        )}
        </div>
      </div>
    </div>
  );
}
