import { io } from "socket.io-client";
import { getBackendBaseUrl } from "./api";

export const connectRealtime = () => {
  const SOCKET_URL = getBackendBaseUrl();
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

