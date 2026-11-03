# RakshaSetu - Smart Tourist Safety System

Formerly SafeVoyage. This web application connects the tourist portal and operations console to one MongoDB-backed Express API. It uses browser geolocation with explicit consent, and authenticated Socket.IO updates for incident response.

## Implemented features

- Tourist registration, bcrypt password hashing, cookie sessions, database-backed demo accounts, and optional email password recovery.
- MongoDB-backed digital tourist IDs, limited QR verification, trips, location history, emergency contacts, alerts, incidents, support requests, and safety announcements.
- Consent-controlled browser location and MongoDB geofence polygons with zone alerts.
- SOS incident submission, duplicate prevention, response assignment, status history, resolution, and tourist-side updates.
- Role-protected admin screens for monitoring, incidents, tourist records, audit, reports, announcements, responders, and retention settings.

## Runtime and data

- React web frontend: `frontend/`
- Node/Express + Socket.IO API: `backend/`
- React Native / Expo mobile app: `mobile/`
- MongoDB Atlas or a configured MongoDB deployment is required. The web application's account, trip, location, geofence, incident, and audit data is persisted through this API.
- The legacy FastAPI/PostGIS implementation under `sih-backend/` is not called by the current web app. Its location simulator is intentionally not part of development startup.
- App data and auth tokens are not written to browser localStorage or sessionStorage. Browser geolocation is permission-based and cannot be guaranteed while the tab is closed or suspended.

## External integrations that need configuration

- Password reset emails require SMTP values in `backend/.env`; the API reports an explicit configuration error when mail is unavailable.
- The site records incidents for its authorized response console. It does not guarantee police or emergency services have been contacted; call 112 directly in India for immediate danger.
- Production needs HTTPS, a reviewed MongoDB backup policy, and secure, private secrets. Configure Atlas backups or a tested `mongodump`/restore process for self-hosted MongoDB.
- Dependency review: the backend production dependency audit is clean. The existing Create React App toolchain still reports frontend dependency advisories after non-breaking fixes; eliminating those needs a planned frontend build-tool/router migration, so no breaking `npm audit fix --force` was applied.

## Development

See `backend/.env.example` for server settings. Start the API with `npm start` in `backend/`, then the UI with `npm start` in `frontend/`.
## ðŸ“Š Feasibility & Viability

### **Feasibility**

* Built entirely with **open-source** technologies
* **Offline maps** via OpenStreetMap
* **Modular and scalable** across regions
* Easily integrates with **government APIs**

### **Viability**

* **Cost-effective** and aligns with **Digital India** goals
* Boosts **tourism confidence** and safety perception
* **Monetizable** via ads, premium features, or partnerships
* Supports **smart city and police modernization** initiatives

---

## ðŸŒ Impact & Benefits

| Area               | Benefit                                             |
| ------------------ | --------------------------------------------------- |
| **Social**         | Improves traveler trust and safety                  |
| **Economic**       | Drives tourism revenue growth                       |
| **Administrative** | Streamlines FIR handling and tracking               |
| **Technological**  | Leverages AI + Blockchain for secure, fast response |

### **Potential Impacts**

* Faster emergency response and coordination
* Real-time risk detection in high-risk areas
* Offline navigation for remote zones
* Regional growth in under-visited tourist regions

---
## ðŸ“· Project Screenshots
### Hereâ€™s what the app looks like:

![App Screenshot](assets/Tourist_Dashboard.png)
![App Screenshot](assets/Tracking.png)
![App Screenshot](assets/Alert_APP.png)

### Admin Side  
![App Screenshot](assets/Admin_Dash.png)
![App Screenshot](assets/Alert_ADmin.png)
![App Screenshot](assets/E-FIR.png)
![App Screenshot](assets/SOS_Map.png)
![App Screenshot](assets/Polygon.png)

---

## ðŸ”¬ Research & References

* [Govt. of Assam â€” E-FIR Guidelines](https://police.assam.gov.in/how-to/e-fir)
* [Effect of Disasters on Indian Travel (Taylor & Francis)](https://www.taylorfrancis.com/chapters/edit/10.4324/9781003342090-46/effect-natural-disasters-north-eastern-region-india-%E2%80%94a-review-dipak-basumatari-nibir-borah-rajib-das-burnwal-eranki-sidhartha)
* [AI in Disaster Risk Management â€” ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2212420923006039)
* [OpenStreetMap](https://www.openstreetmap.org/)
* [OpenMeteo API](https://open-meteo.com/en/docs)

---

## ðŸ§‘â€ðŸ’» Development Resources

* **GitHub Repository:** [https://github.com/Anoint2612/tourist-safety](https://github.com/Anoint2612/tourist-safety)
* **Demo Video:** [https://youtu.be/VNty5MsPQRE](https://youtu.be/VNty5MsPQRE)

---

## Local demo accounts

In development, the tourist sign-in page and admin login page include one-click demo sign-in buttons. The backend creates each demo user in MongoDB on first use and reuses that database account on later sign-ins. Demo access is disabled by default when `NODE_ENV=production`; set `DEMO_ACCOUNTS_ENABLED=true` only when you explicitly want it enabled.

Sessions use a 30-day HTTP-only cookie. Tourist profiles, trips, alerts, EFIRs, and location history are handled through the backend and stored in MongoDB; the frontend does not persist app data or tokens in local or session storage, and it clears session keys written by older builds. Geofence polygons and boundary checks are stored and evaluated in MongoDB by the Node API. The legacy FastAPI/PostGIS service is not part of the web application runtime.

## RakshaSetu blueprint implementation ledger

This ledger follows the supplied blueprint order. MongoDB is the source of truth for accounts, trips, location records, incidents, announcements, and audit entries. The React client does not persist application records or auth tokens in browser storage.

| Blueprint order | Feature | Status | Implementation notes |
| --- | --- | --- | --- |
| 1 | Shared web architecture | Implemented | React tourist/admin routes use the Express API, MongoDB, and authenticated Socket.IO rooms. MongoDB stores geofence polygons and Node evaluates consented locations against those boundaries. The legacy FastAPI/PostGIS service is not called by the web app. |
| 2A | Tourist registration and authentication | Implemented | Tourist registration and login are MongoDB-backed; new password hashes use bcrypt. Legacy scrypt hashes upgrade after successful login. Admins cannot be self-registered. HTTP-only cookie sessions expire after 30 days, and suspended users are blocked on API requests. |
| 2A | Password recovery | Implemented, requires mail configuration | Reset tokens are hashed in MongoDB, expire after 30 minutes, are one-use, and invalidate existing sessions. Email delivery requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`; the API returns an explicit setup error without them. |
| 2B | Digital Tourist ID | Implemented | Tourist ID is stored in MongoDB; QR opens a public verifier that returns only name, ID, active status, and registration date. ID page supports browser print / Save as PDF. |
| 2C | Location and trip safety | Implemented | Trip data, opted-in browser coordinates, geofence polygons, and geofence alerts persist in MongoDB. Location writes require the tourist's sharing preference. Admin map shows consented profiles, freshness, active trips, and separate SOS points. Browser background tracking cannot be guaranteed. |
| 2D | Emergency SOS | Implemented | SOS creates a MongoDB incident with a reference, permitted location snapshot, transition history, and duplicate-active-SOS protection. Tourists can cancel a new accidental report with a reason. |
| 2D / 4 | Real-time response updates | Implemented | Socket.IO authenticates the same cookie and account status as the API. New incidents reach admins; status changes reach both the admin room and the owning tourist room. |
| 2E | Tourist dashboard and incident history | Implemented | Dashboard reads database-backed trips, alerts, and incidents. Incident history updates live and includes responder, status changes, and resolution details. |
| 2F | Safety information and announcements | Implemented | Tourist help content explains 112, consent, browser GPS limits, and alert behavior. Admin notices and tourist support requests are stored in MongoDB; notices and support responses update connected clients. |
| 3A | Admin sign-in and access control | Partially implemented | Admin APIs are protected; super administrator, monitoring officer, and responder roles are stored and checked on sensitive routes. Admin accounts can be activated/deactivated and deactivation revokes sessions. MFA remains outstanding. |
| 3B | Admin overview | Implemented | Dashboard shows database totals, open/high-priority incidents, active trips, location-sharing count, acknowledgement timing, 30-day incident trend, and recent SOS activity. |
| 3C | Live tourist map | Implemented | Map includes only active tourists who opted in, reports stale/unavailable points, supports search and trip/incident/freshness filters, and distinguishes incident coordinates from last-known coordinates. |
| 3D | Incident management | Implemented | New, acknowledged, assigned, responding, resolved, and cancelled workflows are validated server-side; actions, notes, assignment, resolution, audit, and reopen history are stored. |
| 3E | Tourist management | Implemented | Search, digital ID verification/flagging, account suspension/reactivation, permitted profile correction, trip/incident history, CSV export, and audit entries are available. |
| 3F | Reports and analytics | Implemented | Daily, weekly, or monthly incident and registration trends; status, severity, and category counts; approximate location distribution; acknowledgement-time metrics; date/status/severity/type filters; audited CSV export; and printable / Save as PDF incident report. |
| 3G | System administration | Partially implemented | Role-based admin account provisioning/deactivation, announcements, audit history, health status, auth rate limits, login-failure hashes, daily retention policies, severity thresholds, and audible SOS preferences are available. Automated backup/recovery still needs an Atlas or deployment backup provider. |
| 5-7 | Stack, database, security | Partially implemented | Mongoose models cover users, trips, locations, incidents, support requests, announcements, settings, audit logs, and geofence polygons. Socket/API access checks, bcrypt, validation, explicit consent, limited QR data, and auth rate limits are in place. Deployment HTTPS, shared rate-limit storage for multi-instance production, and MFA require deployment configuration or additional work. The legacy PostGIS service is not called by the web app. |
| 8 | End-to-end verification | Development API verified | Frontend production build and backend syntax checks pass. Non-destructive live checks passed for MongoDB, both demo sessions, QR verification, authorization, consent enforcement, geofence validation, system settings, and authenticated Socket.IO. SMTP delivery and real browser GPS/SOS broadcast require configured mail and explicit live-device testing. |

### Implementation sequence completed in this pass

1. Closed public administrator self-registration and migrated new/legacy login handling to bcrypt.
2. Added secure expiring password recovery, account status checks, and auth rate limiting.
3. Added QR-backed Tourist ID verification and print support.
4. Moved geofence polygons, location checks, and geofence alerts into MongoDB and enforced explicit location consent.
5. Added MongoDB SOS incidents, deduplication, cancellation, audit history, and Socket.IO updates.
6. Added tourist incident history, live admin metrics/map, tourist and responder management, support inbox, announcements, audit, filtered reports, and retention settings.

### Password recovery mail configuration

Add these server-side settings to `backend/.env` to enable password reset delivery. They are intentionally not committed:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

Production deployments must use HTTPS and private mail credentials. This website submits incidents to its response console; it does not guarantee that police or emergency services have been contacted.

