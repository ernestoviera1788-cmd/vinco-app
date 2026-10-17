# AGENTS.md — vinco-native

Expo SDK 57 + Expo Router dating app. Sibling conventions live in
`~/workspace/muvy-native/AGENTS.md` — the essentials are repeated here.

## Commands

```bash
npx expo start              # dev server
npx tsc --noEmit            # typecheck (strict, must be 0 errors)
npx expo-doctor             # diagnose; must be clean
npx expo install <pkg>      # ALWAYS for adding/upgrading (resolves SDK versions)
npx expo install --fix      # align versions to the installed SDK
```

Use `npm install --legacy-peer-deps` only as a fallback; prefer `npx expo install`.

## Hard rules

- **Backend contract is law.** Only call RPC actions listed in
  `docs/BACKEND_CONTRACT.md`, with the exact arg shapes there. Never invent
  action names. Token goes INSIDE `args` (`{token}`), never as a header.
- **No mocked success.** If the backend is unreachable or an action is missing,
  the UI must fail honestly (error message / stub banner). Stubs use
  `StubBanner` and explain what's missing.
- **All UI strings from `src/i18n`.** `en.ts` and `es.ts` must keep identical
  key trees. No hardcoded user-facing literals in screens.
- **`updateprofile` requires ALL fields** — always send the full profile object
  (`buildFullProfile`).
- Run typecheck + expo-doctor before declaring work done.

## Gotchas learned

- SDK 57 renumbered expo packages to 57.x majors (e.g. `expo-router@~57.0.23`,
  `expo-image-picker@~57.0.20`). Do not reuse version numbers from older SDKs.
- SDK 57 app.json schema: no top-level `splash` or `newArchEnabled`. Splash goes
  through the `expo-splash-screen` plugin config.
- `npx expo install` fails when `expo` itself isn't installed yet — bootstrap with
  `npm install` first, then use expo install.
- Route files under `app/chat/` need `../../src/...` imports (two levels up).
