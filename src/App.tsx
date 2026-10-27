import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ThemeProvider } from './hooks/useTheme';
import { AppLayout } from './layouts/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SubjectDetailPage } from './pages/SubjectDetailPage';
import { ChapterDetailPage } from './pages/ChapterDetailPage';
import { TopicDetailPage } from './pages/TopicDetailPage';
import { JournalPage } from './pages/JournalPage';
import { SearchPage } from './pages/SearchPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ScratchpadPage } from './pages/ScratchpadPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { PandoraTimerPage } from './pages/PandoraTimerPage';
import { LoadingState } from './components/ui/LoadingState';
// SSC CGL Pages
import { SscDashboardPage } from './pages/ssc/SscDashboardPage';
import { SscSyllabusPage } from './pages/ssc/SscSyllabusPage';
import { SscSubjectPage } from './pages/ssc/SscSubjectPage';
import { SscChapterDetailPage } from './pages/ssc/SscChapterDetailPage';
import { SscPriorityPage } from './pages/ssc/SscPriorityPage';
import { SscRevisionPage } from './pages/ssc/SscRevisionPage';
import { SscPracticePage } from './pages/ssc/SscPracticePage';
import { SscMockTestsPage } from './pages/ssc/SscMockTestsPage';
import { SscCalendarPage } from './pages/ssc/SscCalendarPage';
import { SscSettingsPage } from './pages/ssc/SscSettingsPage';


// ─── Protected Route ───────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Loading StudySpace…" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// ─── Public Route (redirect if authed) ────────────────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Loading StudySpace…" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Auth routes (public only) ── */}
      <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

      {/*
        OAuth callback: Google redirects here after sign-in.
        Supabase detects the token in the URL hash and fires SIGNED_IN via
        onAuthStateChange. The PublicRoute will then redirect to "/" automatically.
      */}
      <Route path="/auth/callback" element={<PublicRoute><AuthPage /></PublicRoute>} />

      {/*
        Password-reset landing page. This must NOT be wrapped in PublicRoute
        because the user has a temporary PASSWORD_RECOVERY session when they
        arrive here. The route is intentionally unguarded (no ProtectedRoute
        either) so both authenticated and unauthenticated states work.
      */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* ── Protected app routes ── */}
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/subjects" element={<ProtectedRoute><SubjectsPage /></ProtectedRoute>} />
      <Route path="/subjects/:subjectId" element={<ProtectedRoute><SubjectDetailPage /></ProtectedRoute>} />
      <Route path="/subjects/:subjectId/chapters/:chapterId" element={<ProtectedRoute><ChapterDetailPage /></ProtectedRoute>} />
      <Route path="/subjects/:subjectId/chapters/:chapterId/topics/:topicId" element={<ProtectedRoute><TopicDetailPage /></ProtectedRoute>} />
      <Route path="/journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
      <Route path="/scratchpad" element={<ProtectedRoute><ScratchpadPage /></ProtectedRoute>} />
      <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
      <Route path="/pandora-timer" element={<ProtectedRoute><PandoraTimerPage /></ProtectedRoute>} />
      <Route path="/pomodoro" element={<ProtectedRoute><PandoraTimerPage /></ProtectedRoute>} />
      <Route path="/timer" element={<ProtectedRoute><PandoraTimerPage /></ProtectedRoute>} />
      <Route path="/focus" element={<ProtectedRoute><PandoraTimerPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* ── SSC CGL Prep routes ── */}
      <Route path="/ssc" element={<ProtectedRoute><SscDashboardPage /></ProtectedRoute>} />
      <Route path="/ssc/syllabus" element={<ProtectedRoute><SscSyllabusPage /></ProtectedRoute>} />
      <Route path="/ssc/syllabus/:subjectSlug" element={<ProtectedRoute><SscSubjectPage /></ProtectedRoute>} />
      <Route path="/ssc/chapters/:chapterId" element={<ProtectedRoute><SscChapterDetailPage /></ProtectedRoute>} />
      <Route path="/ssc/priority" element={<ProtectedRoute><SscPriorityPage /></ProtectedRoute>} />
      <Route path="/ssc/revision" element={<ProtectedRoute><SscRevisionPage /></ProtectedRoute>} />
      <Route path="/ssc/practice" element={<ProtectedRoute><SscPracticePage /></ProtectedRoute>} />
      <Route path="/ssc/mock-tests" element={<ProtectedRoute><SscMockTestsPage /></ProtectedRoute>} />
      <Route path="/ssc/calendar" element={<ProtectedRoute><SscCalendarPage /></ProtectedRoute>} />
      <Route path="/ssc/settings" element={<ProtectedRoute><SscSettingsPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
