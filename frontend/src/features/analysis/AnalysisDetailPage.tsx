import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ZoomIn,
  X,
  Info,
  Image,
  Building2,
  Tag,
  FileText,
  Calendar,
  Shield,
  Share2,
  Download,
  FileSpreadsheet,
  Check,
  Clock,
  ImageIcon,
  User,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import { submitReview } from '@/services/risk/riskService';
import type { RiskItem, RiskAssessmentDetail } from '@/types/risk';

interface RiskDecision {
  riskId: string;
  decision: 'approved' | 'rejected' | null;
}

interface ReviewState {
  approvedRiskIds: string[];
  mitigations: Record<string, string[]>;
  customActions: Record<string, string>;
}

/** Human-readable labels for safety rules */
const RULE_LABELS: Record<string, string> = {
  'Rule 1': 'Rule 1 - Basic PPE Usage',
  'Rule 2': 'Rule 2 - Road Traffic and Vehicle Operation',
  'Rule 3': 'Rule 3 - Slips, Trips, and Falls on Level Surfaces/Stairs',
  'Rule 4': 'Rule 4 - Falls from 1 Meter or More',
  'Rule 5': 'Rule 5 - Forklifts and Internal Moving Vehicles',
  'Rule 6': 'Rule 6 - Construction, Assembly, and Maintenance',
  'Rule 7': 'Rule 7 - Construction Vehicles and Machinery',
  'Rule 8': 'Rule 8 - Loading and Unloading',
};

/** Resolve a rule_id to its full human-readable label */
function getRuleLabel(ruleId: string | undefined): string | null {
  if (!ruleId) return null;
  // Try exact match first
  if (RULE_LABELS[ruleId]) return RULE_LABELS[ruleId];
  // Try matching by extracting the number (e.g. "rule_1" → "Rule 1")
  const num = ruleId.replace(/[^0-9]/g, '');
  if (num) {
    const key = `Rule ${num}`;
    if (RULE_LABELS[key]) return RULE_LABELS[key];
  }
  // Fallback: show raw value
  return ruleId;
}

/**
 * Normaliza coordenadas de bounding box para o espaço de pixels da imagem.
 *
 * A API Olímpia retorna dois formatos:
 *  - Violations: [x1, y1, x2, y2] em espaço 0-1000 (referência interna da API)
 *  - Warnings:   [x1, y1, x2, y2] normalizados 0-1
 *
 * Ambos precisam ser convertidos para pixels reais da imagem para que o SVG
 * fique alinhado com o <img object-contain>.
 */
function normalizeBBox(
  bbox: number[],
  imgW: number,
  imgH: number,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  const maxVal = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));
  // Valores > 1 → espaço 0-1000 da API; valores ≤ 1 → já normalizados
  const ref = maxVal > 1 ? 1000 : 1;
  return [
    (x1 / ref) * imgW,
    (y1 / ref) * imgH,
    (x2 / ref) * imgW,
    (y2 / ref) * imgH,
  ];
}

// ── Validated read-only view (Safety Report) ──────────────────────────────
export function ValidatedAssessmentView({
  assessment,
  risks,
  reviewState,
}: {
  assessment: RiskAssessmentDetail;
  risks: RiskItem[];
  reviewState?: ReviewState | null;
}) {
  const navigate = useNavigate();
  const [reportLightbox, setReportLightbox] = useState<{
    evidence: { id: string; url: string };
    risks: RiskItem[];
  } | null>(null);
  const [reportLbIndex, setReportLbIndex] = useState<number>(0);
  const [reportLbNatSize, setReportLbNatSize] = useState<{ w: number; h: number } | null>(null);
  const [shareToast, setShareToast] = useState(false);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = reportLightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [reportLightbox]);

  // Show only approved risks from the review state, then fall back to validated, then all
  const display = useMemo(() => {
    if (reviewState?.approvedRiskIds && reviewState.approvedRiskIds.length > 0) {
      return risks.filter(r => reviewState.approvedRiskIds.includes(r.id));
    }
    const validated = risks.filter(r => r.risk_status === 'validated');
    return validated.length > 0 ? validated : risks;
  }, [risks, reviewState]);

  const violations = display.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');
  const warnings = display.filter(r => r.severity === 'MEDIUM' || r.severity === 'LOW');

  // Aggregate mitigations: only selected ones (+ custom actions) if review state is available
  const allRecommendations = useMemo(() => {
    const seen = new Set<string>();
    const recs: { id: string; title: string }[] = [];
    for (const risk of display) {
      if (reviewState?.mitigations) {
        const selectedIds = reviewState.mitigations[risk.id] ?? [];
        for (const rec of risk.recommendations) {
          if (selectedIds.includes(rec.id) && !seen.has(rec.id)) {
            seen.add(rec.id);
            recs.push({ id: rec.id, title: rec.title });
          }
        }
        const custom = reviewState.customActions?.[risk.id];
        if (custom?.trim()) {
          const customId = `custom_${risk.id}`;
          if (!seen.has(customId)) {
            seen.add(customId);
            recs.push({ id: customId, title: custom.trim() });
          }
        }
      } else {
        for (const rec of risk.recommendations) {
          if (!seen.has(rec.id)) {
            seen.add(rec.id);
            recs.push({ id: rec.id, title: rec.title });
          }
        }
      }
    }
    return recs;
  }, [display, reviewState]);

  const reportDate = new Date(assessment.captured_at || assessment.created_at);
  const formattedDate = reportDate.toLocaleDateString('pt-BR');
  const caseNum = String(assessment.id).slice(0, 6).toUpperCase();

  // Use full name from backend; fall back to email prefix
  const submittedBy = (
    (assessment.created_by_name && assessment.created_by_name.trim()) ||
    assessment.created_by_email?.split('@')[0]?.replace(/[._]/g, ' ') ||
    'Unknown'
  ).toUpperCase();

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Safety Report — ${assessment.title}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled — do nothing
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  const handlePdf = () => {
    window.print();
  };

  const handleCsv = () => {
    const header = ['ID', 'Severity', 'Location', 'Description', 'Status'];
    const rows = display.map(r => [
      r.id,
      r.severity,
      `"${(r.location || '').replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.risk_status,
    ]);
    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-report-${assessment.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Lightbox close handler ────────────────────────────────────────────────
  const closeLightbox = () => {
    setReportLightbox(null);
    setReportLbNatSize(null);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col report-print-root">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 print-hidden">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-gray-900">Safety Report</h1>
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable content */}
      <main className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-4 print-main">

        {/* Report info card */}
        <div className="bg-white rounded-2xl px-4 pt-4 pb-3 shadow-sm">
          {/* Title row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-3">
              <h2 className="text-base font-bold text-gray-900 leading-tight break-words">{assessment.title || 'Safety Analysis Report'}</h2>
              <p className="text-[9px] text-gray-400 tracking-widest uppercase mt-0.5">
                {`Case #${caseNum}`}
              </p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{formattedDate}</span>
          </div>

          {/* Description */}
          {assessment.description && (
            <div className="flex items-start gap-1.5 mb-3">
              <FileText className="w-3.5 h-3.5 text-[#0B7A90] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 tracking-widest uppercase font-bold">Description</p>
                <p className="text-xs text-gray-700 leading-snug break-words">{assessment.description}</p>
              </div>
            </div>
          )}

          {/* Submitted by */}
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">
            Submitted by:{' '}
            <span className="font-bold text-gray-600">{submittedBy}</span>
          </p>
        </div>

        {/* Findings section */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm print-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase whitespace-nowrap">
              Evidence &amp; Findings
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="p-4 space-y-3">
            {assessment.evidences.length === 0 && (
              <div className="flex items-center justify-center py-10 text-gray-200">
                <Image className="w-16 h-16" strokeWidth={1} />
              </div>
            )}
            {assessment.evidences.map((evidence, idx) => {
              const evidenceRisks = display.filter(
                r => r.evidence?.id === evidence.id || r.evidence == null,
              );
              return (
                <div key={evidence.id} className="space-y-3 print-evidence-block">
                  <ReportEvidenceCard
                    evidence={evidence}
                    risks={evidenceRisks}
                    idx={idx}
                    onClick={() => {
                      setReportLbNatSize(null);
                      setReportLbIndex(idx);
                      setReportLightbox({ evidence, risks: evidenceRisks });
                    }}
                  />
                  {[...evidenceRisks].sort((a, b) => {
                    const aIsViolation = a.severity === 'CRITICAL' || a.severity === 'HIGH';
                    const bIsViolation = b.severity === 'CRITICAL' || b.severity === 'HIGH';
                    return aIsViolation === bIsViolation ? 0 : aIsViolation ? -1 : 1;
                  }).map(risk => {
                    const isViolation = risk.severity === 'CRITICAL' || risk.severity === 'HIGH';
                    return (
                      <div
                        key={risk.id}
                        className={`rounded-xl border p-3 ${isViolation
                          ? 'border-red-100 bg-red-50/40'
                          : 'border-yellow-100 bg-yellow-50/40'
                          }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <AlertTriangle
                            className={`w-3.5 h-3.5 flex-shrink-0 ${isViolation ? 'text-red-500' : 'text-yellow-500'
                              }`}
                          />
                          {isViolation && getRuleLabel(risk.rule_id) && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-red-100 text-red-700">
                              {getRuleLabel(risk.rule_id)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 leading-snug">{risk.description}</p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {display.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No risks found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        {allRecommendations.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase whitespace-nowrap">
                Recommendations
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="p-4">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#0B7A90]" />
                </div>
              </div>
              <ul className="space-y-2">
                {allRecommendations.map(rec => (
                  <li key={rec.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0B7A90] flex-shrink-0 mt-[7px]" />
                    <p className="text-sm text-gray-700 leading-snug">{rec.title}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </main>

      {/* Footer: Share / PDF / CSV */}
      <footer
        className="fixed bottom-0 left-0 right-0 bg-[#1C1C1E] px-6 pt-3 flex items-center justify-around gap-3 print-hidden"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleShare}
          className="flex-1 flex flex-col items-center gap-1 py-1 text-white/80 hover:text-white transition-colors active:scale-95"
        >
          <Share2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-wide">Share</span>
        </button>
        <div className="w-px h-8 bg-white/10" />
        <button
          onClick={handlePdf}
          className="flex-1 flex flex-col items-center gap-1 py-1 text-white/80 hover:text-white transition-colors active:scale-95"
        >
          <Download className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-wide">PDF</span>
        </button>
        <div className="w-px h-8 bg-white/10" />
        <button
          onClick={handleCsv}
          className="flex-1 flex flex-col items-center gap-1 py-1 text-white/80 hover:text-white transition-colors active:scale-95"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-wide">CSV</span>
        </button>
      </footer>

      {/* Share link-copied toast */}
      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg z-50 pointer-events-none">
          Link copied to clipboard
        </div>
      )}

      {/* Report lightbox — full-screen image with bbox overlay */}
      {reportLightbox && (() => {
        const lbEvidence = assessment.evidences[reportLbIndex];
        const lbRisks = lbEvidence
          ? display.filter(r => r.evidence?.id === lbEvidence.id || r.evidence == null)
          : [];
        const totalPhotos = assessment.evidences.length;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                key={lbEvidence?.url}
                src={lbEvidence?.url}
                alt="Evidence expanded"
                className="max-w-full max-h-full object-contain"
                style={{ display: 'block' }}
                onLoad={e => {
                  const img = e.currentTarget;
                  setReportLbNatSize({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
              {reportLbNatSize && lbEvidence && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${reportLbNatSize.w} ${reportLbNatSize.h}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {renderAllBBoxRects(lbRisks, reportLbNatSize.w, reportLbNatSize.h)}
                </svg>
              )}

              {/* Prev button */}
              {reportLbIndex > 0 && (
                <button
                  onClick={() => { setReportLbIndex(i => i - 1); setReportLbNatSize(null); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Next button */}
              {reportLbIndex < totalPhotos - 1 && (
                <button
                  onClick={() => { setReportLbIndex(i => i + 1); setReportLbNatSize(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              <button
                onClick={closeLightbox}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Counter */}
              {totalPhotos > 1 && (
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
                  {reportLbIndex + 1} / {totalPhotos}
                </p>
              )}
              {totalPhotos === 1 && (
                <p className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
                  Tap outside to close
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Processing view (synced / captured / draft — AI ainda não concluiu) ──────
function ProcessingView({ assessment }: { assessment: RiskAssessmentDetail }) {
  const navigate = useNavigate();
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const photoCount = assessment.evidences.length;
  const firstPhoto = assessment.evidences[0]?.url ?? null;

  const reportDate = new Date(assessment.captured_at || assessment.created_at);
  const formattedDate = reportDate.toLocaleDateString('pt-BR');

  const submittedBy = (
    (assessment.created_by_name && assessment.created_by_name.trim()) ||
    assessment.created_by_email?.split('@')[0]?.replace(/[._]/g, ' ') ||
    'Unknown'
  ).toUpperCase();

  // Mapa de status → etapas visuais
  const steps = [
    {
      label: 'Photos uploaded',
      done: true,
    },
    {
      label: 'Images verified',
      done: assessment.status !== 'draft',
    },
    {
      label: 'Processing',
      active: assessment.status === 'synced' || assessment.status === 'captured',
      done: false,
    },
    {
      label: 'Ready for review',
      done: false,
      inactive: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold text-gray-900 break-all line-clamp-2 max-w-[180px]">{assessment.title}</h1>
          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-[#E8F4F7] text-[#0B7A90] text-[10px] font-bold">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        </div>
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-8 max-w-lg mx-auto w-full">
        {/* Processing steps card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full border-2 border-[#0B7A90] flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[#0B7A90] animate-spin" />
            </div>
            <span className="text-xl font-bold text-gray-800">Being processed</span>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {step.done ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                ) : step.active ? (
                  <div className="w-6 h-6 rounded-full border-2 border-[#0B7A90] flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-3.5 h-3.5 text-[#0B7A90] animate-spin" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-gray-300 block" />
                  </div>
                )}
                <span
                  className={`text-sm font-semibold ${step.done
                    ? 'text-emerald-600'
                    : step.active
                      ? 'text-[#0B7A90]'
                      : 'text-gray-400'
                    }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Photo thumbnail placeholder */}
        <div
          className="relative bg-gray-200 rounded-2xl overflow-hidden aspect-video flex items-center justify-center cursor-pointer group"
          onClick={() => firstPhoto && setExpandedPhoto(firstPhoto)}
        >
          {firstPhoto ? (
            <img src={firstPhoto} alt="Evidence" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-12 h-12 text-gray-400" />
          )}
          {firstPhoto && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          )}
          {photoCount > 0 && (
            <span className="absolute top-3 right-3 bg-black/60 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
            </span>
          )}
        </div>

        {/* Photo lightbox */}
        {expandedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setExpandedPhoto(null)}
          >
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={expandedPhoto}
              alt="Evidence expanded"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Gallery navigation for multiple photos */}
            {assessment.evidences.length > 1 && (
              <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3">
                {assessment.evidences.map((ev, idx) => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); setExpandedPhoto(ev.url); }}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${expandedPhoto === ev.url
                      ? 'border-white scale-110'
                      : 'border-white/30 hover:border-white/60 opacity-70 hover:opacity-100'
                      }`}
                  >
                    <img src={ev.url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report metadata card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-bold text-gray-900 break-all">{assessment.title || 'Safety Analysis Report'}</h2>
            <span className="text-xs text-gray-400 mt-0.5">{formattedDate}</span>
          </div>

          {assessment.description && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase flex items-center gap-1 mb-1">
                <FileText className="w-3 h-3" /> Description
              </p>
              <p className="text-sm font-semibold text-gray-900 break-words">{assessment.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">
              Submitted by: <span className="text-gray-700">{submittedBy}</span>
            </span>
          </div>
        </div>

        {/* Waiting info box */}
        <div className="bg-[#E8F4F7] border border-[#0B7A90]/20 rounded-2xl p-4 flex gap-3">
          <Clock className="w-5 h-5 text-[#0B7A90] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-[#0B7A90] mb-1">Waiting for results</p>
            <p className="text-xs text-[#0B7A90]/80 leading-relaxed">
              Your photos are being analyzed. You will be notified when the review is ready.
              You can close this screen and come back later.
            </p>
          </div>
        </div>

        {/* Footer note */}
        <div className="flex items-start gap-2 px-1">
          <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Identified risks and required actions will be available for review once processing is complete.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * Self-contained thumbnail card with bbox overlay.
 * Each instance manages its own container ref + ResizeObserver so portrait
 * photos get correct pillarbox offsets independently.
 */
function ImageCardWithBBox({
  evidenceUrl,
  imageIndex,
  totalImages = 1,
  risks,
  group,
  groupCount,
  onOpenLightbox,
  onNext,
  onPrev,
}: {
  evidenceUrl: string;
  imageIndex: number;
  totalImages?: number;
  risks: RiskItem[];
  group: 'violation' | 'warning' | 'all';
  groupCount: number;
  onOpenLightbox: (group: 'violation' | 'warning' | 'all') => void;
  onNext?: () => void;
  onPrev?: () => void;
}) {
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);

  // Reset when image changes
  useEffect(() => {
    setNatSize(null);
  }, [evidenceUrl]);

  const strokeColor = group === 'violation' ? '#ef4444' : '#f59e0b';

  return (
    <div className="relative rounded-xl overflow-hidden bg-[#e5e5ea] border border-gray-100 group">
      <div
        className="relative cursor-zoom-in"
        style={{ height: group === 'all' ? 260 : 168 }}
        onClick={() => onOpenLightbox(group)}
      >
        <img
          src={evidenceUrl}
          alt={`Evidence ${imageIndex + 1}`}
          className="w-full h-full object-contain"
          onLoad={e => {
            const img = e.currentTarget;
            setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
        {/* Bounding boxes shown only in lightbox, not in thumbnails */}

        {/* Severity badge removed from thumbnail — shown only in lightbox */}

        {/* Zoom button */}
        <button
          onClick={e => { e.stopPropagation(); onOpenLightbox(group); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {/* Prev button */}
        {onPrev && imageIndex > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex flex-col items-center justify-center text-white hover:bg-black/70 transition-transform active:scale-95 z-10"
          >
            <ChevronLeft className="w-5 h-5 ml-0.5" strokeWidth={3} />
          </button>
        )}

        {/* Next button */}
        {onNext && imageIndex < totalImages - 1 && (
          <button
            onClick={e => { e.stopPropagation(); onNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex flex-col items-center justify-center text-white hover:bg-black/70 transition-transform active:scale-95 z-10"
          >
            <ChevronRight className="w-5 h-5 mr-0.5" strokeWidth={3} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Module-level bbox helpers ─────────────────────────────────────────────────

function renderBBoxRects(
  risks: RiskItem[],
  imgW: number,
  imgH: number,
  strokeColor: string,
  strokeWidthDivisor = 150,
): React.ReactNode {
  return risks
    .filter(r => Array.isArray(r.bounding_box) && r.bounding_box.length === 4)
    .map(risk => {
      const [rx1, ry1, rx2, ry2] = normalizeBBox(risk.bounding_box!, imgW, imgH);
      const sw = Math.max(imgW, imgH) / (strokeWidthDivisor * 2.5);
      const dashLen = sw * 6;
      const x = Math.min(rx1, rx2);
      const y = Math.min(ry1, ry2);
      const w = Math.abs(rx2 - rx1);
      const h = Math.abs(ry2 - ry1);
      const fontSize = Math.max(imgW, imgH) / 80;
      const pad = sw * 2;
      return (
        <g key={risk.id}>
          <rect
            x={x} y={y}
            width={w} height={h}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
            strokeLinejoin="round"
            strokeDasharray={`${dashLen} ${dashLen * 0.6}`}
          />
          {risk.rule_id && (
            <>
              <rect
                x={x + pad}
                y={y + pad}
                width={risk.rule_id.length * fontSize * 0.62 + fontSize * 0.8}
                height={fontSize * 1.6}
                rx={fontSize * 0.3}
                fill={strokeColor}
                fillOpacity={0.85}
              />
              <text
                x={x + pad + fontSize * 0.4}
                y={y + pad + fontSize * 1.15}
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {risk.rule_id}
              </text>
            </>
          )}
        </g>
      );
    });
}

/** Mixed-color bbox overlay: red for violations, yellow for warnings. */
function renderAllBBoxRects(risks: RiskItem[], imgW: number, imgH: number): React.ReactNode {
  return risks
    .filter(r => Array.isArray(r.bounding_box) && r.bounding_box.length === 4)
    .map(risk => {
      const [rx1, ry1, rx2, ry2] = normalizeBBox(risk.bounding_box!, imgW, imgH);
      const isViolation = risk.severity === 'CRITICAL' || risk.severity === 'HIGH';
      const strokeColor = isViolation ? '#ef4444' : '#f59e0b';
      const sw = Math.max(imgW, imgH) / 375;
      const dashLen = sw * 6;
      const x = Math.min(rx1, rx2);
      const y = Math.min(ry1, ry2);
      const w = Math.abs(rx2 - rx1);
      const h = Math.abs(ry2 - ry1);
      const fontSize = Math.max(imgW, imgH) / 80;
      const pad = sw * 2;
      // Only violations show rule_id label; warnings always show "Warning"
      const labelText = isViolation && risk.rule_id ? risk.rule_id : (!isViolation ? 'Warning' : null);
      const labelW = labelText ? labelText.length * fontSize * 0.62 + fontSize * 0.8 : 0;
      const labelH = fontSize * 1.6;
      return (
        <g key={risk.id}>
          <rect
            x={x} y={y}
            width={w} height={h}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sw}
            strokeLinejoin="round"
            strokeDasharray={`${dashLen} ${dashLen * 0.6}`}
          />
          {labelText && (
            <>
              <rect
                x={x + pad}
                y={y + pad}
                width={Math.min(labelW, w - pad * 2)}
                height={labelH}
                rx={fontSize * 0.3}
                fill={strokeColor}
                fillOpacity={0.85}
              />
              <text
                x={x + pad + fontSize * 0.4}
                y={y + pad + fontSize * 1.15}
                fill="white"
                fontSize={fontSize}
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {labelText}
              </text>
            </>
          )}
        </g>
      );
    });
}

// ── ReportEvidenceCard ────────────────────────────────────────────────────────
/**
 * Clickable image card for the Full Report view.
 * Shows bbox overlays for all risks (violations=red, warnings=yellow).
 * Handles portrait/landscape responsiveness via ResizeObserver.
 */
function ReportEvidenceCard({
  evidence,
  risks,
  idx,
  onClick,
}: {
  evidence: { id: string; url: string };
  risks: RiskItem[];
  idx: number;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [natSize, setNatSize] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setNatSize(null);
    setDisplaySize(null);
  }, [evidence.url]);

  // Compute the actual rendered image area inside the object-contain container
  const computeDisplaySize = useCallback(() => {
    if (!containerRef.current || !natSize) return;
    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const imgAspect = natSize.w / natSize.h;
    const containerAspect = containerW / containerH;
    let renderedW: number, renderedH: number;
    if (imgAspect > containerAspect) {
      renderedW = containerW;
      renderedH = containerW / imgAspect;
    } else {
      renderedH = containerH;
      renderedW = containerH * imgAspect;
    }
    setDisplaySize({ w: renderedW, h: renderedH });
  }, [natSize]);

  useEffect(() => {
    computeDisplaySize();
    const observer = new ResizeObserver(computeDisplaySize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [computeDisplaySize]);

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-gray-900 cursor-zoom-in group print-evidence-card"
      onClick={onClick}
    >
      <div ref={containerRef} className="relative report-evidence-img-container">
        <img
          src={evidence.url}
          alt={`Evidence ${idx + 1}`}
          className="w-full h-full object-contain"
          onLoad={e => {
            const img = e.currentTarget;
            setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
        {/* Bounding boxes rendered directly on the card for PDF output */}
        {natSize && displaySize && (
          <svg
            className="absolute pointer-events-none"
            style={{
              width: displaySize.w,
              height: displaySize.h,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
            viewBox={`0 0 ${natSize.w} ${natSize.h}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {renderAllBBoxRects(risks, natSize.w, natSize.h)}
          </svg>
        )}
        {/* Hover zoom hint */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none print-hidden">
          <ZoomIn className="w-7 h-7 text-white drop-shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lightboxGroup, setLightboxGroup] = useState<'violation' | 'warning' | 'all' | null>(null);
  // Natural size for lightbox image (independently tracked)
  const [lightboxNatSize, setLightboxNatSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setLightboxGroup(null);
    setLightboxNatSize(null);
  }, [currentImageIndex]);

  // Impede scroll do body quando lightbox está aberto
  useEffect(() => {
    if (lightboxGroup !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxGroup]);

  const { screenState, assessment, filteredRisks } = useRiskAssessment(assessmentId, {
    autoFetch: true,
    refreshInterval: 5000,
  });

  // ── Swipe gesture support ──────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || !assessment) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const SWIPE_THRESHOLD = 50;
    // Only trigger horizontal swipe if it's more horizontal than vertical
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0 && currentImageIndex < assessment.evidences.length - 1) {
        // Swipe left → next photo
        setCurrentImageIndex(prev => prev + 1);
        setLightboxNatSize(null);
      } else if (deltaX > 0 && currentImageIndex > 0) {
        // Swipe right → previous photo
        setCurrentImageIndex(prev => prev - 1);
        setLightboxNatSize(null);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [assessment, currentImageIndex]);

  const savedReviewState = useMemo<ReviewState | null>(() => {
    if (!assessmentId) return null;
    try {
      const raw = localStorage.getItem(`review_state_${assessmentId}`);
      return raw ? (JSON.parse(raw) as ReviewState) : null;
    } catch {
      return null;
    }
  }, [assessmentId]);

  const handleRiskDecision = (riskId: string, decision: 'approved' | 'rejected') => {
    setRiskDecisions(prev => new Map(prev).set(riskId, decision));
    if (decision === 'rejected') {
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
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
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

  const handleFinishReview = async () => {
    if (!assessmentId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const decisions = filteredRisks.map(risk => ({
        risk_id: risk.id,
        decision: (riskDecisions.get(risk.id) ?? 'pending') as 'approved' | 'rejected' | 'pending',
        mitigations: [...(selectedMitigations.get(risk.id) ?? new Set<string>())],
        custom_action: customMitigations.get(risk.id) ?? '',
      }));
      await submitReview(assessmentId, decisions);

      // Persist review selections so the report view can filter correctly
      const approvedRiskIds = filteredRisks
        .filter(r => riskDecisions.get(r.id) === 'approved')
        .map(r => r.id);
      const reviewState: ReviewState = {
        approvedRiskIds,
        mitigations: Object.fromEntries(
          [...selectedMitigations.entries()].map(([k, v]) => [k, [...v]]),
        ),
        customActions: Object.fromEntries(customMitigations),
      };
      localStorage.setItem(`review_state_${assessmentId}`, JSON.stringify(reviewState));

      setReviewComplete(true);
    } catch {
      setSubmitError('Failed to save review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextPhoto = () => {
    if (!assessment) return;
    if (currentImageIndex < assessment.evidences.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
      setLightboxNatSize(null);
    } else {
      handleFinishReview();
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

  // ── Processing view (IA ainda em execução) ────────────────────────────────
  if (
    assessment.status === 'synced' ||
    assessment.status === 'captured' ||
    assessment.status === 'draft'
  ) {
    return <ProcessingView assessment={assessment} />;
  }

  // ── Validated / finalized → fall through to the main render in read-only mode
  const isValidated = assessment.status === 'human_validated' || assessment.status === 'finalized';

  // ── Completion screen ──────────────────────────────────────────────────────
  if (reviewComplete) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 gap-5">
        <ThumbsUp className="w-20 h-20 text-[#0b6b82]" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-gray-900">Review complete!</h1>
        <button
          onClick={() => navigate(`/analysis/${assessmentId}/report`)}
          className="w-full max-w-sm bg-[#0b6b82] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0a5a70] transition-colors"
        >
          <CheckCircle2 className="w-5 h-5" />
          View Report
        </button>
        <button
          onClick={() => navigate(`/analysis/${assessmentId}/report`)}
          className="text-gray-500 font-medium hover:text-gray-700 transition-colors"
        >
          Skip, view report
        </button>
      </div>
    );
  }

  const isLastPhoto = currentImageIndex === assessment.evidences.length - 1;

  // ── Image card (thumbnail) — rendered as self-contained component ─────────
  // Each card manages its own container ref so portrait photos get correct
  // bounding-box positioning independently.
  // (defined below as ImageCardWithBBox)

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
          <div className={`${isValidated ? '' : 'mb-3'}`}>
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${isViolation ? 'text-red-500' : 'text-yellow-500'}`} />
              {isViolation && getRuleLabel(risk.rule_id) && (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-red-100 text-red-700">
                  {getRuleLabel(risk.rule_id)}
                </span>
              )}
              {!isViolation && (
                <span className="text-[10px] font-bold text-yellow-600 tracking-widest uppercase">
                  Warning
                </span>
              )}
            </div>
            <p className={`text-sm font-medium leading-snug ${isRejected ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {risk.description}
            </p>
          </div>

          {/* Badge + Undo (post-decision) — hidden for validated */}
          {!isValidated && (isAccepted || isRejected) && (
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
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            </div>
          )}

          {/* Accept / Reject buttons (undecided) — hidden for validated */}
          {!isValidated && !isAccepted && !isRejected && (
            <div className="flex gap-2">
              <button
                onClick={() => handleRiskDecision(risk.id, 'approved')}
                className="flex-1 py-2 rounded-lg border-2 border-green-500 text-green-600 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-green-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={() => handleRiskDecision(risk.id, 'rejected')}
                className="flex-1 py-2 rounded-lg border-2 border-red-500 text-red-600 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>

        {/* Suggested Mitigations panel */}
        {isAccepted && (
          <div className="border-t border-teal-100 bg-teal-50/40">
            <button
              type="button"
              onClick={() => handleCloseMitigation(risk.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-100/50 transition-colors"
            >
              <span className="text-xs font-bold text-[#0b6b82] tracking-wider uppercase">
                Suggested Mitigations{' '}
                <span className="font-normal text-gray-400 normal-case tracking-normal">(optional)</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-[#0b6b82] transition-transform duration-200 ${hasMitigation ? 'rotate-180' : ''}`} />
            </button>

            {mitigationOpen.has(risk.id) && (
              <div className="px-4 pb-4 pt-1">
                {risk.recommendations.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    {risk.recommendations.map(rec => {
                      const isSelected = selectedRecs.has(rec.id);
                      return (
                        <label
                          key={rec.id}
                          onClick={() => handleToggleMitigationChip(risk.id, rec.id)}
                          className="flex items-start gap-2.5 cursor-pointer group"
                        >
                          <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected
                            ? 'bg-[#0b6b82] border-[#0b6b82]'
                            : 'bg-white border-gray-300 group-hover:border-[#0b6b82]'
                            }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className={`text-sm leading-snug transition-colors ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'
                            }`}>
                            {rec.title}
                          </span>
                        </label>
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
        )}
      </div>
    );
  };

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const renderLightbox = () => {
    if (lightboxGroup === null || !currentEvidence) return null;

    const boxRisks = lightboxGroup === 'all'
      ? currentPhotoRisks
      : currentPhotoRisks.filter(r =>
        lightboxGroup === 'violation'
          ? r.severity === 'CRITICAL' || r.severity === 'HIGH'
          : r.severity === 'MEDIUM' || r.severity === 'LOW'
      );
    const strokeColor = lightboxGroup === 'all'
      ? '#ef4444' // fallback for direct call
      : (lightboxGroup === 'violation' ? '#ef4444' : '#f59e0b');

    return (
      <div
        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
        onClick={() => setLightboxGroup(null)}
      >
        {/* Conteúdo — stopPropagation para não fechar ao clicar dentro */}
        <div
          className="relative w-full h-full flex items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={currentEvidence.url}
            alt={`Evidence ${currentImageIndex + 1} expanded`}
            className="max-w-full max-h-full object-contain"
            style={{ display: 'block' }}
            onLoad={e => {
              const img = e.currentTarget;
              setLightboxNatSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
          {/* SVG overlay com mesma viewBox e preserveAspectRatio que o <img> */}
          {lightboxNatSize && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${lightboxNatSize.w} ${lightboxNatSize.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {lightboxGroup === 'all'
                ? renderAllBBoxRects(boxRisks, lightboxNatSize.w, lightboxNatSize.h)
                : renderBBoxRects(boxRisks, lightboxNatSize.w, lightboxNatSize.h, strokeColor, 80)}
            </svg>
          )}

          {/* Severity label */}
          {lightboxGroup !== 'all' && (
            <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${lightboxGroup === 'violation'
              ? 'bg-red-500/90 text-white'
              : 'bg-yellow-500/90 text-white'
              }`}>
              <AlertTriangle className="w-4 h-4" />
              {lightboxGroup === 'violation' ? 'Violations' : 'Warnings'}
              <span className="ml-0.5 bg-white/30 rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold">
                {lightboxGroup === 'violation' ? violationRisks.length : warningRisks.length}
              </span>
            </div>
          )}

          {/* Fechar */}
          <button
            onClick={() => setLightboxGroup(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev photo */}
          {assessment && currentImageIndex > 0 && (
            <button
              onClick={() => { setCurrentImageIndex(i => i - 1); setLightboxNatSize(null); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next photo */}
          {assessment && currentImageIndex < assessment.evidences.length - 1 && (
            <button
              onClick={() => { setCurrentImageIndex(i => i + 1); setLightboxNatSize(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Counter / dica de toque */}
          {assessment && assessment.evidences.length > 1 ? (
            <p className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
              {currentImageIndex + 1} / {assessment.evidences.length}
            </p>
          ) : (
            <p className="absolute bottom-4 left-0 right-0 text-center text-white/50 text-xs pointer-events-none">
              Tap outside to close
            </p>
          )}
        </div>
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
          <h1 className="text-base font-bold text-gray-900 break-all line-clamp-2">
            {assessment.title || `#${String(assessment.id).slice(0, 8).toUpperCase()}`}
          </h1>
          <p className={`text-[11px] font-semibold tracking-widest uppercase ${isValidated ? 'text-emerald-500' : 'text-gray-400'
            }`}>
            {isValidated
              ? (assessment.status === 'finalized' ? 'Done' : 'Validated')
              : 'Pending Review'}
          </p>
        </div>
        <button
          onClick={() => navigate('/home')}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Home className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* ── Progress section (hidden for validated) ── */}
      {!isValidated && (
        <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-900">
              Photo {currentImageIndex + 1} of {assessment.evidences.length}
            </span>
            <span className="text-sm font-bold text-[#0b6b82]">
              {percentReviewed}% reviewed
            </span>
          </div>
          {assessment.evidences.length > 1 && (
            <div className="flex items-center">
              {assessment.evidences.map((_, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <div
                      className={`flex-1 h-0.5 ${idx <= currentImageIndex ? 'bg-[#0b6b82]' : 'bg-gray-200'}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => { setCurrentImageIndex(idx); setLightboxNatSize(null); }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 text-[11px] font-bold flex-shrink-0 transition-colors cursor-pointer ${idx <= currentImageIndex
                      ? 'bg-[#0b6b82] border-[#0b6b82] text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                      }`}
                  >
                    {idx + 1}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Date row ── */}
      {currentEvidence && (
        <div className="bg-white px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date(currentEvidence.captured_at ?? assessment.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          {!isValidated && (
            <div className="flex items-start gap-1.5 mt-2.5">
              <Info className="w-3.5 h-3.5 text-[#0b6b82] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#0b6b82] leading-snug">
                Review is <strong>optional</strong> — accept or reject what you see. You can skip to the next photo at any time.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Scrollable content ── */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto pb-28"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-3xl mx-auto w-full space-y-0">

          {/* Violation section */}
          {violationRisks.length > 0 && currentEvidence && (
            <div className="pt-4 px-4 pb-1">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm font-bold text-red-500 tracking-wide uppercase">Violation</span>
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {violationRisks.length}
                </span>
              </div>
              {/* Image card — violations only */}
              <ImageCardWithBBox
                evidenceUrl={currentEvidence.url}
                imageIndex={currentImageIndex}
                totalImages={assessment.evidences.length}
                risks={violationRisks}
                group="violation"
                groupCount={violationRisks.length}
                onOpenLightbox={setLightboxGroup}
                onNext={currentImageIndex < assessment.evidences.length - 1 ? () => { setCurrentImageIndex(i => i + 1); setLightboxNatSize(null); } : undefined}
                onPrev={currentImageIndex > 0 ? () => { setCurrentImageIndex(i => i - 1); setLightboxNatSize(null); } : undefined}
              />
              {/* Finding cards */}
              <div className="mt-3 space-y-2">
                {violationRisks.map(renderFindingCard)}
              </div>
            </div>
          )}

          {/* Warning section */}
          {warningRisks.length > 0 && currentEvidence && (
            <div className="pt-4 px-4 pb-1">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="text-sm font-bold text-yellow-600 tracking-wide uppercase">Warning</span>
                <span className="w-5 h-5 rounded-full bg-yellow-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {warningRisks.length}
                </span>
              </div>
              {/* Image card — warnings only */}
              <ImageCardWithBBox
                evidenceUrl={currentEvidence.url}
                imageIndex={currentImageIndex}
                totalImages={assessment.evidences.length}
                risks={warningRisks}
                group="warning"
                groupCount={warningRisks.length}
                onOpenLightbox={setLightboxGroup}
                onNext={currentImageIndex < assessment.evidences.length - 1 ? () => { setCurrentImageIndex(i => i + 1); setLightboxNatSize(null); } : undefined}
                onPrev={currentImageIndex > 0 ? () => { setCurrentImageIndex(i => i - 1); setLightboxNatSize(null); } : undefined}
              />
              {/* Finding cards */}
              <div className="mt-3 space-y-2">
                {warningRisks.map(renderFindingCard)}
              </div>
            </div>
          )}

          {/* Pagination Dots (shown when there are evidences) */}
          {assessment.evidences.length > 1 && currentPhotoRisks.length > 0 && (
            <div className="flex justify-center mt-3 mb-1">
              <div className="inline-flex gap-1.5 px-3 py-1.5 bg-black/50 rounded-full">
                {assessment.evidences.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
                  />
                ))}
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
          {isValidated ? (
            <>
              <button
                onClick={() => navigate(`/analysis/${assessmentId}/report`)}
                className="w-full bg-[#0b6b82] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0a5a70] transition-colors"
              >
                <CheckCircle2 className="w-5 h-5" /> View Report
              </button>
            </>
          ) : (
            <>
              {submitError && (
                <p className="text-center text-xs text-red-500 mb-2">{submitError}</p>
              )}
              <button
                onClick={handleNextPhoto}
                disabled={isSubmitting}
                className="w-full bg-[#0b6b82] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0a5a70] transition-colors disabled:opacity-60"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : isLastPhoto ? (
                  'Finish Review'
                ) : (
                  <>Next Photo <span className="text-lg leading-none">›</span></>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                Review is optional — skip anytime to generate the report
              </p>
            </>
          )}
        </div>
      </footer>

      {/* ── Lightbox ── */}
      {renderLightbox()}
    </div>
  );
}

export default AnalysisDetailPage;
