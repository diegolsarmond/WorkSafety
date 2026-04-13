import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRiskAssessment } from '@/hooks/risk/useRiskAssessment';
import { ValidatedAssessmentView } from './AnalysisDetailPage';

interface ReviewState {
  approvedRiskIds: string[];
  mitigations: Record<string, string[]>;
  customActions: Record<string, string>;
}

/**
 * Standalone page for the Safety Report view.
 * Route: /analysis/:assessmentId/report
 */
export default function AnalysisReportPage() {
  const navigate = useNavigate();
  const { assessmentId } = useParams<{ assessmentId: string }>();

  const { screenState, assessment, filteredRisks } = useRiskAssessment(assessmentId, {
    autoFetch: true,
  });

  const savedReviewState = useMemo<ReviewState | null>(() => {
    if (!assessmentId) return null;
    try {
      const raw = localStorage.getItem(`review_state_${assessmentId}`);
      return raw ? (JSON.parse(raw) as ReviewState) : null;
    } catch {
      return null;
    }
  }, [assessmentId]);

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

  return (
    <ValidatedAssessmentView
      assessment={assessment}
      risks={filteredRisks}
      reviewState={savedReviewState}
    />
  );
}
