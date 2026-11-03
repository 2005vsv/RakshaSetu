import axios from "axios";

// The web app reads and writes operational data through the MongoDB-backed Node API.
export const getBackendBaseUrl = () => {
  if (process.env.REACT_APP_NODE_API_BASE_URL) {
    const raw = process.env.REACT_APP_NODE_API_BASE_URL;
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "https://rakshasetu-backend-4775.onrender.com";
  }
  return "http://localhost:5001";
};

const NODE_API_BASE_URL = getBackendBaseUrl();

export const nodeApi = axios.create({ baseURL: NODE_API_BASE_URL, withCredentials: true });

// Attach portal context & token to every request so admin console, police portal, and tourist portal never conflict
nodeApi.interceptors.request.use((config) => {
  const isTourist = typeof window !== "undefined" && window.location.pathname.startsWith("/tourist");
  const isPolice = typeof window !== "undefined" && window.location.pathname.startsWith("/police");
  if (isTourist) {
    config.headers["X-Portal"] = "tourist";
  } else if (isPolice) {
    config.headers["X-Portal"] = "police";
    try {
      const policeToken = localStorage.getItem("safevoyage_police_token");
      if (policeToken) {
        config.headers.Authorization = `Bearer ${policeToken}`;
      }
    } catch (_) { }
  } else {
    config.headers["X-Portal"] = "admin";
    try {
      const adminToken = localStorage.getItem("safevoyage_admin_token");
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    } catch (_) { }
  }
  return config;
});

export const clearAdminAuthToken = () => {
  try {
    localStorage.removeItem("safevoyage_admin_token");
  } catch (_) { }
};

export const clearPoliceAuthToken = () => {
  try {
    localStorage.removeItem("safevoyage_police_token");
    localStorage.removeItem("rakshasetu_police_officer_id");
  } catch (_) { }
};

export const clearApiToken = () => {
  try {
    localStorage.removeItem("safevoyage_tourist_token");
  } catch (_) { }
};

// Optional helper kept for compatibility with main
export const createEfir = async (efirData) => {
  const response = await nodeApi.post('/efir', efirData);
  return response.data;
};

export const endpointsNode = {
  efirPending: "/efir/pending",
  efirVerify: (id) => `/efir/verify/${id}`,
  assignAlert: (alertId) => `/alerts/${alertId}/assign`,
  resolveAlert: (alertId) => `/alerts/${alertId}/resolve`,
};

const apiClient = { nodeApi, endpointsNode };

export default apiClient;
