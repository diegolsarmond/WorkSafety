import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Factory, HardHat, Check, Loader2 } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useInspectionStore } from '../../store/inspectionStore';
import { cn } from '@/utils/cn';
import { environmentService, assessmentService, AssessmentType } from '@/services/environment/environmentService';

interface EnvironmentOption {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

// Mapeamento de ícones baseado no nome do ambiente
const getIconForEnvironment = (name: string): React.ElementType => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('construção') || nameLower.includes('obra') || nameLower.includes('construction')) {
    return Building2;
  }
  if (nameLower.includes('indústria') || nameLower.includes('industrial') || nameLower.includes('factory') || nameLower.includes('industry')) {
    return Factory;
  }
  return HardHat;
};

// Mapeamento de cores baseado no índice
const getColorsForIndex = (index: number): { color: string; bg: string } => {
  const colors = [
    { color: 'text-orange-500', bg: 'bg-orange-50' },
    { color: 'text-blue-500', bg: 'bg-blue-50' },
    { color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { color: 'text-purple-500', bg: 'bg-purple-50' },
    { color: 'text-rose-500', bg: 'bg-rose-50' },
    { color: 'text-amber-500', bg: 'bg-amber-50' },
  ];
  return colors[index % colors.length];
};

export function NewInspection() {
  const navigate = useNavigate();
  const { environment, setEnvironment, category, setCategory, photos } = useInspectionStore();
  
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [loadingEnvironments, setLoadingEnvironments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoadingEnvironments(true);
        const data = await environmentService.getAll();
        
        const mappedEnvironments: EnvironmentOption[] = data.map((env, index) => {
          const colors = getColorsForIndex(index);
          return {
            id: env.id.toString(),
            label: env.name,
            icon: getIconForEnvironment(env.name),
            color: colors.color,
            bg: colors.bg,
          };
        });
        
        setEnvironments(mappedEnvironments);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch environment types:', err);
        setError('Failed to load environment types. Please try again.');
      } finally {
        setLoadingEnvironments(false);
      }
    };

    const fetchAssessmentTypes = async () => {
      try {
        setLoadingCategories(true);
        const data = await assessmentService.getAll();
        setAssessmentTypes(data);
      } catch (err) {
        console.error('Failed to fetch assessment types:', err);
        // Don't set error here, environments error is more critical
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchEnvironments();
    fetchAssessmentTypes();
  }, []);

  const handleContinue = () => {
    if (environment) {
      navigate(photos.length > 0 ? '/inspection/review' : '/inspection/camera');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center min-w-[44px] min-h-[44px]">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-gray-900 mr-8">New Analysis</h1>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-8 overflow-y-auto pb-24">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 tracking-wider">STEP 1: ENVIRONMENT</h2>
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md">Mandatory</span>
          </div>

          {loadingEnvironments && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-[#0b6b82] animate-spin" />
              <span className="ml-3 text-gray-500">Loading environments...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-red-600 underline hover:text-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loadingEnvironments && !error && environments.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-gray-500">No environments available.</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {environments.map((env) => {
              const Icon = env.icon;
              const isSelected = environment === env.id;
              return (
                <button
                  key={env.id}
                  onClick={() => setEnvironment(env.id)}
                  className={cn(
                    "flex items-center p-4 rounded-2xl border-2 text-left transition-all",
                    isSelected ? "border-[#0b6b82] bg-white shadow-sm" : "border-transparent bg-white shadow-sm hover:border-gray-200"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mr-4", env.bg)}>
                    <Icon className={cn("w-6 h-6", env.color)} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{env.label}</h3>
                    <p className="text-sm text-gray-500">Tap to select</p>
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    isSelected ? "border-[#0b6b82] bg-[#0b6b82]" : "border-gray-300"
                  )}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 tracking-wider">STEP 2: CATEGORY</h2>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Standard</span>
          </div>

          {loadingCategories ? (
            <div className="flex items-center justify-center py-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Loader2 className="w-6 h-6 text-[#0b6b82] animate-spin" />
              <span className="ml-3 text-gray-500">Loading categories...</span>
            </div>
          ) : assessmentTypes.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-gray-500">No categories available.</p>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-lg font-bold text-gray-900 focus:outline-none appearance-none"
              >
                {assessmentTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <Button
          onClick={handleContinue}
          disabled={!environment}
          className="w-full h-14 text-lg rounded-xl bg-[#0b6b82] hover:bg-[#09586b]"
        >
          Continue <span className="ml-2">›</span>
        </Button>
      </div>
    </div>
  );
}
