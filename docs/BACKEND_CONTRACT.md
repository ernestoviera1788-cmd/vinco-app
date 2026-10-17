# VINCÓ — Backend Contract (native app)

Source: read-only inspection of the `vinc` web artifact via `artifact.list_actions`
(discovery done 2026-09-25). All action names and request schemas below are
verbatim from the published action list. Response payload shapes were NOT
introspectable — re-verify response fields against a live backend before
production. The RPC transport follows the platform convention (same as the
MUVY `muvy` artifact); re-verify the envelope against the deployed backend URL.

## Transport

- Single RPC endpoint: `POST {BASE}/actions`
  - `{BASE}` = public URL of the deployed backend, configured via `EXPO_PUBLIC_API_URL`.
  - No per-action routes. No GET.
- Request body (JSON):
  ```json
  {"action": "<lowercase-name>", "args": {"token": "<session-token>", "...": "..."}, "actionCallId": "<uuid-v4>"}
  ```
- Headers: `Content-Type: application/json` (required). No `Authorization` header. No cookies.

## Session

- `register` / `login` return a session `token` (standard platform session).
- The token travels as the `token` field INSIDE `args` of every authenticated action.
- `logout` revokes the current session; `listsessions` / `revokesession` manage active sessions.
- On expired/invalid token the app must force logout and return to the login screen.

## Envelopes (platform convention — re-verify)

- Success: HTTP 200 + `{"data": <payload>}`.
- Business errors: HTTP 200 + `{"data":{"ok":false,"error":"..."}}`.
- Transport errors: non-2xx HTTP with `{"error": ...}`.

## Honest caveat

The backend currently lives inside Muse with **no verified public deployment**:
the exact public URL is unknown and it is unverified whether the server accepts
direct external POSTs. The native app is built against configurable
`EXPO_PUBLIC_API_URL` and every network call fails honestly — no mocked success.

## Action inventory (57 published)

### Auth & account (native scope)
| Action | Args |
|---|---|
| `register` | `email`, `password` (10–100), `firstName` (1–40), `birthDate` (string, 18+ enforced server-side), `gender`, `city`, `state` (opt), `country`, `phone` (opt, 7–24), `locale` (`en`\|`es`), `acceptedTerms` (`true`) |
| `login` | `identifier` (email or phone), `password` |
| `verifyotp` | `token`, `channel` (`email`\|`phone`), `code` (6 digits) |
| `requestverification` | `token`, `channel` (`email`\|`phone`) |
| `getme` | `token` → current user + profile |
| `logout` | `token` |
| `listsessions` | `token` |
| `revokesession` | `token`, `sessionId` |
| `requestpasswordreset` | `identifier`, `locale` |
| `completepasswordreset` | `identifier`, `code` (6 digits), `newPassword` (10–100), `locale` |
| `recoverpassword` | `email`, `locale` |
| `deleteaccount` | `token`, `confirm` (`"DELETE"`) |
| `updatelocale` | `token`, `locale` (`en`\|`es`) |

### Profile & photos (native scope)
| Action | Args |
|---|---|
| `updateprofile` | `token` + `firstName`, `bio` (≤500), `city`, `state`, `country`, `gender`, `intention`, `occupation`, `education`, `hobbies`, `lifestyle`, `preferredGender`, `ageMin`/`ageMax` (18–99), `distanceMax` (1–500) — all required |
| `listmyphotos` | `token` |
| `uploadprofilephoto` | `token`, `name`, `mimeType` (`image/jpeg`\|`image/png`), `dataBase64` (≤10MB), `altText` — real upload via base64 |
| `deleteprofilephoto` | `token`, `photoId` |
| `reorderprofilephotos` | `token`, `photoIds` (1–6) |
| `setprimaryphoto` | `token`, `photoId` |
| `updateprivacy` | `token`, `profileVisible`, `showDistance`, `showOnline` (booleans) |

### Discovery & social (native scope)
| Action | Args |
|---|---|
| `listdiscovery` | `token` → recommendation feed honoring preferences/blocks |
| `reacttoprofile` | `token`, `targetId`, `kind` (`LIKE`\|`PASS`\|`SUPER_LIKE`) → may return a new match |
| `listlikes` | `token` → incoming likes (premium-gated server-side) |
| `listmatches` | `token` |
| `unmatch` | `token`, `matchId` |
| `blockuser` | `token`, `targetId` |
| `reportuser` | `token`, `targetId`, `category` (Fake profile, Scam, Harassment, Spam, Inappropriate content, Threatening behavior, Impersonation, Other), `details` (opt, ≤1000), `evidence` (opt: `mimeType`, `dataBase64` ≤10MB, `altText`) |

### Messaging (native scope)
| Action | Args |
|---|---|
| `listmessages` | `token`, `conversationId` |
| `sendmessage` | `token`, `conversationId`, `body` (1–2000) |
| `settyping` | `token`, `conversationId`, `typing` (boolean) |

> No websocket/push action is published. Real-time chat = polling `listmessages`
> (+ `settyping` for the typing indicator). True push needs a provider + a
> backend registration action that does not exist yet → stub.

### Notifications (native scope)
| Action | Args |
|---|---|
| `listnotifications` | `token` → in-app notification feed (real) |
| `marknotificationread` | `token`, `notificationId` |
| `updatenotificationsettings` | `token`, `likes`, `matches`, `messages`, `security`, `marketing` (booleans) |

> In-app notifications are real. OS-level push delivery has no backend action
> (`registerpushdevice` does not exist) → stub with banner until provider +
> backend support exist.

### Premium & commerce (native scope)
| Action | Args |
|---|---|
| `listplans` | (no args) → subscription plans |
| `listboosts` | (no args) → boost products |
| `createcheckout` | `token`, `kind` (`SUBSCRIPTION`\|`BOOST`), `itemId` → checkout session (Stripe-hosted, open in browser/webview) |
| `confirmcheckout` | `token`, `sessionId` → confirm completed checkout |
| `listmybilling` | `token` → subscription status + payment history |
| `renewsubscription` | `token`, `subscriptionId` |
| `cancelsubscription` | `token`, `subscriptionId`, `confirm` (`true`) |
| `requestrefund` | `token`, `paymentId`, `reason` (8–500) |

> Web Stripe checkout is real via `createcheckout` (browser/webview flow).
> Native in-app purchases (Apple IAP / Google Play Billing) are NOT wired →
> stub with banner.

### Admin-only (NOT native scope — web Admin panel)
`adminchangeuserstatus`, `admincreateannouncement`, `admindeleteuser`,
`admingetoverview`→`getadminoverview`, `adminreviewphoto`, `adminreviewrefund`,
`adminreviewsuspicious`, `adminsaveplan`, `adminsavesetting`,
`getadminanalytics`, `getadmincommerce`, `getadminmetrics`,
`getadminpaymentdetail`, `getadminreportdetail`, `getadminuserdetail`,
`listadminmoderation`, `listadminsettings`, `listadminusers`, `moderatereport`.

## Data models (inferred from schemas)

- **user**: id (uuid), email, phone, firstName, birthDate (age 18+), gender, city/state/country, locale (en|es), role (USER/MODERATOR/ADMIN/SUPER_ADMIN), verification flags, timestamps.
- **profile**: bio, intention, occupation, education, hobbies, lifestyle, preferredGender, ageMin/ageMax, distanceMax, privacy (profileVisible, showDistance, showOnline).
- **profile_photo**: id, url, altText, position, isPrimary (max 6 photos).
- **like/pass/super_like**: id, senderId, targetId, kind, timestamps.
- **match**: id, userA/userB, conversationId, createdAt.
- **conversation/message**: id, conversationId, senderId, body, readAt, timestamps.
- **notification**: id, type (like/match/message/security/subscription/system), readAt.
- **block/report**: targetId, category, details, evidence, status.
- **subscription_plan**: id, name, interval (monthly/quarterly/annual), price, benefits.
- **subscription/payment/boost**: standard commerce records; refunds via request.

## Native stubs (documented, bannered, no fake success)

1. **OS push notifications** — no `registerpushdevice` action; in-app feed (`listnotifications`) is real.
2. **Native IAP** — Stripe web checkout via `createcheckout` is real; Apple/Google native billing not wired.
3. **Email/SMS delivery** — `requestverification`/`verifyotp`/password-reset actions are real; actual message delivery depends on the provider configured on the backend.
4. **Voice/video calls** — architecture only; no provider wired.
