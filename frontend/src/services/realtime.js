import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_NODE_API_BASE_URL || "http://localhost:5000";
export const connectRealtime = () => io(SOCKET_URL, { withCredentials: true, transports: ["websocket", "polling"] });
