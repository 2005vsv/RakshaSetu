import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nodeApi } from "../services/api";
import "../styles/admin.css";

export default function PoliceSignup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    policeBadge: "",
    policeStation: "Udyambag Police Station, Belagavi",
    policeRank: "Sub-Inspector",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await nodeApi.post("/police/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        policeBadge: formData.policeBadge,
        policeStation: formData.policeStation,
        policeRank: formData.policeRank,
      });

      if (data.token) {
        localStorage.setItem("safevoyage_police_token", data.token);
      }
      if (data.officer?.id) {
        localStorage.setItem("rakshasetu_police_officer_id", data.officer.id);
      }

      window.alert("✅ Police Officer Account Registered Successfully! Welcome to Field Operations.");
      navigate("/police");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          "Registration failed. An officer with this email or badge ID may already exist."
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
        background: "linear-gradient(135deg, #090e1a 0%, #0f172a 50%, #1e1b4b 100%)",
        padding: "30px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#1e293b",
          border: "2px solid #3b82f6",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(59, 130, 246, 0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)",
            borderBottom: "1px solid #334155",
            padding: "24px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#1d4ed8",
              border: "3px solid #60a5fa",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              marginBottom: 10,
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
              marginBottom: 4,
            }}
          >
            OFFICIAL REGISTRATION
          </span>
          <h1 style={{ margin: "2px 0 4px", fontSize: "1.45rem", fontWeight: "800", color: "#f8fafc" }}>
            Register Police Officer Profile
          </h1>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>
            Join the RakshaSetu Law Enforcement Emergency Network
          </p>
        </div>

        {/* Signup Form */}
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

          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  OFFICER FULL NAME *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Inspector Santosh Patil"
                  value={formData.name}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  POLICE BADGE / PCR ID *
                </label>
                <input
                  type="text"
                  name="policeBadge"
                  required
                  placeholder="e.g. KA-BGM-PCR-501"
                  value={formData.policeBadge}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                ASSIGNED POLICE STATION *
              </label>
              <input
                type="text"
                name="policeStation"
                required
                placeholder="e.g. Udyambag Police Station, Belagavi"
                value={formData.policeStation}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  OFFICIAL EMAIL *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="officer@police.gov.in"
                  value={formData.email}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  CONTACT PHONE *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="e.g. 0831 240 5238"
                  value={formData.phone}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                DESIGNATION / RANK
              </label>
              <select
                name="policeRank"
                value={formData.policeRank}
                onChange={handleChange}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="Sub-Inspector">Sub-Inspector (SI)</option>
                <option value="Police Inspector">Police Inspector (PI)</option>
                <option value="Head Constable">Head Constable (HC)</option>
                <option value="Patrol Officer">PCR Patrol Officer</option>
                <option value="Station Officer">Station Duty Officer</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  PASSWORD *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: "bold", marginBottom: 4 }}>
                  CONFIRM PASSWORD *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  placeholder="Repeat password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8,
                padding: "13px 18px",
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
              {loading ? "Registering Officer Profile…" : "👮 Complete Registration & Open Dispatch"}
            </button>
          </form>

          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px solid #334155",
              textAlign: "center",
              fontSize: "0.88rem",
            }}
          >
            <span style={{ color: "#94a3b8" }}>Already have a registered police profile? </span>
            <Link
              to="/police/login"
              style={{ color: "#38bdf8", fontWeight: "bold", textDecoration: "underline" }}
            >
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #475569",
  borderRadius: 8,
  fontSize: "0.92rem",
  boxSizing: "border-box",
};

