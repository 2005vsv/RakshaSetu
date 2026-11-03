import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_NODE_API_BASE_URL || "http://localhost:5001";

export const connectRealtime = () => {
  const token = typeof window !== "undefined"
    ? (localStorage.getItem("safevoyage_admin_token") || localStorage.getItem("safevoyage_tourist_token") || "")
    : "";

  const socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: { token },
  });

  socket.on("connect", () => {
    socket.emit("join:admins");
  });

  return socket;
};

