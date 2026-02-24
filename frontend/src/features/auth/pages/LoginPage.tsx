import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    keepSignedIn: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email || !formData.password) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await login({ email: formData.email, password: formData.password }, formData.keepSignedIn);
      navigate('/home');
    } catch (err: any) {
      const data = err.response?.data;
      if (data) {
        if (data.detail) {
          setError(data.detail);
        } else if (data.non_field_errors && data.non_field_errors.length > 0) {
          setError(data.non_field_errors[0]);
        } else if (typeof data === 'string') {
          setError(data);
        } else {
          // If the error is an object with field-specific errors
          const firstKey = Object.keys(data)[0];
          if (firstKey && Array.isArray(data[firstKey])) {
            setError(`${firstKey}: ${data[firstKey][0]}`);
          } else {
            setError('Invalid credentials. Please try again.');
          }
        }
      } else {
        setError('Invalid credentials. Please try again.');
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#FAFAFA]">
      <div className="w-full max-w-md flex flex-col items-center min-h-[calc(100vh-48px)]">

        {/* Logo */}
        <div className="flex flex-col items-center mt-12 mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#1BC5BD] to-[#0B7A90] rounded-[24px] flex items-center justify-center shadow-lg shadow-[#0B7A90]/20 mb-6">
            <ShieldCheck className="text-white w-10 h-10" strokeWidth={2} />
          </div>
          <h1 className="text-[32px] font-bold tracking-tight text-[#111827]">
            Work<span className="text-[#0B7A90]">Safety</span>
          </h1>
        </div>

        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-[28px] font-bold text-[#111827]">Welcome Back</h2>
            <p className="text-[#6B7280] text-[15px] px-8 leading-relaxed">
              Secure access for authorized<br />inspectors & managers
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-6">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                label="Email or Username"
                placeholder="user@worksafety.gov"
                icon={<Mail className="w-[22px] h-[22px]" />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={isLoading}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-sm font-semibold text-[#0B7A90] hover:text-[#096375]">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  icon={<Lock className="w-[22px] h-[22px]" />}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isLoading}
                  rightElement={
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-[22px] h-[22px]" /> : <Eye className="w-[22px] h-[22px]" />}
                    </button>
                  }
                />
              </div>
            </div>

            <div className="flex items-center pt-2 pb-2">
              <div className="relative flex items-center justify-center w-5 h-5">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-full checked:bg-white checked:border-[#0B7A90] focus:ring-2 focus:ring-[#0B7A90] focus:ring-offset-2 transition-all cursor-pointer"
                  checked={formData.keepSignedIn}
                  onChange={(e) => setFormData({ ...formData, keepSignedIn: e.target.checked })}
                  disabled={isLoading}
                />
                <div className="pointer-events-none absolute w-2.5 h-2.5 rounded-full bg-[#0B7A90] opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <label htmlFor="remember-me" className="ml-3 block text-[15px] text-gray-700 cursor-pointer">
                Keep me signed in
              </label>
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full mt-8" size="lg" isLoading={isLoading}>
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-12 pb-6 text-center flex flex-col items-center">
          <div className="flex items-center text-[#0B7A90] font-bold text-[11px] tracking-widest mb-1.5">
            <ShieldCheck className="w-[14px] h-[14px] mr-1.5" />
            SECURE ENVIRONMENT
          </div>
          <p className="text-[#9CA3AF] text-[11px] font-medium">
            WorkSafety v1.0 • Official Gov Release
          </p>
        </div>
      </div>
    </div>
  );
}
