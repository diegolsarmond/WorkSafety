import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Home,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Loader2,
  CloudOff,
  XCircle,
  Clock,
  Camera,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '@/services/api/apiClient';
import type { AssessmentStatus } from '@/types/risk';

interface AssessmentListItem {
  id: string;
  title: string;
  description: string;
  status: AssessmentStatus;
  created_by_email: string;
  risk_count: number;
  evidence_count: number;
  assessment_type: { id: number; name: string } | null;
  environment_type: { id: number; name: string } | null;
  captured_at: string | null;
  ai_reviewed_at: string | null;
  human_validated_at: string | null;
  created_at: string;
}

type Tab = 'all' | 'pending' | 'done';

const PENDING_STATUSES: AssessmentStatus[] = ['draft', 'captured', 'synced', 'ai_reviewed', 'error_ai', 'error'];
const VALIDATED_STATUSES: AssessmentStatus[] = ['human_validated', 'finalized'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

interface StatusConfig {
  badge: string;
  badgeClass: string;
  iconBg: string;
  Icon: React.ElementType;
  iconClass: string;
}

function getStatusConfig(status: AssessmentStatus): StatusConfig {
  switch (status) {
    case 'ai_reviewed':
      return {
        badge: 'Review',
        badgeClass: 'text-amber-600 border border-amber-400 bg-amber-50',
        iconBg: 'bg-amber-50',
        Icon: AlertTriangle,
        iconClass: 'text-amber-500',
      };
    case 'synced':
      return {
        badge: 'Processing',
        badgeClass: 'text-blue-600 bg-blue-100',
        iconBg: 'bg-blue-50',
        Icon: Loader2,
        iconClass: 'text-blue-500 animate-spin',
      };
    case 'captured':
      return {
        badge: 'Syncing',
        badgeClass: 'text-teal-600 border border-teal-400 bg-teal-50',
        iconBg: 'bg-teal-50',
        Icon: RotateCcw,
        iconClass: 'text-teal-500',
      };
    case 'draft':
      return {
        badge: 'Draft',
        badgeClass: 'text-gray-500 border border-gray-300 bg-gray-50',
        iconBg: 'bg-gray-100',
        Icon: Edit2,
        iconClass: 'text-gray-500',
      };
    case 'error_ai':
    case 'error':
      return {
        badge: 'Verify',
        badgeClass: 'text-red-500 border border-red-400 bg-red-50',
        iconBg: 'bg-red-50',
        Icon: XCircle,
        iconClass: 'text-red-500',
      };
    case 'human_validated':
      return {
        badge: 'Validated',
        badgeClass: 'text-emerald-600 border border-emerald-400 bg-emerald-50',
        iconBg: 'bg-emerald-50',
        Icon: CheckCircle2,
        iconClass: 'text-emerald-500',
      };
    case 'finalized':
      return {
        badge: 'Done',
        badgeClass: 'text-emerald-600 bg-emerald-100',
        iconBg: 'bg-emerald-50',
        Icon: CheckCircle2,
        iconClass: 'text-emerald-500',
      };
    default:
      return {
        badge: status,
        badgeClass: 'text-gray-500 border border-gray-300',
        iconBg: 'bg-gray-100',
        Icon: Clock,
        iconClass: 'text-gray-400',
      };
  }
}

interface StatusDetailProps {
  assessment: AssessmentListItem;
}

function StatusDetail({ assessment }: StatusDetailProps) {
  const { status, risk_count } = assessment;

  if (status === 'ai_reviewed') {
    return (
      <span className="flex items-center gap-1 text-amber-500 font-semibold">
        <AlertTriangle className="w-3 h-3" />
        {risk_count} to review
      </span>
    );
  }
  if (status === 'synced') {
    return (
      <span className="flex items-center gap-1 text-blue-500">
        <Clock className="w-3 h-3" />
        In queue
      </span>
    );
  }
  if (status === 'captured') {
    return (
      <span className="flex items-center gap-1 text-amber-500">
        <CloudOff className="w-3 h-3" />
        Waiting for connection
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="flex items-center gap-1 text-gray-400">
        <Edit2 className="w-3 h-3" />
        Not submitted
      </span>
    );
  }
  if (status === 'human_validated' || status === 'finalized') {
    return (
      <span className="flex items-center gap-1 text-emerald-500 font-semibold">
        <CheckCircle2 className="w-3 h-3" />
        {risk_count} risks validated
      </span>
    );
  }
  if (status === 'error_ai' || status === 'error') {
    return (
      <span className="flex items-center gap-1 text-red-500">
        <XCircle className="w-3 h-3" />
        Processing failed
      </span>
    );
  }
  return null;
}

interface AssessmentCardProps {
  assessment: AssessmentListItem;
  onClick: () => void;
}

function AssessmentCard({ assessment, onClick }: AssessmentCardProps) {
  const cfg = getStatusConfig(assessment.status);
  const { Icon } = cfg;

  const title = assessment.environment_type?.name || assessment.title;
  const tags = [
    assessment.environment_type?.name,
    assessment.assessment_type?.name,
  ].filter(Boolean) as string[];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        {/* Left icon */}
        <div className={`w-11 h-11 ${cfg.iconBg} rounded-xl flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-5 h-5 ${cfg.iconClass}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className="font-bold text-[#111827] text-sm truncate">{title}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
                {cfg.badge}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Description */}
          {assessment.description && (
            <p className="text-gray-500 text-xs truncate mb-1.5">{assessment.description}</p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(assessment.created_at)}
            </span>
            {assessment.evidence_count > 0 && (
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {assessment.evidence_count} {assessment.evidence_count === 1 ? 'photo' : 'photos'}
              </span>
            )}
            <StatusDetail assessment={assessment} />
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function AssessmentsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assessments, setAssessments] = useState<AssessmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const tabParam = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabParam === 'pending' || tabParam === 'done' ? tabParam : 'all';

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const res = await apiClient.get('assessments/');
        setAssessments(res.data);
      } catch (err) {
        console.error('Failed to fetch assessments:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAssessments();

    // Auto-refresh while items are processing
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get('assessments/');
        setAssessments(res.data);
      } catch {
        // silent
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const pending = assessments.filter(a => PENDING_STATUSES.includes(a.status));
  const done = assessments.filter(a => VALIDATED_STATUSES.includes(a.status));

  const visibleItems =
    activeTab === 'pending' ? pending :
    activeTab === 'done' ? done :
    assessments;

  const hasProcessing = assessments.some(a => a.status === 'synced' || a.status === 'captured');

  const setTab = (tab: Tab) => {
    if (tab === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-[#111827]">My Analyses</h1>
        <button
          onClick={() => navigate('/home')}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Home className="w-5 h-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 sticky top-[52px] z-40">
        {(['all', 'pending', 'done'] as Tab[]).map(tab => {
          const count =
            tab === 'all' ? assessments.length :
            tab === 'pending' ? pending.length :
            done.length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-[#0B7A90] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className={`text-xs font-bold ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                {loading ? '…' : count}
              </span>
            </button>
          );
        })}
      </div>

      <main className="px-4 py-4 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading analyses...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <CheckCircle2 className="w-10 h-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No analyses found</p>
          </div>
        ) : (
          <>
            {/* Section label */}
            {activeTab === 'pending' && pending.length > 0 && (
              <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-3 px-1">
                {pending.length} items pending
              </p>
            )}

            <div className="space-y-3">
              {visibleItems.map(assessment => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  onClick={() => navigate(`/analysis/${assessment.id}`)}
                />
              ))}
            </div>

            {/* Footer note when items are processing */}
            {hasProcessing && (
              <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1.5">
                <RotateCcw className="w-3 h-3" />
                Analyses in queue update automatically
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
