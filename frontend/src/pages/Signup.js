import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/admin.css";
import { nodeApi } from "../services/api";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    adminRole: "super_admin",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await nodeApi.post("/auth/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        adminRole: formData.adminRole,
      });

      if (data.token) {
        localStorage.setItem("safevoyage_admin_token", data.token);
      }

      window.alert("✅ Administrator Account Created Successfully! Welcome to Central Operations.");
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Registration failed. An account with this email may already exist."
      );
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
        padding: "30px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
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
            Register Operations Account
          </h1>
          <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.85 }}>
            Create Central Administrator & Dispatch Credentials
          </p>
        </div>

        <div style={{ padding: "28px 26px" }}>
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
                  Full Administrator Name
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Inspector General Rajesh Sharma"
                  value={formData.name}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 13px",
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
                  Official Admin Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="admin.hq@rakshasetu.gov.in"
                  value={formData.email}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 13px",
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
                  Operations Role
                </label>
                <select
                  name="adminRole"
                  value={formData.adminRole}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 13px",
                    background: "#f8fafc",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                >
                  <option value="super_admin">Super Administrator (Full System Operations)</option>
                  <option value="monitoring_officer">Monitoring Officer (Live Map & GPS Tracking)</option>
                  <option value="responder">Field Responder (Incident Management)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 13px",
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
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    required
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 13px",
                      background: "#f8fafc",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: "0.95rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <button
                className="btn"
                disabled={loading}
                type="submit"
                style={{
                  marginTop: 8,
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
                {loading ? "Creating Account…" : "Create Administrator Account"}
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
                Already have operations access?{" "}
                <Link
                  to="/login"
                  style={{ color: "#116d58", fontWeight: 700, textDecoration: "underline" }}
                >
                  Sign In
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
