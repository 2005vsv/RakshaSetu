import React from "react";
import "../styles/admin.css";
import { clearAdminAuthToken, nodeApi } from "../services/api";
import { NavLink } from "react-router-dom";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-shell">
      <aside className="ops-sidebar"><NavLink to="/" className="ops-brand"><span className="ops-brand-mark">S</span><span>RakshaSetu<small>Response console</small></span></NavLink><nav className="ops-nav"><NavLink to="/">Overview</NavLink><NavLink to="/monitoring">Live tourist map</NavLink><NavLink to="/sos">Incident management</NavLink><NavLink to="/management">Tourists & system</NavLink><NavLink to="/alerts">Alert centre</NavLink><NavLink to="/efir">E-FIR review</NavLink><NavLink to="/geo">Geofences</NavLink><NavLink to="/police">Police operations</NavLink></nav><div className="ops-sidebar-note"><b>Incident response</b><span>Review · route · resolve</span></div></aside>
      <div className="main" style={{ marginLeft: 0 }}>
        <header className="topbar">
          <div className="topbar-title">Operations workspace</div>
          <div className="topbar-actions">
            <button
              className="ops-button"
              onClick={() => {
                window.location.href = "/efir/create";
              }}
              style={{ marginRight: 8 }}
            >Create FIR</button>
            <button
              className="ops-button subtle"
              onClick={async () => {
                try { await nodeApi.post("/auth/logout"); } catch (_) { /* The local session also clears if the API is offline. */ }
                clearAdminAuthToken();
                window.location.href = "/login";
              }}
            >Logout</button>
          </div>
        </header>
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}


