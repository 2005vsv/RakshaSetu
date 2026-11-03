import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function VerifyTouristId() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    nodeApi
      .get(`/verify/${encodeURIComponent(id)}?format=json`)
      .then(({ data }) => {
        if (active) {
          setResult(data);
          setError("");
        }
      })
      .catch((err) => {
        // Fallback to legacy endpoint if needed
        nodeApi
          .get(`/incidents/public/verify/${encodeURIComponent(id)}`)
          .then(({ data }) => {
            if (active) {
              setResult(data);
              setError("");
            }
          })
          .catch((fallbackErr) => {
            if (active) {
              setError(
                fallbackErr.response?.data?.error ||
                  err.response?.data?.error ||
                  "Tourist ID was not found or has been deactivated."
              );
            }
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const isActive = result && (result.accountStatus === "active" || result.registrationStatus === "active");

  return (
    <main className="auth-page" style={{ padding: "30px 16px", minHeight: "100vh" }}>
      <section className="auth-card" style={{ maxWidth: 520, borderRadius: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <p className="eyebrow" style={{ color: "#fbbf24", letterSpacing: 1.5, fontWeight: 800 }}>
            GOVERNMENT OF INDIA · MINISTRY OF TOURISM
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>RakshaSetu Verification</h1>
          <p style={{ fontSize: 13, color: "var(--muted, #94a3b8)", marginTop: 2 }}>
            Smart Tourist Safety Network · Official Credential Check
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ color: "#38bdf8", fontWeight: 700 }}>Checking National Registry…</p>
          </div>
        ) : result ? (
          <div>
            <div
              style={{
                background: isActive ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1.5px solid ${isActive ? "#10b981" : "#ef4444"}`,
                borderRadius: 14,
                padding: "14px 18px",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: 20,
                  background: isActive ? "#10b981" : "#ef4444",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: 0.8,
                  marginBottom: 6,
                }}
              >
                {isActive ? "✓ VERIFIED ACTIVE TOURIST" : "⚠ INACTIVE / FLAGGED"}
              </div>
              <p style={{ fontSize: 12, color: "#cbd5e1", margin: 0 }}>
                {isActive
                  ? "Authentic tourist pass in good standing on the National Smart Tourist Safety Network."
                  : "This account has been flagged. Please verify identity documents."}
              </p>
            </div>

            <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>TOURIST NAME</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#38bdf8" }}>{result.name || "Authorized Tourist"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>DIGITAL ID</span>
                <code style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>{result.digitalId}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>STATUS</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? "#10b981" : "#ef4444" }}>
                  {isActive ? "Active · Compliant" : "Suspended"}
                </span>
              </div>
              {result.registeredAt && (
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>REGISTERED ON</span>
                  <span style={{ fontSize: 13, color: "#f8fafc" }}>
                    {new Date(result.registeredAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>NATIONAL HELPLINE</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>112 (Police & Emergency)</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <a
                href="tel:112"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: 10,
                  background: "#ef4444",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                🚨 Dial 112 Helpline
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  background: "#334155",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                🖨️ Print Pass
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: "rgba(239, 68, 68, 0.15)",
                border: "2px solid #ef4444",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                fontSize: 24,
                marginBottom: 12,
              }}
            >
              ✕
            </div>
            <h2 style={{ fontSize: 18, color: "#f8fafc", marginBottom: 8 }}>Unrecognized Tourist Pass</h2>
            <code style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "4px 10px", borderRadius: 6 }}>
              {id}
            </code>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "14px 0" }}>
              {error || "This Tourist ID does not exist in the active national registry."}
            </p>
            <a
              href="tel:112"
              style={{
                display: "block",
                padding: "12px",
                borderRadius: 10,
                background: "#ef4444",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              🚨 Call Police Helpline (112)
            </a>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
          <Link to="/tourist" style={{ color: "#38bdf8", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
            ← Open Tourist Portal
          </Link>
        </div>
      </section>
    </main>
  );
}
