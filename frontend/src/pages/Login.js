import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/admin.css";
import { nodeApi } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await nodeApi.post("/auth/login", { email: email.trim(), password });
      if (data.token) {
        localStorage.setItem("safevoyage_admin_token", data.token);
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Invalid administrator credentials.");
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
        background: "linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #112a24 100%)",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #116d58 0%, #0f4c3e 100%)",
            padding: "24px 28px",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.15)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              margin: "0 auto 12px",
            }}
          >
            🛡️
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.45rem", fontWeight: 800 }}>
            RakshaSetu Operations
          </h1>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>
            Central Administrator & Control Room Terminal
          </p>
        </div>

        <div style={{ padding: "28px 24px" }}>
          {error && (
            <div
              style={{
                color: "#991b1b",
                background: "#fee2e2",
                border: "1px solid #fecaca",
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 5,
                    textTransform: "uppercase",
                  }}
                >
                  Admin Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@rakshasetu.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "#f8fafc",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#334155",
                      textTransform: "uppercase",
                    }}
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    style={{ fontSize: "0.8rem", color: "#116d58", fontWeight: 600, textDecoration: "none" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "#f8fafc",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                className="btn"
                disabled={loading}
                type="submit"
                style={{
                  marginTop: 6,
                  padding: "12px 16px",
                  background: "#116d58",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(17, 109, 88, 0.3)",
                }}
              >
                {loading ? "Authenticating…" : "Sign In to Operations Console"}
              </button>

              <div
                style={{
                  marginTop: 10,
                  paddingTop: 16,
                  borderTop: "1px solid #e2e8f0",
                  textAlign: "center",
                  fontSize: "0.88rem",
                  color: "#64748b",
                }}
              >
                Need operations access?{" "}
                <Link
                  to="/signup"
                  style={{ color: "#116d58", fontWeight: 700, textDecoration: "underline" }}
                >
                  Create Admin Account
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
