# Mobile to React Web Implementation Plan

## Goal
Convert the React Native `mobile` tourist experience into the existing React `frontend` application while keeping it integrated with the Node backend where endpoints already exist.

## Feature Mapping
1. Authentication: replace mobile AsyncStorage with browser `localStorage`, keep quick tourist sessions through `POST /auth/tourist-session`, and add richer web registration fields.
2. Tourist Dashboard: port safety score, quick actions, active trip summary, digital ID, and recent alerts.
3. Trips: port listing, search, filters, and planning; sync backend-compatible fields and keep richer mobile metadata locally.
4. Alerts: port alert search, filters, empty state, and panic alert creation.
5. Location and Map: replace `react-native-maps` with `react-leaflet`, browser geolocation, tracking history, risk zones, and service markers.
6. SOS/Panic: port countdown, cancellation, current-location capture, and emergency alert submission.
7. Profile and Settings: port digital ID, emergency contacts, preferences, profile editing, export data, and logout.
8. Admin Dashboard: keep the existing web admin routes because they already cover the admin surface separately.

## Integration Steps
1. Rebuild `frontend/src/pages/TouristPortal.js` as a full React web module.
2. Replace `frontend/src/styles/tourist.css` with responsive web styling for the migrated tourist app.
3. Preserve existing `/tourist/*` routing in `frontend/src/App.js`.
4. Build the frontend and fix compile issues.
5. Start the React app and provide the local URL for verification.

## Completion Notes
- Tourist registration and quick sessions now persist profile fields, phone, Aadhaar, role, emergency contacts, digital ID, and preferences in MongoDB.
- Trip planning now persists start point, destination, dates, status, travel mode, description, and additional stops in MongoDB.
- Alerts and SOS actions use authenticated backend endpoints and are not seeded with mock browser data.
