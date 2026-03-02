import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/components/Button';
import { Input } from '@/ui/components/Input';
import { authService } from '@/services/auth/authService';
import { Mail, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      // Generic error message for security
      setError('If an account exists with this email, you will receive a reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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

          <div className="w-full space-y-8 text-center">
            <h2 className="text-[28px] font-bold text-[#111827]">Check your email</h2>
            <p className="text-[#6B7280] text-[15px] px-8 leading-relaxed">
              If an account exists with {email}, we have sent a password reset link.
            </p>
            <div className="mt-8">
              <Link to="/login">
                <Button className="w-full" size="lg">Back to Login</Button>
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
            <h2 className="text-[28px] font-bold text-[#111827]">Reset Password</h2>
            <p className="text-[#6B7280] text-[15px] px-8 leading-relaxed">
              Enter your email to receive a reset link
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              label="Email address"
              placeholder="user@worksafety.gov"
              icon={<Mail className="w-[22px] h-[22px]" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
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
              Send Reset Link
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
