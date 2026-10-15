import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function PasswordRecovery() {
  const { token } = useParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const { data } = token ? await nodeApi.post("/auth/reset-password", { token, password }) : await nodeApi.post("/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (err) { setError(err.response?.data?.error || "Password recovery could not be completed."); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><p className="eyebrow">ACCOUNT RECOVERY</p><h1>{token ? "Choose a new password" : "Forgot your password?"}</h1><p>{token ? "Reset links expire after 30 minutes and can only be used once." : "We will email a secure one-time reset link if the account is active."}</p>{error ? <p className="notice danger-note">{error}</p> : null}{message ? <p className="notice">{message}</p> : null}{token ? <label>New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label> : <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}<button className="primary" disabled={busy}>{busy ? "Please wait…" : token ? "Reset password" : "Send reset link"}</button><Link to="/login">Administrator sign-in</Link><Link to="/tourist">Tourist sign-in</Link></form></main>;
}
