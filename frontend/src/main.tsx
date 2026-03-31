import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './index.css';
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
import { Upload } from './pages/Upload';
import { Studio } from './pages/Studio';
import { Analytics } from './pages/Analytics';
import { Subscriptions } from './pages/Subscriptions';
import { Notifications } from './pages/Notifications';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForArtists } from './pages/ForArtists';
import { Feed } from './pages/Feed';
import { Messages } from './pages/Messages';
import { AdminPage } from './pages/Admin';

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
  useEffect(() => {
    useAuthStore.persist.onFinishHydration(() => {
      setAuthHeader(useAuthStore.getState().accessToken);
    });
    const t = useAuthStore.getState().accessToken;
    if (t) setAuthHeader(t);
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ThemeInit />
        <AuthHydrate />
        <Routes>
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
            <Route path="for-artists" element={<ForArtists />} />
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
            <Route path="profile/:username" element={<ArtistPage />} />
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
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
        <Toaster toastOptions={{ style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)' } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
