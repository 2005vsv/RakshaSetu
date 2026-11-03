# RakshaSetu Tourist Mobile Application

Smart Tourist Safety & Emergency SOS Mobile Platform for tourists visiting India. Built with React Native & Expo, backed by the RakshaSetu Express + MongoDB API.

---

## 📱 Features

1. **Identity & Digital Tourist ID Pass**
   - Cryptographically linked tourist safety credentials with personal and travel details.
   - Dynamic QR code generation (`react-native-qrcode-svg`) for checkpoint and inspector verification.
   - Emergency contacts linked directly to the digital ID.

2. **Emergency SOS & Distress Beacon**
   - High-contrast, prominent emergency SOS trigger with an optional **5-second countdown** (with vibration) to prevent accidental taps.
   - Immediate dispatch of GPS coordinates (`POST /incidents`) to the police control room.
   - Real-time incident tracking (`Socket.IO`): updates live when responders are assigned or statuses change.
   - "Cancel SOS" with reason prompt when safe.
   - Instant direct dialing to **112 (National Emergency Helpline)** and **1363 (Tourist Helpline)**.
   - One-tap Emergency SMS with live Google Maps coordinate link to family/emergency contacts.

3. **Autonomous Location & Geofence Radar**
   - High-precision GPS tracking via `expo-location`.
   - Continuous background & foreground coordinate syncing to `POST /locations`.
   - Real-time polygon perimeter evaluation: alerts the tourist immediately if they step into a restricted, wildlife, or high-risk zone.

4. **Trip & Itinerary Management**
   - Register travel routes, destinations, dates, and transport modes (car, bus, train, flight, trekking).
   - Allows safety teams to know planned tourist routes in remote or low-connectivity zones.

5. **Official Advisories & Alerts Feed**
   - Filterable alerts (Emergency, Geofence, Resolved).
   - Live broadcast advisories from tourism and disaster authorities.

6. **Authentication & Flexible Networking**
   - Secure JWT session storage via `AsyncStorage` and Bearer token headers.
   - One-click **Demo Tourist Login** (`/auth/tourist-session`) for instant demonstration.
   - Built-in **Network Server Host switcher** in Settings & Login screens to easily connect physical phones to your computer's LAN IP (`http://192.168.x.x:5000`).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or v20)
- Backend server running on port 5000 (`cd backend && npm start`)

### 2. Start the Mobile Metro Bundler
```bash
cd mobile
npm start
```

### 3. Run on Devices

- **Physical Phone (Android or iOS):**
  1. Install **Expo Go** from Google Play Store or Apple App Store.
  2. Ensure your phone and computer are connected to the same Wi-Fi network.
  3. Scan the QR code displayed in the terminal with the Expo Go app (or iOS Camera).
  4. In the app's login or profile screen, tap the Settings icon and set the Server URL to your computer's Wi-Fi IP (e.g. `http://192.168.1.5:5000`).

- **Android Emulator:**
  - Press `a` in the terminal (defaults to `http://10.0.2.2:5000` which maps to host localhost).

- **Web Browser (Quick Preview):**
  - Press `w` in the terminal to open in browser.

---

## 📂 Project Architecture

```text
mobile/
├── src/
│   ├── api/
│   ├── config/
│   │   └── api.js              # Endpoint definitions & dynamic base URL resolver
│   ├── context/
│   │   └── AuthContext.js      # Session management & user state
│   ├── navigation/
│   │   ├── AppTabs.js          # Bottom tab bar with prominent SOS button
│   │   └── RootNavigator.js    # Auth stack vs authenticated app
│   ├── screens/
│   │   ├── alerts/AlertsScreen.js
│   │   ├── auth/LoginScreen.js
│   │   ├── auth/RegisterScreen.js
│   │   ├── dashboard/DashboardScreen.js
│   │   ├── id/DigitalIdScreen.js
│   │   ├── map/SafetyMapScreen.js
│   │   ├── profile/ProfileScreen.js
│   │   ├── sos/SosScreen.js
│   │   └── trips/TripsScreen.js
│   ├── services/
│   │   ├── apiClient.js        # Axios instance with Bearer interceptor & storage
│   │   ├── emergencyService.js # SOS triggers, 112 dialing & SMS helpers
│   │   ├── locationService.js  # GPS tracking & /locations sync
│   │   └── socketService.js    # Socket.IO client for live incidents
│   └── theme/
│       └── colors.js           # Slate & Sky Blue theme palette
├── app.json                    # Expo config & location permissions
├── App.js                      # Root component & providers
└── package.json
```

