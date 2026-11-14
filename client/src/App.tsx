import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Automatically scroll window to top upon route navigation
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

// Public Pages
import { EventCatalogPage } from './pages/EventCatalogPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { TicketViewPage } from './pages/TicketViewPage';
import { LoginPage } from './pages/LoginPage';

// Dedicated Role Portals
import { OrganiserPortal } from './pages/portals/OrganiserPortal';
import { ScannerOperatorPortal } from './pages/portals/ScannerOperatorPortal';
import { GateSupervisorPortal } from './pages/portals/GateSupervisorPortal';
import { AdminPortal } from './pages/portals/AdminPortal';
import { AuditorPortal } from './pages/portals/AuditorPortal';
import { AttendeePortal } from './pages/portals/AttendeePortal';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isScanner = location.pathname.startsWith('/portal/scanner');

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-ink selection:bg-tangerine selection:text-white">
      <ScrollToTop />
      <Navbar />
      <main
        className={`flex-1 w-full mx-auto ${
          isScanner
            ? 'px-3 py-4 sm:p-6 max-w-5xl'
            : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'
        }`}
      >
        <Routes>
          {/* Public Attendee Routes */}
          <Route path="/" element={<EventCatalogPage />} />
          <Route path="/register/:id" element={<RegistrationPage />} />
          <Route path="/ticket/:id" element={<TicketViewPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Dedicated Role Account Portals */}
          <Route
            path="/portal/organiser"
            element={
              <ProtectedRoute allowedRoles={['admin', 'organiser']}>
                <OrganiserPortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/scanner"
            element={
              <ProtectedRoute allowedRoles={['admin', 'scanner_operator']}>
                <ScannerOperatorPortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/supervisor"
            element={
              <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
                <GateSupervisorPortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/auditor"
            element={
              <ProtectedRoute allowedRoles={['admin', 'auditor']}>
                <AuditorPortal />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/attendee"
            element={
              <ProtectedRoute allowedRoles={['attendee']}>
                <AttendeePortal />
              </ProtectedRoute>
            }
          />

          {/* Backward Compatibility Aliases */}
          <Route path="/portal/registrant" element={<Navigate to="/portal/attendee" replace />} />
          <Route path="/scanner" element={<Navigate to="/portal/scanner" replace />} />
          <Route path="/dashboard" element={<Navigate to="/portal/organiser" replace />} />
          <Route path="/audit" element={<Navigate to="/portal/auditor" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isScanner && <Footer />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
