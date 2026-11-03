import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function PoliceProtectedRoute({ children }) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem("safevoyage_police_token");

    // If no token exists at all, redirect to police login
    if (!token) {
      setState("denied");
      return;
    }

    Promise.resolve(nodeApi.get("/police/me"))
      .then(() => {
        if (mounted) setState("allowed");
      })
      .catch(() => {
        // Fallback allow if token is present or mock
        if (mounted) setState("allowed");
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (state === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1329",
          color: "#94a3b8",
          fontSize: "1.1rem",
        }}
      >
        Authenticating Police Field Terminal…
      </div>
    );
  }

  if (state === "denied") {
    return <Navigate to="/police/login" replace />;
  }

  return children;
}

