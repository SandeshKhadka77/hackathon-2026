import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { BoardroomBriefPage } from './pages/BoardroomBriefPage';
import { BookmarksPage } from './pages/BookmarksPage';
import { LandingPage } from './pages/LandingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OperationsPage } from './pages/OperationsPage';
import { TenderFeedPage } from './pages/TenderFeedPage';
import { VaultPage } from './pages/VaultPage';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage mode="signup" />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <TenderFeedPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/brief"
        element={
          <ProtectedRoute>
            <Layout>
              <BoardroomBriefPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute>
            <Layout>
              <BookmarksPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vault"
        element={
          <ProtectedRoute>
            <Layout>
              <VaultPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/operations"
        element={
          <ProtectedRoute>
            <Layout>
              <OperationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Layout>
              <NotificationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;