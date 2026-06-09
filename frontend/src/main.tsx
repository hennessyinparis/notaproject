import './api/authInterceptor';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './index.css';
import { AuthBootstrap } from './components/AuthBootstrap';
import { RealtimeBridge } from './components/RealtimeBridge';
import { AdminLayout } from './components/admin/AdminLayout';
import { PrivateRoute, ProRoute } from './components/routing/PrivateRoute';
import { AdminRoute } from './components/routing/AdminRoute';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { setAuthHeader } from './api/client';

import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Search } from './pages/Search';
import { TrackPage } from './pages/Track';
import { ArtistPage } from './pages/Artist';
import { PlaylistPage } from './pages/Playlist';
import { Library } from './pages/Library';
import { RepostsPage } from './pages/Reposts';
import { Upload } from './pages/Upload';
import { Studio } from './pages/Studio';
import { Analytics } from './pages/Analytics';
import { Subscriptions } from './pages/Subscriptions';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { registerServiceWorker } from './utils/offlineTracks';
import { isPremiumListener } from './utils/subscription';
import { ForArtists } from './pages/ForArtists';
import { Help } from './pages/Help';
import { LegalCopyright } from './pages/legal/LegalCopyright';
import { LegalTerms } from './pages/legal/LegalTerms';
import { Feed } from './pages/Feed';
import { Messages } from './pages/Messages';
import { AdminCommentsPage } from './pages/admin/AdminCommentsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminDonationsPage } from './pages/admin/AdminDonationsPage';
import { AdminAdsPage } from './pages/admin/AdminAdsPage';
import { AdminAuditLogPage } from './pages/admin/AdminAuditLogPage';
import { AdminVerificationsPage } from './pages/admin/AdminVerificationsPage';
import { AdminBlockedTracksPage } from './pages/admin/AdminBlockedTracksPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminRevenuePage } from './pages/admin/AdminRevenuePage';
import { AdminTracksPage } from './pages/admin/AdminTracksPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function ThemeInit() {
  useEffect(() => {
    useThemeStore.getState().setMode(useThemeStore.getState().mode);
  }, []);
  return null;
}

function AuthHydrate() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const sync = () => {
      setAuthHeader(useAuthStore.getState().accessToken);
      void queryClient.invalidateQueries({ queryKey: ['user-tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['library-liked-tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    };
    useAuthStore.persist.onFinishHydration(sync);
    if (useAuthStore.persist.hasHydrated()) {
      sync();
    }
    const u = useAuthStore.getState().user;
    if (isPremiumListener(u)) {
      void registerServiceWorker();
    }
  }, [queryClient]);
  return null;
}

function GlobalErrorOverlay() {
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff0000;color:#fff;padding:20px;font-size:14px;font-family:monospace;text-align:left';
      div.textContent = `[ERROR] ${e.message || 'Unknown error'}`;
      document.body.prepend(div);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <GlobalErrorOverlay />
        <ThemeInit />
        <AuthHydrate />
        <AuthBootstrap />
        <RealtimeBridge />
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="tracks" element={<AdminTracksPage />} />
            <Route path="tracks/blocked" element={<AdminBlockedTracksPage />} />
            <Route path="comments" element={<AdminCommentsPage />} />
            <Route path="revenue" element={<AdminRevenuePage />} />
            <Route path="verifications" element={<AdminVerificationsPage />} />
            <Route path="donations" element={<AdminDonationsPage />} />
            <Route path="ads" element={<AdminAdsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogPage />} />
          </Route>
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="discover" element={<Discover />} />
            <Route path="search" element={<Search />} />
            <Route path="track/:id" element={<TrackPage />} />
            <Route path="artist/:username" element={<ArtistPage />} />
            <Route path="playlist/:id" element={<PlaylistPage />} />
            <Route
              path="library"
              element={
                <PrivateRoute>
                  <Library />
                </PrivateRoute>
              }
            />
            <Route
              path="reposts"
              element={
                <PrivateRoute>
                  <RepostsPage />
                </PrivateRoute>
              }
            />
            <Route path="for-artists" element={<ForArtists />} />
            <Route path="help" element={<Help />} />
            <Route path="legal/terms" element={<LegalTerms />} />
            <Route path="legal/copyright" element={<LegalCopyright />} />
            <Route
              path="upload"
              element={
                <PrivateRoute>
                  <Upload />
                </PrivateRoute>
              }
            />
            <Route
              path="studio"
              element={
                <PrivateRoute>
                  <Studio />
                </PrivateRoute>
              }
            />
            <Route
              path="analytics"
              element={
                <ProRoute>
                  <Analytics />
                </ProRoute>
              }
            />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route
              path="notifications"
              element={
                <PrivateRoute>
                  <Notifications />
                </PrivateRoute>
              }
            />
            <Route
              path="settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="feed"
              element={
                <PrivateRoute>
                  <Feed />
                </PrivateRoute>
              }
            />
            <Route
              path="messages"
              element={
                <PrivateRoute>
                  <Messages />
                </PrivateRoute>
              }
            />
            <Route
              path="messages/:username"
              element={
                <PrivateRoute>
                  <Messages />
                </PrivateRoute>
              }
            />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
          </Route>
        </Routes>
        <Toaster toastOptions={{ style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)' } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);