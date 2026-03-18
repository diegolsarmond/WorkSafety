import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import HomePage from '@/features/dashboard/pages/HomePage';
import UsersPage from '@/features/admin/pages/UsersPage';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import { NewAnalysis } from '@/features/analysis/NewAnalysis';
import { CameraCapture } from '@/features/analysis/CameraCapture';
import { ReviewPhotos } from '@/features/analysis/ReviewPhotos';
import { Syncing } from '@/features/analysis/Syncing';
import { RisksDetected } from '@/features/analysis/RisksDetected';
import { ReviewValidation } from '@/features/analysis/ReviewValidation';
import AnalysisDetailPage from '@/features/analysis/AnalysisDetailPage';
import { SyncQueuePage } from '@/features/sync';
import { AIQueuePage } from '@/features/ai-queue';
import { ReportsPage } from '@/features/reports';
import { PWAProvider } from '@/features/pwa';

export default function AppRouter() {
  // Use /worksafety/ in both dev and production for local testing consistency
  const basename = '/worksafety/';
  
  return (
    <BrowserRouter basename={basename}>
      <PWAProvider>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/new"
          element={
            <ProtectedRoute>
              <NewAnalysis />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/camera"
          element={
            <ProtectedRoute>
              <CameraCapture />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/review"
          element={
            <ProtectedRoute>
              <ReviewPhotos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/syncing"
          element={
            <ProtectedRoute>
              <Syncing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/risks"
          element={
            <ProtectedRoute>
              <RisksDetected />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/validation"
          element={
            <ProtectedRoute>
              <ReviewValidation />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analysis/:assessmentId"
          element={
            <ProtectedRoute>
              <AnalysisDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sync-queue"
          element={
            <ProtectedRoute>
              <SyncQueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-queue"
          element={
            <ProtectedRoute>
              <AIQueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
      </PWAProvider>
    </BrowserRouter>
  );
}
