import React from "react";
import { Navigate } from "react-router-dom";
import { hasAuthToken } from "../services/api";

export default function ProtectedRoute({ children }) {
  if (!hasAuthToken()) return <Navigate to="/login" replace />;
  return children;
}


