import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, AlertTriangle, ShieldCheck, FileText, MapPin, XCircle, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/ui/components/Button';

export function RisksDetected() {
  const navigate = useNavigate();

  const risks = [
    { id: 1, title: 'Missing Guardrail', location: 'Platform L2', severity: 'CRITICAL', action: 'Immediate Install' },
    { id: 2, title: 'PPE Violation', location: 'Zone A', severity: 'HIGH', action: 'Warning Issued' },
    { id: 3, title: 'Blocked Exit', location: 'Corridor B', severity: 'MEDIUM', action: 'Clear Area' },
  ];

  const handleConfirm = () => {
    navigate('/inspection/validation');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white shadow-sm">
        <button onClick={() => navigate('/home')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 ml-4">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Risks Detected</h1>
          <p className="text-sm text-gray-500">Case #12345 • Validation</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Download className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto pb-24">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm tracking-widest uppercase">
              <AlertTriangle className="w-4 h-4" /> Total Risks
            </div>
            <span className="text-5xl font-black text-gray-900">05</span>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-teal-600 font-bold text-sm tracking-widest uppercase">
              <ShieldCheck className="w-4 h-4" /> Compliance
            </div>
            <span className="text-5xl font-black text-gray-900">82%</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <FileText className="w-5 h-5 text-teal-600" /> Action Checklist
            </div>
            <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
              JAN 10, 2026
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {risks.map((risk) => (
              <div key={risk.id} className="p-4 flex gap-4">
                <div className="mt-1">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{risk.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
                    <MapPin className="w-4 h-4" /> {risk.location}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider ${risk.severity === 'CRITICAL' ? 'bg-red-50 text-red-600' :
                      risk.severity === 'HIGH' ? 'bg-orange-50 text-orange-600' :
                        'bg-slate-100 text-slate-600'
                    }`}>
                    {risk.severity}
                  </span>
                  <p className="mt-3 text-gray-700 font-medium">{risk.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex gap-4">
        <Button
          variant="ghost"
          className="flex-1 h-14 text-lg text-red-500 hover:bg-red-50 font-bold"
        >
          <XCircle className="w-6 h-6 mr-2" /> Reject
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1 h-14 text-lg bg-gray-100 text-gray-400 hover:bg-gray-200 font-bold border-none"
        >
          Confirm <Send className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
