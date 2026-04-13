import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Factory, HardHat, Warehouse, Wrench, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useAnalysisStore } from '../../store/analysisStore';
import { cn } from '@/utils/cn';
import { environmentService, assessmentService, AssessmentType } from '@/services/environment/environmentService';

interface EnvironmentOption {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const STATIC_ENV_FALLBACKS: EnvironmentOption[] = [
  { id: 'construction', label: 'Construction Site', icon: Building2, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'industrial', label: 'Industrial Facility', icon: Factory, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'manufacturing', label: 'Manufacturing Plant', icon: HardHat, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'maintenance', label: 'Maintenance Area', icon: Wrench, color: 'text-rose-500', bg: 'bg-rose-50' },
];

const STATIC_CATEGORY_FALLBACKS = [
  'General Safety Walkthrough',
  'PPE Compliance Assessment',
  'Fall Protection Check',
  'Electrical Safety',
  'Chemical Hazard Review',
];

const getIconForEnvironment = (name: string): React.ElementType => {
  const n = name.toLowerCase();
  if (n.includes('construção') || n.includes('obra') || n.includes('construction')) return Building2;
  if (n.includes('indústria') || n.includes('industrial') || n.includes('factory') || n.includes('industry')) return Factory;
  if (n.includes('warehouse') || n.includes('armazém') || n.includes('depósito')) return Warehouse;
  if (n.includes('maintenance') || n.includes('manutenção')) return Wrench;
  return HardHat;
};

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

export function NewAnalysis() {
  const navigate = useNavigate();
  const { title, setTitle, description, setDescription, environment, setEnvironment, category, setCategory } = useAnalysisStore();

  const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
  const [assessmentTypes, setAssessmentTypes] = useState<AssessmentType[]>([]);
  const [loadingEnvironments, setLoadingEnvironments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [envOpen, setEnvOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const envRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (envRef.current && !envRef.current.contains(e.target as Node)) setEnvOpen(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoadingEnvironments(true);
        const data = await environmentService.getAll();
        data.sort((a, b) => a.id - b.id);
        const mapped: EnvironmentOption[] = data.map((env, index) => {
          const colors = getColorsForIndex(index);
          return { id: env.id.toString(), label: env.name, icon: getIconForEnvironment(env.name), ...colors };
        });
        setEnvironments(mapped.length > 0 ? mapped : STATIC_ENV_FALLBACKS);
      } catch {
        setEnvironments(STATIC_ENV_FALLBACKS);
      } finally {
        setLoadingEnvironments(false);
      }
    };

    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const data = await assessmentService.getAll();
        setAssessmentTypes(data);
      } catch {
        // fallback used in render
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchEnvironments();
    fetchCategories();
  }, []);

  const displayEnvs = environments.length > 0 ? environments : STATIC_ENV_FALLBACKS;
  const displayCategories: AssessmentType[] = assessmentTypes.length > 0
    ? assessmentTypes
    : STATIC_CATEGORY_FALLBACKS.map((name, i) => ({ id: i + 1, name, description: '', active: true }));

  const selectedEnv = displayEnvs.find((e) => e.id === environment);
  const selectedCat = category || displayCategories[0]?.name || '';

  // Ensure category has a value once categories load
  useEffect(() => {
    if (!category && displayCategories.length > 0) {
      setCategory(displayCategories[0].name);
    }
  }, [category, displayCategories, setCategory]);

  const handleContinue = () => {
    navigate('/analysis/camera');
  };

  const canContinue = title.trim().length > 0 && environment.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center p-4 bg-white shadow-sm gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 -ml-2 rounded-full hover:bg-gray-100 flex items-center justify-center min-w-[44px] min-h-[44px]"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-gray-900">New Analysis</h1>
        {/* Stepper */}
        <div className="flex items-center gap-1.5 mr-1">
          <div className="w-7 h-7 rounded-full bg-[#0B7A90] text-white text-xs font-bold flex items-center justify-center">1</div>
          <div className="w-4 h-0.5 bg-gray-200" />
          <div className="w-7 h-7 rounded-full border-2 border-gray-300 text-gray-400 text-xs font-bold flex items-center justify-center">2</div>
          <span className="text-xs text-gray-500 ml-1 hidden sm:inline">Step 1 of 2 — Details</span>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto pb-24 max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto w-full">
        {/* Step label (mobile) */}
        <p className="text-xs text-gray-500 sm:hidden">Step 1 of 2 — Details</p>

        {/* ANALYSIS TITLE */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500 tracking-wider uppercase">Analysis Title</label>
            <span className="text-xs font-bold text-red-500">Required</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. North Sector Safety Check"
            maxLength={120}
            className="w-full h-14 px-4 rounded-2xl border border-gray-200 bg-white text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0B7A90] shadow-sm"
          />
        </section>

        {/* DESCRIPTION */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500 tracking-wider uppercase">Description</label>
            <span className="text-xs text-gray-400">{description.length}/140</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 140))}
            rows={3}
            placeholder="Brief description of the area or activity being checked"
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0B7A90] shadow-sm resize-none"
          />
        </section>

        {/* ENVIRONMENT */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500 tracking-wider uppercase">Environment</label>
            <span className="text-xs font-bold text-red-500">Required</span>
          </div>

          {loadingEnvironments ? (
            <div className="flex items-center gap-3 h-14 px-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <Loader2 className="w-5 h-5 text-[#0B7A90] animate-spin" />
              <span className="text-gray-400 text-sm">Loading environments...</span>
            </div>
          ) : (
            <div ref={envRef} className="relative">
              <button
                type="button"
                onClick={() => { setEnvOpen(!envOpen); setCatOpen(false); }}
                className={cn(
                  "w-full flex items-center h-14 px-4 rounded-2xl border bg-white shadow-sm text-left gap-3 focus:outline-none transition-all",
                  envOpen ? "border-[#0B7A90] ring-2 ring-[#0B7A90]" : "border-gray-200"
                )}
              >
                {selectedEnv ? (
                  <>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", selectedEnv.bg)}>
                      <selectedEnv.icon className={cn("w-4 h-4", selectedEnv.color)} />
                    </div>
                    <span className="flex-1 font-medium text-gray-900">{selectedEnv.label}</span>
                  </>
                ) : (
                  <span className="flex-1 text-gray-400">Select an environment...</span>
                )}
                <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform flex-shrink-0", envOpen && "rotate-180")} />
              </button>

              {envOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                  {displayEnvs.map((env) => {
                    const Icon = env.icon;
                    return (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => { setEnvironment(env.id); setEnvOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left",
                          environment === env.id && "bg-teal-50"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", env.bg)}>
                          <Icon className={cn("w-4 h-4", env.color)} />
                        </div>
                        <span className="flex-1 font-medium text-gray-900">{env.label}</span>
                        {environment === env.id && <Check className="w-4 h-4 text-[#0B7A90] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* CATEGORY */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-gray-500 tracking-wider uppercase">Category</label>
          </div>

          {loadingCategories ? (
            <div className="flex items-center gap-3 h-14 px-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <Loader2 className="w-5 h-5 text-[#0B7A90] animate-spin" />
              <span className="text-gray-400 text-sm">Loading categories...</span>
            </div>
          ) : (
            <div ref={catRef} className="relative">
              <button
                type="button"
                onClick={() => { setCatOpen(!catOpen); setEnvOpen(false); }}
                className={cn(
                  "w-full flex items-center h-14 px-4 rounded-2xl border bg-white shadow-sm text-left gap-3 focus:outline-none transition-all",
                  catOpen ? "border-[#0B7A90] ring-2 ring-[#0B7A90]" : "border-gray-200"
                )}
              >
                <span className="flex-1 font-medium text-gray-900">{selectedCat || 'Select a category...'}</span>
                <ChevronDown className={cn("w-5 h-5 text-gray-400 transition-transform flex-shrink-0", catOpen && "rotate-180")} />
              </button>

              {catOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                  {displayCategories.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => { setCategory(type.name); setCatOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left",
                        category === type.name && "bg-teal-50"
                      )}
                    >
                      <span className="flex-1 font-medium text-gray-900">{type.name}</span>
                      {category === type.name && <Check className="w-4 h-4 text-[#0B7A90] flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-xs text-gray-400">Helps identify the type of safety check.</p>
        </section>
      </main>

      {/* Footer CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto">
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl bg-[#0B7A90] hover:bg-[#096375] flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
