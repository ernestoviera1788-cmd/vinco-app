/**
 * Shared TypeScript models for the VINCÓ native app.
 *
 * Field shapes are inferred from the BACKEND_CONTRACT.md action schemas
 * (response payload shapes were not introspectable on the backend, so most
 * fields are optional and parsed defensively in `src/api/actions.ts`).
 */

export type Locale = 'en' | 'es';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  birthDate?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
  locale: Locale;
  role?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: string;
}

export interface ProfilePrivacy {
  profileVisible: boolean;
  showDistance: boolean;
  showOnline: boolean;
}

/**
 * Full profile payload. `updateprofile` requires ALL of these fields, so the
 * app always sends the complete object (see `buildFullProfile` in actions.ts).
 */
export interface FullProfile {
  firstName: string;
  bio: string;
  city: string;
  state: string;
  country: string;
  gender: string;
  intention: string;
  occupation: string;
  education: string;
  hobbies: string;
  lifestyle: string;
  preferredGender: string;
  ageMin: number;
  ageMax: number;
  distanceMax: number;
}

export interface ProfilePhoto {
  id: string;
  url: string;
  altText?: string;
  position: number;
  isPrimary: boolean;
}

export interface DiscoveryCard {
  id: string;
  firstName: string;
  age?: number;
  city?: string;
  distanceKm?: number;
  bio?: string;
  interests?: string[];
  intention?: string;
  occupation?: string;
  photos: ProfilePhoto[];
  online?: boolean;
  raw: unknown;
}

export interface IncomingLike {
  id: string;
  senderId: string;
  kind: 'LIKE' | 'SUPER_LIKE';
  firstName?: string;
  age?: number;
  city?: string;
  photoUrl?: string;
  createdAt?: string;
  raw: unknown;
}

export interface Match {
  id: string;
  conversationId?: string;
  otherUserId?: string;
  firstName?: string;
  age?: number;
  photoUrl?: string;
  createdAt?: string;
  lastMessageAt?: string;
  raw: unknown;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt?: string | null;
  createdAt?: string;
  mine: boolean;
}

export type ReportCategory =
  | 'Fake profile'
  | 'Scam'
  | 'Harassment'
  | 'Spam'
  | 'Inappropriate content'
  | 'Threatening behavior'
  | 'Impersonation'
  | 'Other';

export interface AppNotification {
  id: string;
  type: string;
  title?: string;
  body?: string;
  readAt?: string | null;
  createdAt?: string;
  raw: unknown;
}

export interface NotificationSettings {
  likes: boolean;
  matches: boolean;
  messages: boolean;
  security: boolean;
  marketing: boolean;
}

export interface Plan {
  id: string;
  name: string;
  interval: string;
  price?: number;
  currency?: string;
  benefits?: string[];
  raw: unknown;
}

export interface BoostProduct {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  description?: string;
  raw: unknown;
}

export interface Subscription {
  id: string;
  planName?: string;
  status?: string;
  renewsAt?: string;
  raw: unknown;
}

export interface Payment {
  id: string;
  amount?: number;
  currency?: string;
  status?: string;
  createdAt?: string;
  raw: unknown;
}

export interface Session {
  id: string;
  device?: string;
  ip?: string;
  createdAt?: string;
  lastActiveAt?: string;
  current?: boolean;
}

export interface GetMeResult {
  user: User;
  profile: FullProfile | null;
  privacy: ProfilePrivacy | null;
  notificationSettings: NotificationSettings | null;
  photos: ProfilePhoto[];
  isPremium?: boolean;
}
