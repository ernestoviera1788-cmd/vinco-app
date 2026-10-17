# VINCÓ — Native App (Expo)

Original dating platform. One TypeScript codebase for iOS and Android, built with
**Expo SDK 57** + **Expo Router**.

The app talks to the real VINCÓ backend: the `vinc` web artifact publishes
**57 RPC actions** at `POST {BASE}/actions`. See [`docs/BACKEND_CONTRACT.md`](docs/BACKEND_CONTRACT.md)
for the full contract (action names, arg shapes, envelopes).

> **Honest caveat:** the backend currently lives inside Muse with **no verified
> public deployment**. The app is built against a configurable
> `EXPO_PUBLIC_API_URL`, and every network call fails honestly when the backend
> is unreachable — nothing is mocked.

## Quick start

```bash
cp .env.example .env
# set EXPO_PUBLIC_API_URL=https://<your-backend-public-url>
npm install
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with
Expo Go / a development build.

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Metro dev server |
| `npx tsc --noEmit` | Typecheck (strict, 0 errors required) |
| `npx expo-doctor` | Diagnose dependency/config issues |
| `npx expo lint` | Lint |

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Yes | Public base URL of the deployed backend. All RPC goes to `{URL}/actions`. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | For push | EAS project UUID. Set this after linking the app with `eas init`; it enables Expo push-token registration. |

Without it, every API call throws a clear "not configured" error — the app never
pretends to work offline.

## EAS builds

```bash
npm install -g eas-cli        # or: npx eas-cli@latest
eas login
eas build --profile development --platform ios      # dev client
eas build --profile preview --platform android      # internal preview (APK)
eas build --profile production --platform all       # store builds
eas submit --platform ios                           # App Store
eas submit --platform android                       # Play Store
```

Profiles live in `eas.json`. Bundle IDs: iOS `com.vinco.app`, Android `com.vinco.app`.
Deep links use the `vinco://` scheme.

### Push notifications setup

1. Link this app to its real EAS project with `eas init` and set `EXPO_PUBLIC_EAS_PROJECT_ID` to that project's UUID if it is not injected by EAS.
2. Configure Android FCM v1 credentials and iOS APNs credentials in EAS.
3. Deploy the paired backend PR so `registerpushdevice` / `unregisterpushdevice` are available and the `999_push_devices.sql` migration is applied.
4. Build and install a development or production native app (`eas build`). Expo Go is not a valid remote-push test target for this setup.
5. Test notifications with the app foregrounded, backgrounded, and fully closed on physical devices.

The app intentionally skips push-token registration when no EAS project ID is configured. Push delivery is not considered production-ready until the migration, credentials, and real-device tests have passed.

## Project layout

```
app/                    Expo Router screens
  index.tsx             Splash (animated heart, auto-continues)
  (auth)/               Welcome, AgeGate (18+), Register (6 steps),
                        Login, VerifyOtp, ForgotPassword
  (tabs)/               Discover, Likes, Matches, Messages, Profile
  chat/[id].tsx         1:1 chat (5s polling + typing indicator)
  premium.tsx           Plans/boosts via Stripe web checkout
  notifications.tsx     In-app notification inbox
  safety.tsx            Static Safety Center (EN/ES)
  legal.tsx             Terms/Privacy placeholder (no invented legal text)
src/
  api/client.ts         RPC caller: token inside args, actionCallId,
                        envelope handling, forced logout on auth failure
  api/actions.ts        Typed wrappers — ONLY real action names from the contract
  api/types.ts          Domain models
  auth/AuthContext.tsx  Token in expo-secure-store, getme revalidation on launch
  i18n/en.ts, es.ts     String catalogs (identical keys). No hardcoded UI literals.
  components/           Button, TextField, Screen, StubBanner, MatchModal, …
assets/                 App icon, adaptive icon, splash art (generated)
```

## Functional vs. stub — the honest table

| Feature | Status | Notes |
|---|---|---|
| Auth (register/login/OTP/reset) | ✅ Real | `register`, `login`, `verifyotp`, `requestverification`, `requestpasswordreset`, `completepasswordreset` |
| Age gate 18+ | ✅ Real | Client-side gate + server enforces 18+ on `register` |
| Profile view/edit | ✅ Real | `getme`, `updateprofile` (always sends ALL required fields) |
| Photos (upload/delete/reorder/primary) | ✅ Real | Base64 JPEG/PNG ≤10MB via `expo-image-picker` |
| Privacy toggles | ✅ Real | `updateprivacy` |
| Notification preferences | ✅ Real | `updatenotificationsettings` |
| In-app notification inbox | ✅ Real | `listnotifications`, `marknotificationread` |
| Discover / Like / Pass / Super Like | ✅ Real | `listdiscovery`, `reacttoprofile` (+ match modal) |
| Likes inbox | ✅ Real | `listlikes` (premium gating is server-side) |
| Matches, unmatch, block, report | ✅ Real | `listmatches`, `unmatch`, `blockuser`, `reportuser` (categories + details + base64 photo evidence) |
| Chat | ✅ Real | `listmessages` (5s poll), `sendmessage`, `settyping`, read states |
| Sessions | ✅ Real | `listsessions`, `revokesession` |
| Language toggle (EN/ES) | ✅ Real | Device default; persisted via `updatelocale` |
| Premium purchase | ✅ Real (web) | `listplans`, `listboosts`, `createcheckout` → Stripe in system browser → `confirmcheckout`; `renewsubscription`, `cancelsubscription`, `requestrefund`, `listmybilling` |
| Safety Center | ✅ Real | Static EN/ES content |
| Delete account / Logout | ✅ Real | `deleteaccount` (type DELETE), `logout` |
| **OS push notifications** | 🚧 Stub | In-app inbox is real; no `registerpushdevice` action exists. Banner shown, nothing faked. |
| **Native Apple/Google IAP** | 🚧 Stub | Web Stripe checkout is real; native billing not wired. Banner shown, never simulates purchase. |
| **Voice/video calls** | 🚧 Stub | Architecture only (call button shows explanatory banner). No provider wired. |
| **Email/SMS delivery** | ⚠️ Backend-dependent | OTP/reset actions are real; actual delivery depends on the provider configured on the backend. |

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx expo-doctor` → clean
- `npx expo start` → Metro serves; iOS bundle compiles (HTTP 200, no errors)

## Backend deployment note

Before any production build, the `vinc` backend needs a public deployment and its
URL in `EXPO_PUBLIC_API_URL`. Response payload shapes in `src/api/actions.ts` were
parsed defensively (the contract could not introspect them) — re-verify field
names against the live backend before shipping.
