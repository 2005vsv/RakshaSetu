import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { nodeApi } from "../services/api";

export default function VerifyTouristId() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; nodeApi.get(`/incidents/public/verify/${encodeURIComponent(id)}`).then(({ data }) => { if (active) setResult(data); }).catch((err) => { if (active) setError(err.response?.data?.error || "Could not verify this tourist ID."); }); return () => { active = false; }; }, [id]);
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">RAKSHASETU · PUBLIC ID CHECK</p><h1>Tourist ID verification</h1>{result ? <><p className="notice">Verified active tourist credential</p><h2>{result.name}</h2><code>{result.digitalId}</code><p>Registration status: {result.registrationStatus}</p><p>Registered {new Date(result.registeredAt).toLocaleDateString()}</p></> : error ? <p className="notice danger-note">{error}</p> : <p>Checking MongoDB registry…</p>}<Link to="/tourist">Open tourist portal</Link></section></main>;
}
