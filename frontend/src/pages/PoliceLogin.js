import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nodeApi } from "../services/api";
import "../styles/admin.css";

export default function PoliceLogin() {
  const navigate = useNavigate();
  const [emailOrBadge, setEmailOrBadge] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await nodeApi.post("/police/login", {
        emailOrBadge,
        password,
      });

      if (data.token) {
        localStorage.setItem("safevoyage_police_token", data.token);
      }
      if (data.officer?.id) {
        localStorage.setItem("rakshasetu_police_officer_id", data.officer.id);
      }
      navigate("/police");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Officer login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e1b4b 100%)",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#1e293b",
          border: "2px solid #3b82f6",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.2)",
          overflow: "hidden",
        }}
      >
        {/* Police Badge Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)",
            borderBottom: "1px solid #334155",
            padding: "28px 24px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#1d4ed8",
              border: "3px solid #60a5fa",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              marginBottom: 12,
              boxShadow: "0 0 15px rgba(96, 165, 250, 0.5)",
            }}
          >
            👮
          </div>
          <span
            style={{
              display: "inline-block",
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.72rem",
              fontWeight: "900",
              letterSpacing: 1.5,
              padding: "2px 8px",
              borderRadius: 4,
              marginBottom: 6,
            }}
          >
            OFFICIAL POLICE TERMINAL
          </span>
          <h1 style={{ margin: "4px 0", fontSize: "1.45rem", fontWeight: "800", color: "#f8fafc" }}>
            Police Field Dispatch Sign In
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>
            RakshaSetu · Law Enforcement & Emergency Dispatch
          </p>
        </div>

        {/* Login Form Body */}
        <div style={{ padding: "24px 28px" }}>
          {error && (
            <div
              style={{
                background: "#450a0a",
                border: "1px solid #ef4444",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: "0.88rem",
                marginBottom: 16,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  color: "#cbd5e1",
                  fontSize: "0.82rem",
                  fontWeight: "bold",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Official Email or Police Badge ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. KA-BGM-PCR-101 or officer@police.gov.in"
                value={emailOrBadge}
                onChange={(e) => setEmailOrBadge(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "#0f172a",
                  color: "#f8fafc",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  color: "#cbd5e1",
                  fontSize: "0.82rem",
                  fontWeight: "bold",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                Access Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "#0f172a",
                  color: "#f8fafc",
                  border: "1px solid #475569",
                  borderRadius: 8,
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                padding: "12px 16px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
              }}
            >
              {loading ? "Verifying Credentials…" : "🚨 Sign In to Police Terminal"}
            </button>
          </form>

          {/* Links Footer */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #334155",
              textAlign: "center",
              fontSize: "0.88rem",
            }}
          >
            <span style={{ color: "#94a3b8" }}>New officer joining dispatch? </span>
            <Link
              to="/police/signup"
              style={{ color: "#38bdf8", fontWeight: "bold", textDecoration: "underline" }}
            >
              Register Police Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

