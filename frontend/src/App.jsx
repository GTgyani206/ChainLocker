import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import StudentDashboard from './pages/StudentDashboard';
import UniversityPortal from './pages/UniversityPortal';
import VerifyPortal from './pages/VerifyPortal';
import './pages/PortalPages.css';

function AppShell() {
  return (
    <div className="portal-app page-wrapper">
      <header className="portal-header">
        <div className="container portal-header-inner">
          <div className="portal-brand">
            <span className="portal-brand-mark">CL</span>
            <div>
              <p className="portal-eyebrow">ChainLocker Demo</p>
              <h1>Decentralized Certificate Verification</h1>
            </div>
          </div>

          <nav className="portal-nav" aria-label="Primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? 'portal-nav-link-active' : ''}`
              }
            >
              University Portal
            </NavLink>
            <NavLink
              to="/verify"
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? 'portal-nav-link-active' : ''}`
              }
            >
              Verify Portal
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? 'portal-nav-link-active' : ''}`
              }
            >
              Student Dashboard
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="portal-main">
        <Routes>
          <Route path="/" element={<UniversityPortal />} />
          <Route path="/verify" element={<VerifyPortal />} />
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
