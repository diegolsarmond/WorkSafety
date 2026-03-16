import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import HomePage from '@/features/dashboard/pages/HomePage';
import UsersPage from '@/features/admin/pages/UsersPage';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import { NewInspection } from '@/features/inspection/NewInspection';
import { CameraCapture } from '@/features/inspection/CameraCapture';
import { ReviewPhotos } from '@/features/inspection/ReviewPhotos';
import { Syncing } from '@/features/inspection/Syncing';
import { RisksDetected } from '@/features/inspection/RisksDetected';
import { ReviewValidation } from '@/features/inspection/ReviewValidation';
import { SyncQueuePage } from '@/features/sync';
import { AIQueuePage } from '@/features/ai-queue';
import { ReportsPage } from '@/features/reports';

export default function AppRouter() {
  return (
    <BrowserRouter>
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
          path="/inspection/new"
          element={
            <ProtectedRoute>
              <NewInspection />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspection/camera"
          element={
            <ProtectedRoute>
              <CameraCapture />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspection/review"
          element={
            <ProtectedRoute>
              <ReviewPhotos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspection/syncing"
          element={
            <ProtectedRoute>
              <Syncing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspection/risks"
          element={
            <ProtectedRoute>
              <RisksDetected />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inspection/validation"
          element={
            <ProtectedRoute>
              <ReviewValidation />
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
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
