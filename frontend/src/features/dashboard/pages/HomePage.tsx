import { Button } from '@/ui/components/Button';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ShieldCheck, Plus, CloudOff, AlertTriangle, Building2, Factory, Box } from 'lucide-react';

export default function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="bg-white px-4 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button className="p-2 text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1BC5BD] to-[#0B7A90] rounded-lg flex items-center justify-center shadow-sm">
              <ShieldCheck className="text-white w-5 h-5" strokeWidth={2} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#111827]">
              Work<span className="text-[#0B7A90]">Safety</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            <CloudOff className="w-3.5 h-3.5" />
            OFFLINE
          </button> */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-[32px] bg-[#0B7A90] p-8 text-white shadow-xl shadow-[#0B7A90]/20 mb-8">
          {/* Background Pattern */}
          <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M140 40H160V60" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M160 140V160H140" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M60 160H40V140" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M40 60V40H60" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M120 80C120 80 110 100 100 100C90 100 80 80 80 80" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="85" cy="70" r="4" fill="white" />
              <circle cx="115" cy="70" r="4" fill="white" />
              <path d="M170 30L175 25M175 25L180 30M175 25V35" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="relative z-10">
            <button className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 hover:bg-white/30 transition-colors">
              <Plus className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-[32px] leading-tight font-bold mb-3">
              New<br />Analysis
            </h2>
            <p className="text-[#85D1DF] text-[15px] mb-8 max-w-[200px] leading-relaxed">
              Start an AI risk analysis in seconds.
            </p>
            <Button className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-none rounded-2xl px-6 py-3 h-auto font-semibold">
              Start Now <span className="ml-2">›</span>
            </Button>
          </div>
        </div>

        {/* Pending Analysis */}
        <div>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[19px] font-bold text-[#111827]">Pending Analysis</h3>
            <span className="px-3 py-1 bg-gray-100 text-[#4B5563] text-[11px] font-bold rounded-full tracking-wider">
              3 PENDING
            </span>
          </div>

          <div className="space-y-4">
            {/* Card 1 */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[52px] h-[52px] rounded-2xl bg-[#FFF3E0] flex items-center justify-center text-[#F57C00]">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] text-[16px]">North Sector</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[13px] text-gray-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      10/01
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    <span className="text-[13px] font-semibold text-gray-500">Not synced</span>
                  </div>
                </div>
              </div>
              <div className="text-[#F5A623]">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[52px] h-[52px] rounded-2xl bg-[#E3F2FD] flex items-center justify-center text-[#1976D2]">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] text-[16px]">Assembly</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[13px] text-gray-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      09/01
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    <span className="text-[13px] font-semibold text-gray-500">Not synced</span>
                  </div>
                </div>
              </div>
              <div className="text-[#F5A623]">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-[52px] h-[52px] rounded-2xl bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] text-[16px]">External</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[13px] text-gray-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      08/01
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                    <span className="text-[13px] font-semibold text-gray-500">Not synced</span>
                  </div>
                </div>
              </div>
              <div className="text-[#F5A623]">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
