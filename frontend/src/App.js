import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import Dashboard from "./pages/Dashboard";
import AlertsPage from "./pages/AlertsPage";
import EFIRPage from "./pages/EFIRPage";
import EFIRCreate from "./pages/EFIRCreate";
import SOSPage from "./pages/SOSPage";
import GeoPage from "./pages/GeoPage";
import PolicePage from "./pages/PolicePage";
import PoliceLogin from "./pages/PoliceLogin";
import PoliceSignup from "./pages/PoliceSignup";
import PoliceProtectedRoute from "./components/PoliceProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import TouristPortal from "./pages/TouristPortal";
import VerifyTouristId from "./pages/VerifyTouristId";
import TouristMonitoringPage from "./pages/TouristMonitoringPage";
import PasswordRecovery from "./pages/PasswordRecovery";
import AdminManagementPage from "./pages/AdminManagementPage";
import AnomalyDetectionPage from "./pages/AnomalyDetectionPage";
import "./styles/tourist.css";

function App() {
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
        <Route path="/anomalies" element={<ProtectedRoute><AnomalyDetectionPage /></ProtectedRoute>} />
        <Route path="/monitoring" element={<ProtectedRoute><TouristMonitoringPage /></ProtectedRoute>} />
        <Route path="/management" element={<ProtectedRoute><AdminManagementPage /></ProtectedRoute>} />
        <Route path="/efir" element={<ProtectedRoute><EFIRPage /></ProtectedRoute>} />
        <Route path="/efir/create" element={<ProtectedRoute><EFIRCreate /></ProtectedRoute>} />
        <Route path="/sos" element={<ProtectedRoute><SOSPage /></ProtectedRoute>} />
        <Route path="/geo" element={<ProtectedRoute><GeoPage /></ProtectedRoute>} />
        <Route path="/police/login" element={<PoliceLogin />} />
        <Route path="/police/signup" element={<PoliceSignup />} />
        <Route path="/police" element={<PoliceProtectedRoute><PolicePage /></PoliceProtectedRoute>} />
        <Route path="/police/dashboard" element={<Navigate to="/police" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
