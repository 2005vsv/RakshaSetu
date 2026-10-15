import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import Dashboard from "./pages/Dashboard";
import AlertsPage from "./pages/AlertsPage";
import EFIRPage from "./pages/EFIRPage";
import EFIRCreate from "./pages/EFIRCreate";
import SOSPage from "./pages/SOSPage";
import GeoPage from "./pages/GeoPage";
import PolicePage from "./pages/PolicePage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import TouristPortal from "./pages/TouristPortal";
import VerifyTouristId from "./pages/VerifyTouristId";
import TouristMonitoringPage from "./pages/TouristMonitoringPage";
import PasswordRecovery from "./pages/PasswordRecovery";
import AdminManagementPage from "./pages/AdminManagementPage";
import "./styles/tourist.css";

function App() {
  useEffect(() => {
    try {
      window.localStorage.removeItem("safevoyage.tourist.session");
      window.localStorage.removeItem("safevoyage_tourist_token");
      window.sessionStorage.removeItem("safevoyage_admin_token");
    } catch (_) {
      // Browser storage may be disabled; sessions still use the HTTP-only cookie.
    }
  }, []);
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<PasswordRecovery />} />
        <Route path="/reset-password/:token" element={<PasswordRecovery />} />
        <Route path="/verify/:id" element={<VerifyTouristId />} />
        <Route path="/tourist/*" element={<TouristPortal />} />
        <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        <Route path="/monitoring" element={<ProtectedRoute><TouristMonitoringPage /></ProtectedRoute>} />
        <Route path="/management" element={<ProtectedRoute><AdminManagementPage /></ProtectedRoute>} />
        <Route path="/efir" element={<ProtectedRoute><EFIRPage /></ProtectedRoute>} />
        <Route path="/efir/create" element={<ProtectedRoute><EFIRCreate /></ProtectedRoute>} />
        <Route path="/sos" element={<ProtectedRoute><SOSPage /></ProtectedRoute>} />
        <Route path="/geo" element={<ProtectedRoute><GeoPage /></ProtectedRoute>} />
        <Route path="/police" element={<ProtectedRoute><PolicePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
