import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';

const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const ApplicationDetailPage = lazy(() => import('./pages/admin/ApplicationDetailPage'));
const ApplicationsPage = lazy(() => import('./pages/admin/ApplicationsPage'));
const CandidateDetailPage = lazy(() => import('./pages/admin/CandidateDetailPage'));
const CandidatesPage = lazy(() => import('./pages/admin/CandidatesPage'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const JobsPage = lazy(() => import('./pages/admin/JobsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TestingDevelopment = lazy(() => import('./pages/TestingDevelopment'));
const CandidateInterviewPage = lazy(() => import('./pages/interview/CandidateInterviewPage'));

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<CareerPage />} />
        <Route path="/testing-development" element={<TestingDevelopment />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        {/* Kandidat: AI Interview via link undangan + kode akses dari HR (publik, tanpa login admin) */}
        <Route path="/interview/:token" element={<CandidateInterviewPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs" element={<JobsPage />} />
          {/* `key` memaksa remount saat pindah list umum <-> FTAP; tanpa itu React hanya mengganti props
              dan state (halaman, filter) list sebelumnya ikut terbawa ke varian lain. */}
          <Route path="candidates" element={<CandidatesPage key="general" />} />
          {/* Daftar kandidat mass hiring FTAP: halaman yang sama dengan varian kolom/filter khusus */}
          <Route path="candidates/ftap" element={<CandidatesPage key="ftap" variant="ftap" />} />
          <Route path="candidates/:id" element={<CandidateDetailPage />} />
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
