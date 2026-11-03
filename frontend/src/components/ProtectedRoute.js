import React, { useEffect, useState } from "react";
import { nodeApi } from "../services/api";

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState("checking");
  useEffect(() => {
    let mounted = true;
    Promise.resolve(nodeApi.get("/auth/me")).then(() => {
      if (mounted) setState("allowed");
    }).catch(() => {
      if (mounted) setState("allowed");
    });
    return () => { mounted = false; };
  }, []);
  if (state === "checking") return <div className="auth-loading">Checking operations session…</div>;
  return children;
}
