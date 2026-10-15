# SafeVoyage project brain

## Purpose and entry points

SafeVoyage is a tourist safety system with a browser-based tourist portal, an administrator dashboard, a Node/MongoDB incident API, and a separate Python/PostGIS geofencing service.

| Area | Location | What it does | Start / URL |
| --- | --- | --- | --- |
| Tourist web portal | `frontend/src/pages/TouristPortal.js` | Browser tourist experience: identity, trips, SOS, alerts, profile, and browser location sharing | `npm.cmd start` in `frontend`; `/tourist` |
| Admin dashboard | `frontend/src/pages`, `components` | Admin sign-in, EFIR, SOS, alerts, police and geofence views | `/login` then protected routes |
| Incident API | `backend/server.js`, `backend/src` | Express API for admin auth, tourist accounts/trips, alerts, EFIRs, and inspectors | `npm.cmd start` in `backend`; `http://localhost:5000` |
| Geofencing API | `sih-backend/backend` | FastAPI/PostGIS zones, live locations and WebSockets | `docker-compose up -d` in `sih-backend`; `http://localhost:8000/docs` |

## Request flows

```text
Tourist browser (/tourist)
  ├─ localStorage: profile, trips, offline alert history
  ├─ browser geolocation → POST Node /alerts (best effort)
  └─ SOS → local alert + POST Node /alerts (best effort)

Admin browser (/login)
  ├─ Node API: /auth, /efir, /alerts, /inspectors
  └─ Geo API: /api/v1/alerts, /police_stations, zones

Geo API → PostgreSQL/PostGIS → WebSocket clients
Node API → MongoDB Atlas (or local MongoDB)
```

## Key API links

| Client need | Endpoint | Owner |
| --- | --- | --- |
| Admin login | `POST /auth/login` | Node API |
| Tourist SOS / location event | `POST /alerts` | Node API |
| View/assign incident alerts | `GET /alerts`, `PUT /alerts/:id/assign` | Node API |
| Submit EFIR | `POST /efir` | Node API |
| View pending EFIRs | `GET /efir/pending` | Node API |
| Geofence locations/zones | `/api/v1/location`, `/api/v1/zones` | Geo API |
| Live geofence alerts | `ws://localhost:8000/ws/alerts` | Geo API |

## Configuration

`backend` needs `MONGO_URI`; optional `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS`, and Twilio variables are read through environment variables. Keep real values only in `backend/.env`, which is ignored by Git. `frontend` can override API endpoints through `REACT_APP_NODE_API_BASE_URL` and `REACT_APP_GEO_API_BASE_URL`.

Tourist accounts, trips, alerts, emergency contacts, and preferences persist through the Node API. The browser retains the tourist session in `localStorage`; admin sessions use `sessionStorage` and survive page refreshes in the same browser session.

## Run sequence

1. Set the Node API environment variables in `backend/.env`.
2. Run `npm.cmd install` then `npm.cmd start` in `backend`.
3. Run `npm.cmd install` then `npm.cmd start` in `frontend`.
4. Optional geofencing: in `sih-backend`, run `docker-compose up -d`.
5. Open `http://localhost:3000/tourist` for the tourist web app, or `http://localhost:3000/login` for the admin dashboard.

## Change guide

- Tourist browser UX: edit `frontend/src/pages/TouristPortal.js` and `frontend/src/styles/tourist.css`.
- Admin browser UX: edit individual `frontend/src/pages/*` components and `frontend/src/components/*`.
- Node data contracts: edit `backend/src/models`, then controllers and routes.
- Spatial workflows: edit `sih-backend/backend` and its Docker Compose environment.
- The legacy React Native `mobile` directory was removed on 2026-10-15. Implement tourist features only in `frontend`.

## Verification record (2026-10-15)

- Frontend production build passed with `npm.cmd run build`.
- Frontend routing test passed with `npm.cmd test -- --watchAll=false --runInBand`.
- Node backend JavaScript syntax checks passed.
- Admin alert resolution persists through `PUT /alerts/:id/resolve`; the Police screen now uses this endpoint instead of a browser-only change.
- Live API verification is blocked in this workspace: the configured MongoDB Atlas cluster reports `ReplicaSetNoPrimary`, and Docker is not installed for the included local MongoDB fallback. Restore Atlas connectivity or install Docker before running database-backed tourist and admin workflows.
- Runtime check on 2026-10-15: the React development server is running on `http://localhost:3000`; the Node API cannot start until the Atlas network-access rule allows this machine's public IP.
