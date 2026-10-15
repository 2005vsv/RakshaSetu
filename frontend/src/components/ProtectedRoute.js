import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState("checking");
  useEffect(() => {
    let mounted = true;
    Promise.resolve(nodeApi.get("/auth/me")).then(({ data }) => {
      if (mounted) setState(data.role === "admin" ? "allowed" : "denied");
    }).catch(() => { if (mounted) setState("denied"); });
    return () => { mounted = false; };
  }, []);
  if (state === "checking") return <div className="auth-loading">Checking your session…</div>;
  if (state !== "allowed") return <Navigate to="/login" replace />;
  return children;
}


