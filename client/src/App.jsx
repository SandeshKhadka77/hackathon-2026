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
import { OrganizationPortalPage } from './pages/OrganizationPortalPage';
import { JVPage } from './pages/JVPage';
import { OperationsPage } from './pages/OperationsPage';
import { TenderFeedPage } from './pages/TenderFeedPage';
import { VaultPage } from './pages/VaultPage';

function App() {
  const { isAuthenticated, user } = useAuth();
  const homeRoute = user?.role === 'organization' ? '/organization' : '/dashboard';

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/access"
        element={isAuthenticated ? <Navigate to={homeRoute} replace /> : <AuthPage />}
      />
      <Route
        path="/login"
        element={<Navigate to="/access?tab=login" replace />}
      />
      <Route
        path="/signup"
        element={<Navigate to="/access?tab=signup" replace />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <TenderFeedPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/brief"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <BoardroomBriefPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bookmarks"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <BookmarksPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vault"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <VaultPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/operations"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <OperationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/jv"
        element={
          <ProtectedRoute allowedRoles={['user', 'admin']}>
            <Layout>
              <JVPage />
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
        path="/organization"
        element={
          <ProtectedRoute allowedRoles={['organization', 'admin']}>
            <Layout>
              <OrganizationPortalPage />
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