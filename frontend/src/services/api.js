import axios from "axios";

// The web app reads and writes operational data through the MongoDB-backed Node API.
const NODE_API_BASE_URL = process.env.REACT_APP_NODE_API_BASE_URL || "http://localhost:5000";

export const nodeApi = axios.create({ baseURL: NODE_API_BASE_URL, withCredentials: true });
export const clearAdminAuthToken = () => {};
export const clearApiToken = () => {};

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


