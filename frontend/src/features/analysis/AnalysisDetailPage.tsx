import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ThumbsUp,
  Search,
  X,
  Info,
} from 'lucide-react';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import type { RiskItem } from '@/types/risk';

interface RiskDecision {
  riskId: string;
  decision: 'approved' | 'rejected' | null;
}

export function AnalysisDetailPage() {
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [riskDecisions, setRiskDecisions] = useState<Map<string, RiskDecision['decision']>>(new Map());
  const [mitigationOpen, setMitigationOpen] = useState<Set<string>>(new Set());
  const [selectedMitigations, setSelectedMitigations] = useState<Map<string, Set<string>>>(new Map());
  const [customMitigations, setCustomMitigations] = useState<Map<string, string>>(new Map());
  const [reviewComplete, setReviewComplete] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setImgNaturalSize(null);
  }, [currentImageIndex]);

  const { screenState, assessment, filteredRisks } = useRiskAssessment(assessmentId, {
    autoFetch: true,
    refreshInterval: 5000,
  });

  const handleRiskDecision = (riskId: string, decision: 'approved' | 'rejected') => {
    setRiskDecisions(prev => new Map(prev).set(riskId, decision));
    if (decision === 'approved') {
      setMitigationOpen(prev => new Set(prev).add(riskId));
    } else {
      setMitigationOpen(prev => {
        const next = new Set(prev);
        next.delete(riskId);
        return next;
      });
    }
  };

  const handleUndo = (riskId: string) => {
    setRiskDecisions(prev => {
      const next = new Map(prev);
      next.delete(riskId);
      return next;
    });
    setMitigationOpen(prev => {
      const next = new Set(prev);
      next.delete(riskId);
      return next;
    });
  };

  const handleCloseMitigation = (riskId: string) => {
    setMitigationOpen(prev => {
      const next = new Set(prev);
      next.delete(riskId);
      return next;
    });
  };

  const handleToggleMitigationChip = (riskId: string, recId: string) => {
    setSelectedMitigations(prev => {
      const next = new Map<string, Set<string>>(prev);
      const existing = next.get(riskId) ?? new Set<string>();
      const current = new Set<string>(existing);
      if (current.has(recId)) {
        current.delete(recId);
      } else {
        current.add(recId);
      }
      next.set(riskId, current);
      return next;
    });
  };

  const handleCustomMitigation = (riskId: string, value: string) => {
    setCustomMitigations(prev => new Map(prev).set(riskId, value));
  };

  const handleNextPhoto = () => {
    if (!assessment) return;
    if (currentImageIndex < assessment.evidences.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
      setImgNaturalSize(null);
    } else {
      setReviewComplete(true);
    }
  };

  const currentEvidence = assessment ? assessment.evidences[currentImageIndex] : null;

  const currentPhotoRisks = useMemo(() => {
    if (!currentEvidence || !assessment) return [];
    return filteredRisks.filter(
      r => r.evidence?.id === currentEvidence.id || r.evidence == null
    );
  }, [filteredRisks, currentEvidence, assessment]);

  const violationRisks = useMemo(
    () => currentPhotoRisks.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH'),
    [currentPhotoRisks]
  );

  const warningRisks = useMemo(
    () => currentPhotoRisks.filter(r => r.severity === 'MEDIUM' || r.severity === 'LOW'),
    [currentPhotoRisks]
  );

  const totalRisks = assessment ? filteredRisks.length : 0;
  const decidedCount = [...riskDecisions.values()].filter(d => d !== null).length;
  const percentReviewed = totalRisks > 0 ? Math.round((decidedCount / totalRisks) * 100) : 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (screenState.type === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#0b6b82] animate-spin mb-4" />
        <p className="text-gray-600 font-medium">{screenState.message}</p>
      </div>
    );
  }

  if (screenState.type === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-900 font-semibold mb-6 text-center">{screenState.message}</p>
        <button
          onClick={() => navigate('/home')}
          className="bg-[#0b6b82] text-white font-semibold py-3 px-6 rounded-xl"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-gray-600 mb-6">No assessment data available</p>
        <button
          onClick={() => navigate('/home')}
          className="bg-[#0b6b82] text-white font-semibold py-3 px-6 rounded-xl"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // ── Completion screen ──────────────────────────────────────────────────────
  if (reviewComplete) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-5">
        <ThumbsUp className="w-20 h-20 text-[#0b6b82]" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">Review complete!</h1>
        <button
          onClick={() => navigate('/home')}
          className="w-full max-w-sm bg-[#0b6b82] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0a5a70] transition-colors"
        >
          <CheckCircle2 className="w-5 h-5" />
          View Report
        </button>
        <button
          onClick={() => navigate('/home')}
          className="text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Skip, view report
        </button>
      </div>
    );
  }

  const isLastPhoto = currentImageIndex === assessment.evidences.length - 1;

  // ── Image card for a severity group ───────────────────────────────────────
  const renderImageCard = (group: 'violation' | 'warning') => {
    if (!currentEvidence) return null;
    const boxRisks = currentPhotoRisks
      .filter(r =>
        group === 'violation'
          ? r.severity === 'CRITICAL' || r.severity === 'HIGH'
          : r.severity === 'MEDIUM' || r.severity === 'LOW'
      )
      .filter(r => Array.isArray(r.bounding_box) && r.bounding_box.length === 4);
    const strokeColor = group === 'violation' ? '#ef4444' : '#f59e0b';
    const groupCount = group === 'violation' ? violationRisks.length : warningRisks.length;

    return (
      <div className="relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
        <div className="relative" style={{ height: 168 }}>
          <img
            src={currentEvidence.url}
            alt={`Evidence ${currentImageIndex + 1}`}
            className="w-full h-full object-contain bg-gray-900"
            onLoad={e => {
              const img = e.currentTarget;
              setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
          {imgNaturalSize && boxRisks.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imgNaturalSize.w} ${imgNaturalSize.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {boxRisks.map(risk => {
                const [x1, y1, x2, y2] = risk.bounding_box!;
                const sw = Math.max(imgNaturalSize.w, imgNaturalSize.h) / 150;
                return (
                  <rect
                    key={risk.id}
                    x={x1} y={y1}
                    width={x2 - x1} height={y2 - y1}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={sw}
                    strokeLinejoin="round"
                  />
                );
              })}
            </svg>
          )}
          {/* Top-left severity chip */}
          <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
            group === 'violation' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <AlertTriangle className="w-3 h-3" />
            {group === 'violation' ? 'Violation' : 'Warning'}
            <span className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
              group === 'violation' ? 'bg-red-500' : 'bg-yellow-500'
            }`}>
              {groupCount}
            </span>
          </div>
          {/* Zoom icon */}
          <button className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // ── Finding card ───────────────────────────────────────────────────────────
  const renderFindingCard = (risk: RiskItem) => {
    const decision = riskDecisions.get(risk.id);
    const isAccepted = decision === 'approved';
    const isRejected = decision === 'rejected';
    const hasMitigation = mitigationOpen.has(risk.id);
    const selectedRecs = selectedMitigations.get(risk.id) ?? new Set<string>();
    const isViolation = risk.severity === 'CRITICAL' || risk.severity === 'HIGH';

    return (
      <div key={risk.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4">
          {/* Description row */}
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isViolation ? 'text-red-500' : 'text-yellow-500'}`} />
            <p className={`text-sm font-medium leading-snug ${isRejected ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {risk.description}
            </p>
          </div>

          {/* Badge + Undo (post-decision) */}
          {(isAccepted || isRejected) && (
            <div className="flex items-center gap-2 mb-3">
              {isAccepted && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0b6b82] bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Accepted
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                  <XCircle className="w-3 h-3" /> Rejected
                </span>
              )}
              <button
                onClick={() => handleUndo(risk.id)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            </div>
          )}

          {/* Accept / Reject buttons (undecided) */}
          {!isAccepted && !isRejected && (
            <div className="flex gap-2">
              <button
                onClick={() => handleRiskDecision(risk.id, 'approved')}
                className="flex-1 py-2 rounded-lg border-2 border-green-500 text-green-600 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-green-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={() => handleRiskDecision(risk.id, 'rejected')}
                className="flex-1 py-2 rounded-lg border-2 border-gray-300 text-gray-600 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>

        {/* Mitigation panel */}
        {isAccepted && hasMitigation && (
          <div className="border-t border-teal-100 bg-teal-50/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#0b6b82] tracking-wider uppercase">
                Mitigation{' '}
                <span className="font-normal text-gray-400 normal-case tracking-normal">(optional)</span>
              </span>
              <button
                onClick={() => handleCloseMitigation(risk.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {risk.recommendations.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {risk.recommendations.map(rec => {
                  const isSelected = selectedRecs.has(rec.id);
                  return (
                    <button
                      key={rec.id}
                      onClick={() => handleToggleMitigationChip(risk.id, rec.id)}
                      className={`text-left text-sm font-medium py-2 px-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-[#0b6b82] text-white border-[#0b6b82]'
                          : 'bg-white text-[#0b6b82] border-[#0b6b82]/50 hover:border-[#0b6b82]'
                      }`}
                    >
                      {rec.title}
                    </button>
                  );
                })}
              </div>
            )}
            <textarea
              value={customMitigations.get(risk.id) ?? ''}
              onChange={e => handleCustomMitigation(risk.id, e.target.value)}
              placeholder="Or describe a custom action..."
              rows={2}
              className="w-full text-sm text-gray-700 placeholder-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#0b6b82]"
            />
          </div>
        )}
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-gray-900">
            #{String(assessment.id).slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
            Pending Review
          </p>
        </div>
        <button
          onClick={() => navigate('/home')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Home className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* ── Progress section ── */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-900">
            Photo {currentImageIndex + 1} of {assessment.evidences.length}
          </span>
          <span className="text-sm font-bold text-[#0b6b82]">
            {percentReviewed}% reviewed
          </span>
        </div>
        {/* Step dots */}
        {assessment.evidences.length > 1 && (
          <div className="flex items-center">
            {assessment.evidences.map((_, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div
                    className={`flex-1 h-0.5 ${idx <= currentImageIndex ? 'bg-[#0b6b82]' : 'bg-gray-200'}`}
                  />
                )}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[11px] font-bold flex-shrink-0 transition-colors ${
                    idx <= currentImageIndex
                      ? 'bg-[#0b6b82] border-[#0b6b82] text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                >
                  {idx + 1}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ── Date / Location row ── */}
      {currentEvidence && (
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(currentEvidence.captured_at ?? assessment.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Location</p>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {assessment.description || 'North Sector'}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              {assessment.title || 'Scaffolding Area'}
            </span>
          </div>
          <div className="flex items-start gap-1.5 mt-2.5">
            <Info className="w-3.5 h-3.5 text-[#0b6b82] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#0b6b82] leading-snug">
              Review is <strong>optional</strong> — accept or reject what you see. You can skip to the next photo at any time.
            </p>
          </div>
        </div>
      )}

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-3xl mx-auto w-full space-y-0">

          {/* Violation section */}
          {violationRisks.length > 0 && (
            <div className="pt-3 px-4 pb-1">
              <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-bold text-red-600">Violation</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {violationRisks.length}
                </span>
              </div>
              {renderImageCard('violation')}
              <div className="mt-2 space-y-2">
                {violationRisks.map(renderFindingCard)}
              </div>
            </div>
          )}

          {/* Warning section */}
          {warningRisks.length > 0 && (
            <div className="pt-4 px-4 pb-1">
              <div className="flex items-center justify-between bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-bold text-yellow-700">Warning</span>
                </div>
                <span className="w-5 h-5 rounded-full bg-yellow-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {warningRisks.length}
                </span>
              </div>
              {renderImageCard('warning')}
              <div className="mt-2 space-y-2">
                {warningRisks.map(renderFindingCard)}
              </div>
            </div>
          )}

          {/* No risks */}
          {currentPhotoRisks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-gray-600 font-medium">No risks detected in this photo</p>
              {assessment.evidences.length > 1 && (
                <p className="text-gray-400 text-sm mt-1 text-center">
                  Navigate to other photos to review their findings
                </p>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleNextPhoto}
            className="w-full bg-[#0b6b82] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0a5a70] transition-colors"
          >
            {isLastPhoto ? 'Finish Review' : 'Next Photo'}
            {!isLastPhoto && <span className="text-lg leading-none">›</span>}
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            Review is optional — skip anytime to generate the report
          </p>
        </div>
      </footer>
    </div>
  );
}

export default AnalysisDetailPage;
