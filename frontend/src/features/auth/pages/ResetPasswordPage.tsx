import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { authService } from '@/services/auth/authService';
import { Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or expired reset token');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(formData.password, token);
      navigate('/login', { state: { message: 'Password reset successfully. Please login.' } });
    } catch (err) {
      setError('Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#FAFAFA]">
        <div className="w-full max-w-md flex flex-col items-center min-h-[calc(100vh-48px)]">
          <div className="flex flex-col items-center mt-12 mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1BC5BD] to-[#0B7A90] rounded-[24px] flex items-center justify-center shadow-lg shadow-[#0B7A90]/20 mb-6">
              <ShieldCheck className="text-white w-10 h-10" strokeWidth={2} />
            </div>
          </div>
          <div className="w-full space-y-8 text-center">
            <h2 className="text-[28px] font-bold text-red-600">Invalid Link</h2>
            <p className="text-[#6B7280] text-[15px] px-8 leading-relaxed">
              This password reset link is invalid or has expired.
            </p>
            <div className="mt-8">
              <Link to="/forgot-password">
                <Button className="w-full" size="lg">Request New Link</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#FAFAFA]">
      <div className="w-full max-w-md flex flex-col items-center min-h-[calc(100vh-48px)]">
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
            <h2 className="text-[28px] font-bold text-[#111827]">Set new password</h2>
            <p className="text-[#6B7280] text-[15px] px-8 leading-relaxed">
              Please enter your new password below
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              label="New Password"
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

            <Input
              id="confirm-password"
              name="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              label="Confirm Password"
              placeholder="••••••••"
              icon={<Lock className="w-[22px] h-[22px]" />}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={isLoading}
              rightElement={
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-[22px] h-[22px]" /> : <Eye className="w-[22px] h-[22px]" />}
                </button>
              }
            />

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
              Reset Password
            </Button>

            <div className="text-center mt-6">
              <Link to="/login" className="text-[15px] font-semibold text-[#0B7A90] hover:text-[#096375]">
                Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
