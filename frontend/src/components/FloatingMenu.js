import React from "react";
import { useNavigate } from "react-router-dom";

export default function FloatingMenu({ center = false, large = false }) {
  const navigate = useNavigate();
  const go = (path) => () => navigate(path);
  const options = [["/alerts", "Alert centre", "Incident triage"], ["/sos", "SOS monitor", "Live safety events"], ["/efir", "E-FIR review", "Verify reports"], ["/geo", "Geofences", "Risk boundaries"], ["/police", "Police operations", "Resolve incidents"]];
  return (
    <div className={`ops-launch-grid ${center ? "center" : ""} ${large ? "large" : ""}`}>
      {options.map(([path, title, detail], index) => <button className="ops-launch-card" key={path} onClick={go(path)}><span className="ops-launch-index">0{index + 1}</span><b>{title}</b><small>{detail}</small><span className="ops-launch-arrow">↗</span></button>)}
    </div>
  );
}


