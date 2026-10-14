# SafeVoyage project brain

## Purpose and entry points

SafeVoyage is a tourist safety system with a browser-based tourist portal, an administrator dashboard, a Node/MongoDB incident API, and a separate Python/PostGIS geofencing service.

| Area | Location | What it does | Start / URL |
| --- | --- | --- | --- |
| Tourist web portal | `frontend/src/pages/TouristPortal.js` | Browser conversion of the mobile app: identity, trips, SOS, alerts, profile, browser location sharing | `npm start` in `frontend`; `/tourist` |
| Admin dashboard | `frontend/src/pages`, `components` | Admin sign-in, EFIR, SOS, alerts, police and geofence views | `/login` then protected routes |
| Incident API | `backend/server.js`, `backend/src` | Express API for admin auth, alerts, EFIRs, inspectors | `npm start` in `backend`; `http://localhost:5000` |
| Geofencing API | `sih-backend/backend` | FastAPI/PostGIS zones, live locations and WebSockets | `docker-compose up -d` in `sih-backend`; `http://localhost:8000/docs` |
| Legacy mobile source | `mobile` | React Native source retained for reference; no longer required for browser users | React Native toolchain only |

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

The tourist portal deliberately remains offline-first like the original mobile implementation: it saves state to this browser’s `localStorage` and treats Node API submission as best-effort. Replacing this with authenticated persisted tourist accounts is the next logical backend task.

## Run sequence

1. Set the Node API environment variables in `backend/.env`.
2. Run `npm install` then `npm start` in `backend`.
3. Run `npm install` then `npm start` in `frontend`.
4. Optional geofencing: in `sih-backend`, run `docker-compose up -d`.
5. Open `http://localhost:3000/tourist` for the tourist web app, or `http://localhost:3000/login` for the admin dashboard.

## Change guide

- Tourist browser UX: edit `frontend/src/pages/TouristPortal.js` and `frontend/src/styles/tourist.css`.
- Admin browser UX: edit individual `frontend/src/pages/*` components and `frontend/src/components/*`.
- Node data contracts: edit `backend/src/models`, then controllers and routes.
- Spatial workflows: edit `sih-backend/backend` and its Docker Compose environment.
- Do not update `mobile` when changing the browser portal unless the React Native app must also remain feature-equivalent.
