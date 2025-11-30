import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProviderComponent } from './components/Notification';
import { useAuthStore } from './stores/auth.store';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DynamicCRUDPage } from './pages/DynamicCRUDPage';
import { FileManagementPage } from './pages/FileManagementPage';
import { modelConfigs } from './config/models.config';
import { isFileStorageEnabled } from './config/features.config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    console.log('AppRoutes mounted, checking auth...');
    checkAuth();
  }, [checkAuth]);

  console.log('Auth state:', { isAuthenticated, isLoading });

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        {/* File management with specialized page (only if enabled) */}
        {isFileStorageEnabled() && (
          <Route path="/files" element={<FileManagementPage />} />
        )}
        {/* Dynamically generate routes for all other models */}
        {Object.values(modelConfigs)
          .filter((config) => config.name !== 'file') // Exclude file model from dynamic routes
          .map((config) => (
            <Route
              key={config.name}
              path={`/${config.plural}`}
              element={<DynamicCRUDPage />}
            />
          ))}
      </Route>
    </Routes>
  );
}

export function App() {
  console.log('App component rendering');
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProviderComponent>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </NotificationProviderComponent>
    </QueryClientProvider>
  );
}