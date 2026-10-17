/**
 * Typed wrappers around the real VINCÓ RPC actions.
 *
 * ONLY actions documented in BACKEND_CONTRACT.md are called here, with the
 * exact argument shapes given there. No action names are invented.
 *
 * Response payload shapes were not introspectable on the backend, so parsers
 * below read defensively (optional chaining, fallbacks) — re-verify field
 * names against a live backend before production.
 */

import { callAction } from './client';
import type {
  AppNotification,
  BoostProduct,
  ChatMessage,
  DiscoveryCard,
  FullProfile,
  GetMeResult,
  IncomingLike,
  Locale,
  Match,
  NotificationSettings,
  Payment,
  Plan,
  ProfilePhoto,
  ProfilePrivacy,
  ReportCategory,
  Session,
  Subscription,
  User,
} from './types';

// ---------------------------------------------------------------- helpers

type AnyObj = Record<string, unknown>;

function obj(v: unknown): AnyObj {
  return typeof v === 'object' && v !== null ? (v as AnyObj) : {};
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function unwrapList(payload: unknown): unknown[] {
  // Backend may return a bare array or {items:[...]} / {data:[...]} / {results:[...]}.
  if (Array.isArray(payload)) return payload;
  const o = obj(payload);
  for (const k of ['items', 'data', 'results', 'list', 'notifications', 'messages', 'photos', 'matches', 'likes']) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  return [];
}

function parsePhoto(v: unknown): ProfilePhoto {
  const o = obj(v);
  return {
    id: str(o.id ?? o.photoId),
    url: str(o.url ?? o.photoUrl ?? o.src),
    altText: str(o.altText, undefined as unknown as string),
    position: num(o.position) ?? 0,
    isPrimary: bool(o.isPrimary ?? o.primary),
  };
}

function photoUrlOf(v: unknown): string {
  const o = obj(v);
  return (
    str(o.photoUrl) ||
    str(arr(o.photos)[0] ? obj(arr(o.photos)[0]).url : '') ||
    str(o.avatarUrl) ||
    ''
  );
}

// ---------------------------------------------------------------- auth

export interface RegisterArgs {
  email: string;
  password: string;
  firstName: string;
  birthDate: string; // ISO date string; 18+ enforced server-side
  gender: string;
  city: string;
  state?: string;
  country: string;
  phone?: string;
  locale: Locale;
  acceptedTerms: true;
}

export async function register(args: RegisterArgs): Promise<{ token: string; user: User }> {
  const data = obj(await callAction('register', { ...args }));
  return {
    token: str(data.token ?? data.sessionToken),
    user: parseUser(data.user ?? data),
  };
}

export async function login(identifier: string, password: string): Promise<{ token: string; user: User }> {
  const data = obj(await callAction('login', { identifier, password }));
  return {
    token: str(data.token ?? data.sessionToken),
    user: parseUser(data.user ?? data),
  };
}

export async function verifyOtp(
  token: string,
  channel: 'email' | 'phone',
  code: string,
): Promise<boolean> {
  await callAction('verifyotp', { channel, code }, { token });
  return true;
}

export async function requestVerification(token: string, channel: 'email' | 'phone'): Promise<void> {
  await callAction('requestverification', { channel }, { token });
}

export async function getMe(token: string): Promise<GetMeResult> {
  const data = obj(await callAction('getme', {}, { token }));
  const userSrc = obj(data.user ?? data);
  return {
    user: parseUser(userSrc),
    profile: data.profile ? parseFullProfile(data.profile) : null,
    privacy: data.privacy ? parsePrivacy(data.privacy) : null,
    notificationSettings: data.notificationSettings ? parseNotifSettings(data.notificationSettings) : null,
    photos: arr(data.photos ?? data.profilePhotos).map(parsePhoto),
    isPremium: bool(data.isPremium ?? data.premium),
  };
}

function parseUser(v: unknown): User {
  const o = obj(v);
  return {
    id: str(o.id ?? o.userId),
    email: str(o.email) || undefined,
    phone: str(o.phone) || undefined,
    firstName: str(o.firstName ?? o.name),
    birthDate: str(o.birthDate) || undefined,
    gender: str(o.gender) || undefined,
    city: str(o.city) || undefined,
    state: str(o.state) || undefined,
    country: str(o.country) || undefined,
    locale: (str(o.locale) === 'es' ? 'es' : 'en') as Locale,
    role: str(o.role) || undefined,
    emailVerified: o.emailVerified === true,
    phoneVerified: o.phoneVerified === true,
    createdAt: str(o.createdAt) || undefined,
  };
}

export async function logout(token: string): Promise<void> {
  try {
    await callAction('logout', {}, { token });
  } catch {
    // Logout is best-effort: the local session is cleared regardless.
  }
}

export async function listSessions(token: string): Promise<Session[]> {
  const payload = await callAction('listsessions', {}, { token });
  return unwrapList(payload).map((v) => {
    const o = obj(v);
    return {
      id: str(o.id ?? o.sessionId),
      device: str(o.device ?? o.userAgent) || undefined,
      ip: str(o.ip) || undefined,
      createdAt: str(o.createdAt) || undefined,
      lastActiveAt: str(o.lastActiveAt ?? o.lastSeenAt) || undefined,
      current: bool(o.current ?? o.isCurrent),
    };
  });
}

export async function revokeSession(token: string, sessionId: string): Promise<void> {
  await callAction('revokesession', { sessionId }, { token });
}

export async function requestPasswordReset(identifier: string, locale: Locale): Promise<void> {
  await callAction('requestpasswordreset', { identifier, locale });
}

export async function completePasswordReset(
  identifier: string,
  code: string,
  newPassword: string,
  locale: Locale,
): Promise<void> {
  await callAction('completepasswordreset', { identifier, code, newPassword, locale });
}

export async function recoverPassword(email: string, locale: Locale): Promise<void> {
  await callAction('recoverpassword', { email, locale });
}

export async function deleteAccount(token: string): Promise<void> {
  await callAction('deleteaccount', { confirm: 'DELETE' }, { token });
}

export async function updateLocale(token: string, locale: Locale): Promise<void> {
  await callAction('updatelocale', { locale }, { token });
}

// ---------------------------------------------------------------- profile

export const EMPTY_PROFILE: FullProfile = {
  firstName: '',
  bio: '',
  city: '',
  state: '',
  country: '',
  gender: '',
  intention: '',
  occupation: '',
  education: '',
  hobbies: '',
  lifestyle: '',
  preferredGender: '',
  ageMin: 18,
  ageMax: 99,
  distanceMax: 50,
};

function parseFullProfile(v: unknown): FullProfile {
  const o = obj(v);
  return {
    firstName: str(o.firstName),
    bio: str(o.bio),
    city: str(o.city),
    state: str(o.state),
    country: str(o.country),
    gender: str(o.gender),
    intention: str(o.intention),
    occupation: str(o.occupation),
    education: str(o.education),
    hobbies: str(o.hobbies),
    lifestyle: str(o.lifestyle),
    preferredGender: str(o.preferredGender),
    ageMin: num(o.ageMin) ?? 18,
    ageMax: num(o.ageMax) ?? 99,
    distanceMax: num(o.distanceMax) ?? 50,
  };
}

/**
 * `updateprofile` requires ALL fields, so callers merge their edits over
 * EMPTY_PROFILE (or the last known profile) and always send the full object.
 */
export function buildFullProfile(partial: Partial<FullProfile>): FullProfile {
  return { ...EMPTY_PROFILE, ...partial };
}

export async function updateProfile(token: string, profile: FullProfile): Promise<void> {
  // DIAGNÓSTICO TEMPORAL: muestra en la terminal de Expo qué se envía al backend.
  console.log(`[DIAG updateProfile] gender="${profile.gender}" preferredGender="${profile.preferredGender}" ageMin=${profile.ageMin} ageMax=${profile.ageMax}`);
  await callAction(
    'updateprofile',
    {
      firstName: profile.firstName,
      bio: profile.bio,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      gender: profile.gender,
      intention: profile.intention,
      occupation: profile.occupation,
      education: profile.education,
      hobbies: profile.hobbies,
      lifestyle: profile.lifestyle,
      preferredGender: profile.preferredGender,
      ageMin: profile.ageMin,
      ageMax: profile.ageMax,
      distanceMax: profile.distanceMax,
    },
    { token },
  );
}

function parsePrivacy(v: unknown): ProfilePrivacy {
  const o = obj(v);
  return {
    profileVisible: bool(o.profileVisible, true),
    showDistance: bool(o.showDistance, true),
    showOnline: bool(o.showOnline, true),
  };
}

export const DEFAULT_PRIVACY: ProfilePrivacy = {
  profileVisible: true,
  showDistance: true,
  showOnline: true,
};

export async function updatePrivacy(token: string, privacy: ProfilePrivacy): Promise<void> {
  await callAction(
    'updateprivacy',
    {
      profileVisible: privacy.profileVisible,
      showDistance: privacy.showDistance,
      showOnline: privacy.showOnline,
    },
    { token },
  );
}

export async function listMyPhotos(token: string): Promise<ProfilePhoto[]> {
  const payload = await callAction('listmyphotos', {}, { token });
  return unwrapList(payload).map(parsePhoto);
}

export async function uploadProfilePhoto(
  token: string,
  args: { name: string; mimeType: 'image/jpeg' | 'image/png'; dataBase64: string; altText: string },
): Promise<ProfilePhoto | null> {
  const data = obj(
    await callAction(
      'uploadprofilephoto',
      {
        name: args.name,
        mimeType: args.mimeType,
        dataBase64: args.dataBase64,
        altText: args.altText,
      },
      { token },
    ),
  );
  const photoSrc = data.photo ?? (data.id ? data : null);
  return photoSrc ? parsePhoto(photoSrc) : null;
}

export async function deleteProfilePhoto(token: string, photoId: string): Promise<void> {
  await callAction('deleteprofilephoto', { photoId }, { token });
}

export async function reorderProfilePhotos(token: string, photoIds: string[]): Promise<void> {
  await callAction('reorderprofilephotos', { photoIds }, { token });
}

export async function setPrimaryPhoto(token: string, photoId: string): Promise<void> {
  await callAction('setprimaryphoto', { photoId }, { token });
}

// ---------------------------------------------------------------- discovery & social

export async function listDiscovery(token: string): Promise<DiscoveryCard[]> {
  const payload = await callAction('listdiscovery', {}, { token });
  // DIAGNÓSTICO TEMPORAL: muestra en la terminal de Expo qué devuelve el backend.
  const rawList = unwrapList(payload);
  console.log(`[DIAG listDiscovery] perfiles recibidos: ${rawList.length}`);
  rawList.forEach((v: any, i: number) => {
    const o = obj(v);
    console.log(`[DIAG listDiscovery] #${i} id=${o.id} nombre=${o.firstName} edad=${o.age}`);
  });
  return rawList.map((v) => {
    const o = obj(v);
    const photos = arr(o.photos ?? o.profilePhotos).map(parsePhoto);
    return {
      id: str(o.id ?? o.userId ?? o.profileId),
      firstName: str(o.firstName ?? o.name),
      age: num(o.age),
      city: str(o.city) || undefined,
      distanceKm: num(o.distanceKm ?? o.distance),
      bio: str(o.bio) || undefined,
      interests: arr<string>(o.interests ?? o.hobbies),
      intention: str(o.intention) || undefined,
      occupation: str(o.occupation) || undefined,
      photos,
      online: o.online === true,
      raw: v,
    } as DiscoveryCard;
  });
}

export interface ReactResult {
  matched: boolean;
  match?: Match;
}

export async function reactToProfile(
  token: string,
  targetId: string,
  kind: 'LIKE' | 'PASS' | 'SUPER_LIKE',
): Promise<ReactResult> {
  const data = obj(await callAction('reacttoprofile', { targetId, kind }, { token }));
  const matched = bool(data.matched ?? data.isMatch ?? (data.match ? true : false));
  return {
    matched,
    match: data.match ? parseMatch(data.match) : undefined,
  };
}

export async function listLikes(token: string): Promise<IncomingLike[]> {
  const payload = await callAction('listlikes', {}, { token });
  return unwrapList(payload).map((v) => {
    const o = obj(v);
    return {
      id: str(o.id ?? o.likeId),
      senderId: str(o.senderId ?? o.userId),
      kind: o.kind === 'SUPER_LIKE' ? 'SUPER_LIKE' : 'LIKE',
      firstName: str(o.firstName ?? o.name) || undefined,
      age: num(o.age),
      city: str(o.city) || undefined,
      photoUrl: photoUrlOf(v) || undefined,
      createdAt: str(o.createdAt) || undefined,
      raw: v,
    } as IncomingLike;
  });
}

function parseMatch(v: unknown): Match {
  const o = obj(v);
  return {
    id: str(o.id ?? o.matchId),
    conversationId: str(o.conversationId) || undefined,
    otherUserId: str(o.otherUserId ?? o.userId) || undefined,
    firstName: str(o.firstName ?? o.name) || undefined,
    age: num(o.age),
    photoUrl: photoUrlOf(v) || undefined,
    createdAt: str(o.createdAt) || undefined,
    lastMessageAt: str(o.lastMessageAt) || undefined,
    raw: v,
  };
}

export async function listMatches(token: string): Promise<Match[]> {
  const payload = await callAction('listmatches', {}, { token });
  return unwrapList(payload).map(parseMatch);
}

export async function unmatch(token: string, matchId: string): Promise<void> {
  await callAction('unmatch', { matchId }, { token });
}

export async function blockUser(token: string, targetId: string): Promise<void> {
  await callAction('blockuser', { targetId }, { token });
}

export async function reportUser(
  token: string,
  args: {
    targetId: string;
    category: ReportCategory;
    details?: string;
    evidence?: { mimeType: string; dataBase64: string; altText: string };
  },
): Promise<void> {
  await callAction(
    'reportuser',
    {
      targetId: args.targetId,
      category: args.category,
      ...(args.details ? { details: args.details } : {}),
      ...(args.evidence ? { evidence: args.evidence } : {}),
    },
    { token },
  );
}

// ---------------------------------------------------------------- messaging

export async function listMessages(
  token: string,
  conversationId: string,
  myUserId: string,
): Promise<ChatMessage[]> {
  const payload = await callAction('listmessages', { conversationId }, { token });
  return unwrapList(payload)
    .map((v) => {
      const o = obj(v);
      const senderId = str(o.senderId ?? o.from ?? o.authorId);
      return {
        id: str(o.id ?? o.messageId),
        conversationId: str(o.conversationId) || conversationId,
        senderId,
        body: str(o.body ?? o.text ?? o.content),
        readAt: typeof o.readAt === 'string' ? o.readAt : null,
        createdAt: str(o.createdAt) || undefined,
        mine: senderId !== '' && senderId === myUserId,
      } as ChatMessage;
    })
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

export async function sendMessage(
  token: string,
  conversationId: string,
  body: string,
): Promise<ChatMessage | null> {
  const data = obj(await callAction('sendmessage', { conversationId, body }, { token }));
  const msgSrc = data.message ?? (data.id ? data : null);
  if (!msgSrc) return null;
  const o = obj(msgSrc);
  return {
    id: str(o.id ?? o.messageId),
    conversationId,
    senderId: str(o.senderId),
    body: str(o.body ?? o.text),
    readAt: null,
    createdAt: str(o.createdAt) || new Date().toISOString(),
    mine: true,
  };
}

export async function setTyping(
  token: string,
  conversationId: string,
  typing: boolean,
): Promise<void> {
  try {
    await callAction('settyping', { conversationId, typing }, { token });
  } catch {
    // Typing indicator is best-effort; never break the chat over it.
  }
}

// ---------------------------------------------------------------- notifications

function parseNotification(v: unknown): AppNotification {
  const o = obj(v);
  return {
    id: str(o.id ?? o.notificationId),
    type: str(o.type ?? o.kind),
    title: str(o.title) || undefined,
    body: str(o.body ?? o.message) || undefined,
    readAt: typeof o.readAt === 'string' ? o.readAt : null,
    createdAt: str(o.createdAt) || undefined,
    raw: v,
  };
}

/** Register the current device's Expo push token for this authenticated account. */
export async function registerPushDevice(
  token: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
): Promise<void> {
  await callAction('registerpushdevice', { expoPushToken, platform }, { token });
}

/** Remove this device's Expo push token from the authenticated account. */
export async function unregisterPushDevice(
  token: string,
  expoPushToken: string,
): Promise<void> {
  await callAction('unregisterpushdevice', { expoPushToken }, { token });
}

export async function listNotifications(token: string): Promise<AppNotification[]> {
  const payload = await callAction('listnotifications', {}, { token });
  return unwrapList(payload).map(parseNotification);
}

export async function markNotificationRead(token: string, notificationId: string): Promise<void> {
  await callAction('marknotificationread', { notificationId }, { token });
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  likes: true,
  matches: true,
  messages: true,
  security: true,
  marketing: false,
};

function parseNotifSettings(v: unknown): NotificationSettings {
  const o = obj(v);
  return {
    likes: bool(o.likes, true),
    matches: bool(o.matches, true),
    messages: bool(o.messages, true),
    security: bool(o.security, true),
    marketing: bool(o.marketing, false),
  };
}

export async function updateNotificationSettings(
  token: string,
  settings: NotificationSettings,
): Promise<void> {
  await callAction(
    'updatenotificationsettings',
    {
      likes: settings.likes,
      matches: settings.matches,
      messages: settings.messages,
      security: settings.security,
      marketing: settings.marketing,
    },
    { token },
  );
}

// ---------------------------------------------------------------- premium & commerce

function parsePlan(v: unknown): Plan {
  const o = obj(v);
  return {
    id: str(o.id ?? o.planId),
    name: str(o.name ?? o.title),
    interval: str(o.interval ?? o.billingInterval),
    price: num(o.price ?? o.amount),
    currency: str(o.currency) || undefined,
    benefits: arr<string>(o.benefits ?? o.features),
    raw: v,
  };
}

export async function listPlans(): Promise<Plan[]> {
  const payload = await callAction('listplans', {});
  return unwrapList(payload).map(parsePlan);
}

function parseBoost(v: unknown): BoostProduct {
  const o = obj(v);
  return {
    id: str(o.id ?? o.boostId),
    name: str(o.name ?? o.title),
    price: num(o.price ?? o.amount),
    currency: str(o.currency) || undefined,
    description: str(o.description) || undefined,
    raw: v,
  };
}

export async function listBoosts(): Promise<BoostProduct[]> {
  const payload = await callAction('listboosts', {});
  return unwrapList(payload).map(parseBoost);
}

export interface CheckoutResult {
  /** URL of the Stripe-hosted checkout page — open in the system browser. */
  checkoutUrl: string;
  sessionId?: string;
}

export async function createCheckout(
  token: string,
  kind: 'SUBSCRIPTION' | 'BOOST',
  itemId: string,
): Promise<CheckoutResult> {
  const data = obj(await callAction('createcheckout', { kind, itemId }, { token }));
  return {
    checkoutUrl: str(data.checkoutUrl ?? data.url),
    sessionId: str(data.sessionId) || undefined,
  };
}

export async function confirmCheckout(token: string, sessionId: string): Promise<void> {
  await callAction('confirmcheckout', { sessionId }, { token });
}

export interface BillingInfo {
  subscription: Subscription | null;
  payments: Payment[];
}

export async function listMyBilling(token: string): Promise<BillingInfo> {
  const data = obj(await callAction('listmybilling', {}, { token }));
  const subSrc = data.subscription ?? null;
  const sub: Subscription | null = subSrc
    ? {
        id: str(obj(subSrc).id ?? obj(subSrc).subscriptionId),
        planName: str(obj(subSrc).planName ?? obj(subSrc).plan) || undefined,
        status: str(obj(subSrc).status) || undefined,
        renewsAt: str(obj(subSrc).renewsAt ?? obj(subSrc).currentPeriodEnd) || undefined,
        raw: subSrc,
      }
    : null;
  const payments = unwrapList(data.payments ?? data.history).map((v) => {
    const o = obj(v);
    return {
      id: str(o.id ?? o.paymentId),
      amount: num(o.amount ?? o.price),
      currency: str(o.currency) || undefined,
      status: str(o.status) || undefined,
      createdAt: str(o.createdAt) || undefined,
      raw: v,
    } as Payment;
  });
  return { subscription: sub, payments };
}

export async function renewSubscription(token: string, subscriptionId: string): Promise<void> {
  await callAction('renewsubscription', { subscriptionId }, { token });
}

export async function cancelSubscription(token: string, subscriptionId: string): Promise<void> {
  await callAction('cancelsubscription', { subscriptionId, confirm: true }, { token });
}

export async function requestRefund(
  token: string,
  paymentId: string,
  reason: string,
): Promise<void> {
  await callAction('requestrefund', { paymentId, reason }, { token });
}
