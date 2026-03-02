import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Factory, HardHat, Check } from 'lucide-react';
import { Button } from '@/ui/components/Button';
import { useInspectionStore } from '../../store/inspectionStore';
import { cn } from '@/utils/cn';

export function NewInspection() {
  const navigate = useNavigate();
  const { environment, setEnvironment, category, setCategory } = useInspectionStore();

  const environments = [
    { id: 'construction', label: 'Construction', icon: Building2, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'industry', label: 'Industry', icon: Factory, color: 'text-slate-600', bg: 'bg-slate-50' },
    { id: 'other', label: 'Other', icon: HardHat, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  const handleContinue = () => {
    if (environment) {
      navigate('/inspection/camera');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold text-gray-900 mr-8">New Inspection</h1>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-8 overflow-y-auto pb-24">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 tracking-wider">STEP 1: ENVIRONMENT</h2>
            <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md">Mandatory</span>
          </div>

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

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent text-lg font-bold text-gray-900 focus:outline-none appearance-none"
            >
              <option value="General Safety">General Safety</option>
              <option value="Electrical">Electrical</option>
              <option value="Fire Safety">Fire Safety</option>
              <option value="Ergonomics">Ergonomics</option>
            </select>
            <div className="pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
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
