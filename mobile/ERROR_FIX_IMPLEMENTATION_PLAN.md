# RakshaSetu Mobile App - Error Audit & Implementation Plan

This document identifies all operational, contract, and validation mismatches between the React Native Mobile App (`mobile/`) and the Node.js/Express + MongoDB API (`backend/`), with systematic step-by-step fixes.

---

## 📋 Identified Errors & Fix Roadmap

| # | Component / File | Issue Description | Severity | Fix Strategy |
|---|---|---|---|---|
| **1** | `RegisterScreen.js` | **Backend Validation Rejection:** Backend requires 10-digit phone (`/^\d{10}$/`), 8–128 character password, and emergency contact with `relation` (`c.relation?.trim()`). Form had 6-char min and lacked `relation`. | 🔴 High | Sanitize phone, enforce 8+ chars password, add `relation` & `relationship`. |
| **2** | `locationService.js` | **Geofence Warning Property Mismatch:** Location service checks `response.data.warnings`, but `locations.js:65` returns `{ ...point, alerts: warnings }`. | 🟠 Medium | Check both `response.data.alerts` and `response.data.warnings`. |
| **3** | `socketService.js` | **Socket Event Name Mismatch:** Server emits `incident:updated` (`backend/src/routes/incidents.js:117`), while mobile listened only to `incident:update`. | 🟠 Medium | Subscribe to both `incident:updated` and `incident:update`. |
| **4** | `TripsScreen.js` | **Trip Model Field Mismatch:** Backend model expects `modeOfTravel` and requires `startPoint`. Mobile sent `travelMode` and optional `startPoint`. | 🟠 Medium | Map `modeOfTravel: travelMode`, ensure `startPoint` fallback. |
| **5** | `ProfileScreen.js` | **Emergency Contact Schema Mismatch:** Contact added without `relation` property; phone not sanitized. | 🟡 Low | Add `relation: 'Contact'` alongside `relationship`. |
| **6** | `SosScreen.js` | **Duplicate SOS Case Handling:** Backend returns `{ ...existing, duplicate: true }` when active SOS exists; mobile threw generic alert. | 🟡 Low | Handle `duplicate: true` gracefully and load existing case. |
| **7** | `DashboardScreen.js` | **Static Safety Score:** Safety score stayed at static 92 regardless of active distress or danger alerts. | 🟡 Low | Compute dynamic score (25 on SOS, 60 on geofence warning, 95 on safe). |
| **8** | `apiClient.js` | **Network Error Masking:** Raw axios network errors lacked connection hints. | 🟡 Low | Improve user-facing connection failure messages. |

