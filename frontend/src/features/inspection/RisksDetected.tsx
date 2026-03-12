import React, { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import { canValidate } from '@/services/risk/riskService';
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
function RiskCard({
  risk,
  isExpanded,
  onToggle,
}: {
  risk: RiskItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50/50 transition-colors">
      <div className="flex gap-4">
        {/* Checkbox para seleção */}
        <div className="mt-1">
          <div className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-teal-500 cursor-pointer transition-colors" />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">
              {risk.description}
            </h3>
            <StatusBadge status={risk.risk_status} />
          </div>

          {/* Localização */}
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{risk.location || 'Unknown location'}</span>
          </div>

          {/* Severidade e Confiança */}
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={risk.severity} />
            {risk.ai_confidence && (
              <span className="text-xs text-gray-500">
                AI Confidence: {risk.ai_confidence}
              </span>
            )}
          </div>

          {/* Evidência e Recomendações */}
          <div className="mt-3 flex gap-3">
            {risk.evidence && (
              <EvidenceThumbnail
                url={risk.evidence.thumbnail_url}
                alt={`Evidence for ${risk.description}`}
                onClick={() => window.open(risk.evidence?.thumbnail_url || '', '_blank')}
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
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <Loader2 className="w-12 h-12 animate-spin text-teal-600 mb-4" />
      <p className="text-gray-600 text-center">{message}</p>
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
  };

  const labels: Record<AssessmentStatus, string> = {
    draft: 'Draft',
    captured: 'Captured',
    synced: 'Synced',
    ai_reviewed: 'AI Reviewed',
    human_validated: 'Validated',
    finalized: 'Finalized',
    error: 'Error',
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
  
  // Obter assessmentId da URL ou do state de navegação
  const assessmentId = location.state?.assessmentId || 
                       location.pathname.split('/').pop() ||
                       '1'; // fallback para desenvolvimento
  
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      <header className="flex items-center justify-between p-4 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/home')}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              Risks Detected
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-gray-500">
                {assessment?.title || 'Assessment'} • {filteredRisks.length} risks
              </p>
              {assessment && <LifecycleStatusBadge status={assessment.status} />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <main className="flex-1 p-4 overflow-y-auto pb-32">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm tracking-widest uppercase">
              <AlertTriangle className="w-4 h-4" /> Total Risks
            </div>
            <span className="text-5xl font-black text-gray-900">
              {String(totalRisks).padStart(2, '0')}
            </span>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-teal-600 font-bold text-sm tracking-widest uppercase">
              <ShieldCheck className="w-4 h-4" /> Compliance
            </div>
            <span className="text-5xl font-black text-gray-900">{complianceScore}%</span>
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

          <div className="divide-y divide-gray-100">
            {filteredRisks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No risks match the current filters.
              </div>
            ) : (
              filteredRisks.map((risk) => (
                <RiskCard
                  key={risk.id}
                  risk={risk}
                  isExpanded={expandedRisks.has(risk.id)}
                  onToggle={() => toggleRiskExpanded(risk.id)}
                />
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

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex gap-4 z-20">
        <Button
          variant="ghost"
          className="flex-1 h-14 text-lg text-red-500 hover:bg-red-50 font-bold"
          onClick={() => navigate('/inspection/validation')}
        >
          <XCircle className="w-6 h-6 mr-2" /> Reject
        </Button>
        
        {canValidateAssessment ? (
          <Button
            onClick={() => validateAssessment()}
            disabled={isValidating}
            className="flex-1 h-14 text-lg bg-teal-600 text-white hover:bg-teal-700 font-bold border-none"
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
            onClick={() => navigate('/inspection/validation')}
            className="flex-1 h-14 text-lg bg-gray-100 text-gray-400 hover:bg-gray-200 font-bold border-none"
          >
            Confirm <Send className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
