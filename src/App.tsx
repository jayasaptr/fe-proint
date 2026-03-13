import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';

const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const ApplicationDetailPage = lazy(() => import('./pages/admin/ApplicationDetailPage'));
const ApplicationsPage = lazy(() => import('./pages/admin/ApplicationsPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const JobsPage = lazy(() => import('./pages/admin/JobsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<CareerPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="applications" element={<ApplicationsPage />} />

          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<div className="p-8 text-2xl font-bold text-slate-800">System Settings Placeholder</div>} />
        </Route>
      </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
};

export default App;
