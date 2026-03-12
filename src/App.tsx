import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import { Toaster } from './components/ui/sonner';
import ApplicationDetailPage from './pages/admin/ApplicationDetailPage';
import ApplicationsPage from './pages/admin/ApplicationsPage';
import DashboardPage from './pages/admin/DashboardPage';
import JobsPage from './pages/admin/JobsPage';
import UsersPage from './pages/admin/UsersPage';
import CareerPage from './pages/CareerPage';
import ChangePasswordPage from './pages/ChangePasswordPage'
import LoginPage from './pages/LoginPage';

const App = () => {
  return (
    <BrowserRouter>
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
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
};

export default App;
