import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import { humanValidateAssessment } from '@/services/risk/riskService';

interface RiskDecision {
  riskId: string;
  decision: 'approved' | 'rejected' | null;
}

/**
 * Página de detalhe de inspeção
 * Exibe a imagem e resultados da análise de IA para uma inspeção específica
 */
export function InspectionDetailPage() {
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [riskDecisions, setRiskDecisions] = useState<Map<string, RiskDecision['decision']>>(new Map());
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    screenState,
    assessment,
    filteredRisks,
  } = useRiskAssessment(assessmentId, {
    autoFetch: true,
    refreshInterval: 5000, // Poll every 5 seconds during loading, with 5-min timeout
  });

  const handleRiskDecision = (riskId: string, decision: 'approved' | 'rejected') => {
    setRiskDecisions(prev => new Map(prev).set(riskId, decision));
  };

  const handleFinishValidation = async () => {
    if (!assessmentId) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      await humanValidateAssessment(assessmentId);
      navigate('/home');
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Failed to validate assessment'
      );
      setIsValidating(false);
    }
  };

  const currentEvidence = assessment ? assessment.evidences[currentImageIndex] : null;

  // Loading state
  if (screenState.type === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#0b6b82] animate-spin mb-4" />
        <p className="text-gray-600 font-medium">{screenState.message}</p>
      </div>
    );
  }

  // Error state
  if (screenState.type === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-900 font-semibold mb-6 text-center">{screenState.message}</p>
        <Button onClick={() => navigate('/home')} className="bg-[#0b6b82] text-white">
          Back to Home
        </Button>
      </div>
    );
  }

  // No assessment data
  if (!assessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-600 mb-6">No assessment data available</p>
        <Button onClick={() => navigate('/home')} className="bg-[#0b6b82] text-white">
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-200">
        <button
          onClick={() => navigate('/home')}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold text-gray-900">
            #{assessment.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-xs text-gray-500 mt-1">DRAFT (AI)</p>
        </div>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28">
        {/* Image Section */}
        {assessment.evidences.length > 0 && (
          <div className="relative bg-black">
            <div className="aspect-video flex items-center justify-center bg-gray-900 relative">
              <img
                src={assessment.evidences[currentImageIndex].url}
                alt={`Evidence ${currentImageIndex + 1}`}
                className="w-full h-full object-contain"
              />

              {/* Navigation Arrows */}
              {assessment.evidences.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((prev) =>
                        prev === 0 ? assessment.evidences.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((prev) =>
                        prev === assessment.evidences.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}

              {/* Image Counter */}
              <div className="absolute bottom-4 right-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm font-semibold">
                {currentImageIndex + 1}/{assessment.evidences.length}
              </div>
            </div>

            {/* Date and Location Info */}
            <div className="bg-gray-900 px-4 py-3 flex items-center gap-4 text-white text-sm">
              <div>
                <p className="text-gray-400 text-xs">DATE</p>
                <p className="font-semibold">
                  {currentEvidence
                    ? new Date(currentEvidence.captured_at || assessment.created_at).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-400 text-xs">LOCATION</p>
                  <p className="font-semibold">North Sector</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        <div className="p-4 bg-white space-y-4">
          {/* AI Analysis Header */}
          <div>
            <h2 className="text-lg font-bold text-[#0b6b82] flex items-center gap-2 mb-4">
              <span className="text-xl">🤖</span> AI Analysis
            </h2>
          </div>

          {/* Risks/Findings */}
          {filteredRisks.length > 0 ? (
            <div className="space-y-3">
              {filteredRisks.map((risk, index) => {
                const decision = riskDecisions.get(risk.id);
                const severity = risk.severity;
                const severityColor = {
                  CRITICAL: 'text-red-600 bg-red-50 border-red-200',
                  HIGH: 'text-orange-600 bg-orange-50 border-orange-200',
                  MEDIUM: 'text-yellow-600 bg-yellow-50 border-yellow-200',
                  LOW: 'text-blue-600 bg-blue-50 border-blue-200',
                };

                return (
                  <div
                    key={risk.id}
                    className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
                  >
                    {/* Risk Title and Severity */}
                    <div className="flex items-start gap-3 mb-3">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${severityColor[severity as keyof typeof severityColor]}`} />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm leading-snug">
                          {risk.description}
                        </h3>
                        <p className={`text-xs font-bold mt-1 px-2 py-1 rounded-md inline-block ${severityColor[severity as keyof typeof severityColor]}`}>
                          Conf: {risk.ai_confidence}
                        </p>
                      </div>
                    </div>

                    {/* Confidence % Badge */}
                    <div className="mb-3 bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[13px] font-semibold text-gray-600">Confidence</span>
                        <span className="text-[13px] font-bold text-gray-900">{risk.ai_confidence}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0b6b82] to-[#1BC5BD]"
                          style={{
                            width: `${parseInt(risk.ai_confidence) || 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRiskDecision(risk.id, 'approved')}
                        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors ${
                          decision === 'approved'
                            ? 'bg-green-500 text-white'
                            : 'border-2 border-green-500 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleRiskDecision(risk.id, 'rejected')}
                        className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors ${
                          decision === 'rejected'
                            ? 'bg-red-500 text-white'
                            : 'border-2 border-red-500 text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 font-medium">No risks detected in the analysis</p>
            </div>
          )}

          {/* Suggested Norms */}
          {filteredRisks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 tracking-wider mb-3">
                SUGGESTED NORMS
              </h3>
              <ul className="space-y-2">
                {filteredRisks.flatMap((risk) =>
                  risk.recommendations.map((rec) => (
                    <li
                      key={`${risk.id}-${rec.id}`}
                      className="text-sm text-gray-600 leading-relaxed flex gap-2"
                    >
                      <span className="text-gray-400 mt-1">•</span>
                      <span>
                        <strong>{rec.title}</strong> - {rec.description}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      </main>

      {/* Footer with CTA */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        {validationError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{validationError}</p>
          </div>
        )}
        <button
          onClick={handleFinishValidation}
          disabled={isValidating}
          className="w-full bg-[#0b6b82] text-white font-semibold py-3 rounded-lg hover:bg-[#0a5a70] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isValidating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Finish Validation
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

export default InspectionDetailPage;
