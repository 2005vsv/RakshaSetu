import React from "react";
import { Link } from "react-router-dom";

export default function Signup() {
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">AUTHORIZED OPERATIONS ACCESS</p><h1>Administrator accounts are provisioned securely</h1><p>Public sign-up cannot grant administrator privileges. Ask an existing administrator to create your account from the management console.</p><Link className="primary" to="/login">Administrator sign-in</Link><Link to="/tourist">Tourist registration</Link></section></main>;
}
