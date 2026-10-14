import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/admin.css";
import { nodeApi, setAuthToken } from "../services/api";

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
      const { data } = await nodeApi.post("/auth/login", { email, password });
      setAuthToken(data.token);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="panel" style={{ width: 420 }}>
        <div className="panel-header">Admin Login</div>
        <div className="panel-body">
          {error ? <div style={{ color: "#991b1b", background: "#fee2e2", border: "1px solid var(--border)", padding: 8, borderRadius: 8, marginBottom: 8 }}>{error}</div> : null}
          <form onSubmit={onSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }} />
              <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} style={{ background: "#ffffff", color: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }} />
              <button className="btn" disabled={loading} type="submit">{loading ? "Signing in..." : "Sign In"}</button>
              <div style={{ color: "#9ca3af" }}>No account? <Link to="/signup">Sign up</Link></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


