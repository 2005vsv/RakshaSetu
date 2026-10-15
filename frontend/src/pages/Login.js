import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/admin.css";
import { nodeApi } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => { Promise.resolve(nodeApi.get("/auth/demo-status")).then(({ data }) => setDemoEnabled(Boolean(data?.enabled))).catch(() => setDemoEnabled(false)); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await nodeApi.post("/auth/login", { email, password });
      if (data.user?.role !== "admin") throw new Error("This account is not authorized for the response console.");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demoSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await nodeApi.post("/auth/demo-login", { role: "admin" });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Admin demo sign-in is unavailable.");
    } finally { setLoading(false); }
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
              <Link to="/forgot-password">Forgot password?</Link>
              {demoEnabled ? <button className="ops-button subtle" disabled={loading} type="button" onClick={demoSignIn}>Continue with admin demo</button> : null}
              <div style={{ color: "#9ca3af" }}>No account? <Link to="/signup">Sign up</Link></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


