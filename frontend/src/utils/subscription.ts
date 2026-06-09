import type { AuthUser } from '../types';

function subscriptionActive(user: AuthUser): boolean {
  const exp = user.subscription_expires_at;
  if (!exp) return false; // NULL expiry = no active subscription
  return new Date(exp).getTime() > Date.now();
}

/** Нота Плюс или Студент с активной подпиской. */
export function isPremiumListener(user: AuthUser | null | undefined): boolean {
  if (!user || user.is_admin) return false;
  const sub = user.subscription_type ?? 'free';
  if (sub !== 'plus' && sub !== 'student') return false;
  return subscriptionActive(user);
}

/** Артист Про с активной подпиской. */
export function isArtistPro(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if ((user.artist_subscription_type ?? 'basic') !== 'pro') return false;
  return subscriptionActive(user);
}

/** Любая платная подписка (Plus, Студент или Артист Про). */
export function hasPaidSubscription(user: AuthUser | null | undefined): boolean {
  return isPremiumListener(user) || isArtistPro(user);
}

/** Бесплатный слушатель — баннеры и аудиореклама между треками. */
export function isFreeListener(user: AuthUser | null | undefined): boolean {
  if (!user) return true;
  return !isPremiumListener(user) && !isArtistPro(user);
}
