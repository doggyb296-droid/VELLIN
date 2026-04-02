'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { 
  Settings as SettingsIcon,
  Lock,
  Zap,
  Home,
  User as UserIcon,
  ArrowRight,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Search,
  Command,
  Shield,
  Activity,
  BarChart3,
  Trophy,
  Users,
  Plus,
  X,
  User,
  LogOut,
  CreditCard,
  Pencil,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createClient as createSupabaseBrowserClient } from './lib/supabase/client';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  cancelDailyNativeNudges,
  readNotificationPermission,
  requestNotificationPermission,
  scheduleDailyNativeNudges,
  sendImmediateNotification,
  type AppNotificationPermission
} from './lib/mobileNotifications';
import {
  canUseNativeDeviceUsage,
  consumeLastBlockedApp,
  getInstalledApps,
  getWeeklyUsageForLabels,
  type InstalledAppEntry,
  openFocusBlockerSettings,
  readFocusBlockerStatus,
  readDeviceUsageStatus,
  requestDeviceUsagePermission,
  syncFocusBlockConfig,
} from './lib/deviceUsage';
import {
  containsControlChars,
  normalizeEmail,
  sanitizePlainText,
} from './lib/security/input';
import { MOBILE_AUTH_REDIRECT_URL } from './lib/auth/constants';
import { PRO_MONTHLY_PLAN } from './lib/billing/plans';

const NATIVE_ACCOUNT_API_BASE_URL = 'https://vellin-tau.vercel.app';
const NATIVE_PASSWORD_RESET_REDIRECT_URL = `${MOBILE_AUTH_REDIRECT_URL}?next=/?reset_password=1`;

// --- Animation Variants ---
const formatPrettyTime = (secs: number) => {
  const hr = Math.floor(secs / 3600);
  const min = Math.floor((secs % 3600) / 60);
  if (hr > 0 && min > 0) return `${hr}h ${min}m`;
  if (hr > 0) return `${hr}h`;
  return `${min}m`;
};

const formatSessionTime = (secs: number) => {
  const hr = Math.floor(secs / 3600).toString().padStart(2, '0');
  const min = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const sc = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${hr}:${min}:${sc}`;
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } }
};

// --- Constants ---
const APP_LOGOS: Record<string, string> = {
  'Instagram': 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
  'TikTok': 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
  'X': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
  'YouTube': 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
  'Facebook': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png',
  'Netflix': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
  'WhatsApp': 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
  'Snapchat': 'https://upload.wikimedia.org/wikipedia/en/c/c4/Snapchat_logo.svg',
  'Reddit': 'https://upload.wikimedia.org/wikipedia/en/b/bd/Reddit_Logo_Icon.svg',
  'Pinterest': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Pinterest_Logo.svg'
};

type RepeatType = 'today' | 'daily' | 'weekdays';
type AchievementMetric = 'focus_seconds' | 'streak_days' | 'sessions' | 'tasks' | 'goal_days';
type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend' | 'mythic';
type DeviceUsageAccessStatus = 'unknown' | 'requested' | 'granted' | 'skipped';
type NotificationPermissionState = AppNotificationPermission;
interface UserData {
  name: string;
  survey: string[] | null;
  distractions: string[];
  mode: string | null;
  allowance: number;
}

interface Session {
  id: string;
  name: string;
  minutes: number;
  difficulty: string;
}

interface Task {
  id: string;
  title: string;
  done: boolean;
  lastCompletedDate: string | null;
  repeat: RepeatType;
  tag: string;
  priority: string;
  dueDate: string;
  startTime: string;
  durationMins: number;
}

interface ScheduleBlock {
  id: string;
  title: string;
  start: string;
  duration: number;
}

interface Achievement {
  id: string;
  title: string;
  metric: AchievementMetric;
  target: number;
  icon: string;
  color: string;
  desc: string;
  tier: AchievementTier;
}

interface ProPlan {
  summary: string;
  insights: string[];
  recommendations: string[];
  rituals: string[];
  sessions: Session[];
}

interface FriendSnapshot {
  id: string;
  name: string;
  handle: string;
  hoursSaved: number;
  distractionEvents: number;
  streak: number;
  status: string;
  trend: string;
  highlight: string;
}

interface SocialProfileRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  public_hours_saved: number;
  public_screen_time_hours: number;
  public_streak: number;
  public_sessions: number;
}

interface FriendLinkRow {
  friend_user_id: string;
}

interface SupabaseProfileRow {
  user_id: string;
  display_name: string;
  is_pro: boolean;
  daily_goal_seconds: number;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  break_reminder_mins: number;
  is_dark_mode: boolean;
  distraction_apps: string[];
}

interface PersistedState {
  activeTab: string;
  blockedByApp: Record<string, number>;
  blockedCount: number;
  breakReminderMins: number;
  completedTaskIds: string[];
  dailyGoalHits: number;
  dailyGoalSeconds: number;
  deviceUsageAccessStatus: DeviceUsageAccessStatus;
  focusByDate: Record<string, number>;
  focusScore: number;
  hasCompletedOnboarding: boolean;
  onboardingVersion: number;
  isDarkMode: boolean;
  isPro: boolean;
  lastFocusDate: string | null;
  lastGoalDate: string | null;
  lastReclaimedDate: string | null;
  maxStreak: number;
  notificationsEnabled: boolean;
  phonePickups: number;
  proPlan: ProPlan | null;
  proPricingRegion: string;
  detectedPricingRegion: string;
  hasUsedIntroTrial: boolean;
  introTrialStartedAt: string | null;
  membershipAutoRenew: boolean;
  onboardingStep: OnboardingStep;
  scheduleBlocks: ScheduleBlock[];
  sessions: Session[];
  soundEnabled: boolean;
  streak: number;
  taskCompletions: number;
  tasks: Task[];
  todayReclaimed: number;
  totalReclaimed: number;
  totalSessions: number;
  unlockedAchievements: string[];
  userData: UserData;
}

type OnboardingStep =
  | 'welcome'
  | 'survey'
  | 'recommendation'
  | 'auth'
  | 'appSelection'
  | 'usageAccess'
  | 'realityCheck'
  | 'proPlan'
  | 'completed';

const DEFAULT_USER_DATA: UserData = {
  name: '',
  survey: null,
  distractions: [],
  mode: null,
  allowance: 4
};

const DEFAULT_DISTRACTION_APPS = ['Instagram', 'TikTok', 'X', 'YouTube', 'Facebook', 'Netflix', 'WhatsApp', 'Snapchat', 'Reddit', 'Pinterest'];

const normalizeAppLabel = (value: string) => value.trim().toLowerCase();

const mergeSelectableApps = (installedApps: InstalledAppEntry[]) => {
  const seen = new Set<string>();
  const merged = [...DEFAULT_DISTRACTION_APPS];

  installedApps.forEach((app) => {
    if (!app.label?.trim()) return;
    merged.push(app.label.trim());
  });

  return merged.filter((label) => {
    const normalized = normalizeAppLabel(label);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const createTodayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const createDefaultTasks = (): Task[] => {
  const todayISO = createTodayISO();
  return [
    { id: 't1', title: 'Define top 3 priorities', done: false, lastCompletedDate: null, repeat: 'today', tag: 'Work', priority: 'High', dueDate: todayISO, startTime: '09:00', durationMins: 30 },
    { id: 't2', title: 'Deep Work block', done: false, lastCompletedDate: null, repeat: 'today', tag: 'Deep Work', priority: 'Medium', dueDate: todayISO, startTime: '10:30', durationMins: 60 },
    { id: 't3', title: 'Inbox zero sprint', done: true, lastCompletedDate: null, repeat: 'today', tag: 'Admin', priority: 'Low', dueDate: todayISO, startTime: '15:00', durationMins: 30 }
  ];
};

const DEFAULT_SESSIONS: Session[] = [
  { id: '1', name: 'Deep Work', minutes: 60, difficulty: 'High' },
  { id: '2', name: 'Chill Focus', minutes: 30, difficulty: 'Normal' }
];

const DEFAULT_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { id: 'b1', title: 'Morning Deep Work', start: '09:00', duration: 90 },
  { id: 'b2', title: 'Admin & Email', start: '11:00', duration: 30 },
  { id: 'b3', title: 'Creative Sprint', start: '14:00', duration: 60 }
];

const DAILY_NUDGE_SLOTS = [
  { hour: 9, minute: 15 },
  { hour: 14, minute: 30 },
  { hour: 20, minute: 15 }
];

const DAILY_NUDGE_LIBRARY = [
  { title: 'VELLIN check-in', body: 'Protect your next 20 minutes before the scroll tries to steal them.' },
  { title: 'Tiny reset', body: 'A calm minute now beats a distracted hour later. Reset and re-enter your day.' },
  { title: 'Hold the line', body: 'You do not need more input right now. Finish one small thing first.' },
  { title: 'Quick reality check', body: 'Open the app with intention, not habit. What are you actually here to do?' },
  { title: 'Focus looks good on you', body: 'Your attention is valuable. Spend it where today actually matters.' },
  { title: 'Evening save', body: 'Tonight can still feel clean. One focused block is enough to shift the day.' },
  { title: 'Momentum note', body: 'Progress is usually quiet. Keep going before the craving gets louder.' },
  { title: 'Choose on purpose', body: 'Before you tap another app, decide whether it helps your real plan.' },
  { title: 'Small win window', body: 'This is a good moment for a walk, water, or one focused task.' }
];

const ENABLE_LOCAL_PERSISTENCE = true;

const isRepeatType = (repeat: unknown): repeat is RepeatType =>
  repeat === 'today' || repeat === 'daily' || repeat === 'weekdays';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const ensureStableId = (prefix: string, value: unknown, index: number) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || `${prefix}-${index + 1}`;
};

type LocalizedProPricing = {
  amount: number;
  currency: string;
  countryCode: string;
  countryLabel: string;
  locale: string;
};

type PricingRegionPreference = 'auto' | keyof typeof LOCALIZED_PRO_PRICING;

const LOCALIZED_PRO_PRICING: Record<string, { amount: number; currency: string; countryLabel: string }> = {
  US: { amount: 6.99, currency: 'USD', countryLabel: 'United States' },
  GB: { amount: 5.99, currency: 'GBP', countryLabel: 'United Kingdom' },
  IE: { amount: 6.99, currency: 'EUR', countryLabel: 'Ireland' },
  FR: { amount: 6.99, currency: 'EUR', countryLabel: 'France' },
  DE: { amount: 6.99, currency: 'EUR', countryLabel: 'Germany' },
  ES: { amount: 6.99, currency: 'EUR', countryLabel: 'Spain' },
  IT: { amount: 6.99, currency: 'EUR', countryLabel: 'Italy' },
  NL: { amount: 6.99, currency: 'EUR', countryLabel: 'Netherlands' },
  CA: { amount: 8.99, currency: 'CAD', countryLabel: 'Canada' },
  AU: { amount: 10.99, currency: 'AUD', countryLabel: 'Australia' },
  NZ: { amount: 11.99, currency: 'NZD', countryLabel: 'New Zealand' },
  BR: { amount: 19.9, currency: 'BRL', countryLabel: 'Brazil' },
  IN: { amount: 299, currency: 'INR', countryLabel: 'India' },
  JP: { amount: 900, currency: 'JPY', countryLabel: 'Japan' },
};

const detectUserCountryCode = () => {
  if (typeof window === 'undefined') return 'US';

  const locale = navigator.languages?.[0] || navigator.language || 'en-US';
  try {
    const intlLocale = new Intl.Locale(locale);
    const region = intlLocale.maximize().region;
    if (region) return region.toUpperCase();
  } catch {
    // Fall back to lightweight parsing below.
  }

  const directRegion = locale.split('-')[1];
  if (directRegion) return directRegion.toUpperCase();

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (timeZone.includes('Dublin')) return 'IE';
  if (timeZone.includes('Sao_Paulo')) return 'BR';
  if (timeZone.includes('Tokyo')) return 'JP';
  if (timeZone.includes('Calcutta') || timeZone.includes('Kolkata')) return 'IN';
  if (timeZone.includes('London')) return 'GB';
  return 'US';
};

const getLocalizedProPricingForPreference = (preference: string, detectedRegion = detectUserCountryCode()): LocalizedProPricing => {
  if (typeof window === 'undefined') {
    return {
      ...LOCALIZED_PRO_PRICING.US,
      countryCode: 'US',
      locale: 'en-US',
    };
  }

  const locale = navigator.languages?.[0] || navigator.language || 'en-US';
  const countryCode = preference !== 'auto' && LOCALIZED_PRO_PRICING[preference as keyof typeof LOCALIZED_PRO_PRICING]
    ? preference
    : detectedRegion;
  const match = LOCALIZED_PRO_PRICING[countryCode as keyof typeof LOCALIZED_PRO_PRICING] || LOCALIZED_PRO_PRICING.US;

  return {
    ...match,
    countryCode,
    locale,
  };
};

const formatLocalizedPrice = ({ amount, currency, locale }: LocalizedProPricing) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return '$6.99';
  }
};

type RegionalUiCopy = {
  startTrial: string;
  viewOffer: string;
  upgradeNow: string;
  trialUsedLabel: string;
  trialHeading: string;
  trialSubheading: string;
  trialLabel: string;
  onePerAccount: string;
  accountRequired: string;
  cancelRenewal: string;
  renewalCanceled: string;
  renewalActive: string;
  chooseRegion: string;
  settingsQuick: string;
  settingsTitle: string;
  settingsMembership: string;
  settingsShieldApps: string;
  settingsPreferences: string;
  settingsRetake: string;
  settingsCreateAccount: string;
  settingsSignOut: string;
  profileTitle: string;
  actionsLabel: string;
  navigationLabel: string;
  startFocusSession: string;
  homeLabel: string;
  reviewLabel: string;
  forecastLabel: string;
  friendsLabel: string;
  profileLabel: string;
  achievementsLabel: string;
  forecastSubtitle: string;
  forecastLockedTitle: string;
  forecastLockedDescription: string;
  forecastUnlockCta: string;
  milestonesTitle: string;
};

const REGIONAL_UI_COPY: Record<string, RegionalUiCopy> = {
  US: {
    startTrial: 'Start 3-Day Trial',
    viewOffer: 'View Pro Offer',
    upgradeNow: 'Upgrade Now',
    trialUsedLabel: 'Trial already used',
    trialHeading: 'Start your 3-day free trial.',
    trialSubheading: 'You need an account first. VELLIN is preparing subscriptions, so this screen previews your one-time free trial, your local monthly price, and the Pro tools already built today.',
    trialLabel: 'Trial offer',
    onePerAccount: 'One intro trial per account',
    accountRequired: 'Account required',
    cancelRenewal: 'Cancel renewal',
    renewalCanceled: 'Renewal canceled',
    renewalActive: 'Renewal active',
    chooseRegion: 'Choose Region',
    settingsQuick: 'Quick Settings',
    settingsTitle: 'Manage your VELLIN setup',
    settingsMembership: 'Membership',
    settingsShieldApps: 'Shield Apps',
    settingsPreferences: 'Preferences',
    settingsRetake: 'Retake setup questions',
    settingsCreateAccount: 'Create account or log in',
    settingsSignOut: 'Sign Out',
    profileTitle: 'Profile',
    actionsLabel: 'ACTIONS',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Start Focus Session',
    homeLabel: 'Home',
    reviewLabel: 'Review',
    forecastLabel: 'Craving Forecast',
    friendsLabel: 'Friends',
    profileLabel: 'Profile',
    achievementsLabel: 'Milestones',
    forecastSubtitle: 'Understand and prevent your screen-time urges',
    forecastLockedTitle: 'Craving Forecast Pro',
    forecastLockedDescription: 'Unlock a deeper craving forecast, a personalized reduction roadmap, and a stronger set of prevention tools built from your own tracked VELLIN data.',
    forecastUnlockCta: 'Unlock Craving Forecast',
    milestonesTitle: 'Milestones',
  },
  IE: {
    startTrial: 'Start 3-Day Trial',
    viewOffer: 'View Pro Offer',
    upgradeNow: 'Upgrade Now',
    trialUsedLabel: 'Trial already used',
    trialHeading: 'Start your 3-day free trial.',
    trialSubheading: 'You need an account first. VELLIN is preparing subscriptions, so this screen previews your one-time free trial, your local monthly price, and the Pro tools already built today.',
    trialLabel: 'Trial offer',
    onePerAccount: 'One intro trial per account',
    accountRequired: 'Account required',
    cancelRenewal: 'Cancel renewal',
    renewalCanceled: 'Renewal canceled',
    renewalActive: 'Renewal active',
    chooseRegion: 'Choose Region',
    settingsQuick: 'Quick Settings',
    settingsTitle: 'Manage your VELLIN setup',
    settingsMembership: 'Membership',
    settingsShieldApps: 'Shield Apps',
    settingsPreferences: 'Preferences',
    settingsRetake: 'Retake setup questions',
    settingsCreateAccount: 'Create account or log in',
    settingsSignOut: 'Sign Out',
    profileTitle: 'Profile',
    actionsLabel: 'ACTIONS',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Start Focus Session',
    homeLabel: 'Home',
    reviewLabel: 'Review',
    forecastLabel: 'Craving Forecast',
    friendsLabel: 'Friends',
    profileLabel: 'Profile',
    achievementsLabel: 'Milestones',
    forecastSubtitle: 'Understand and prevent your screen-time urges',
    forecastLockedTitle: 'Craving Forecast Pro',
    forecastLockedDescription: 'Unlock a deeper craving forecast, a personalized reduction roadmap, and a stronger set of prevention tools built from your own tracked VELLIN data.',
    forecastUnlockCta: 'Unlock Craving Forecast',
    milestonesTitle: 'Milestones',
  },
  GB: {
    startTrial: 'Start 3-Day Trial',
    viewOffer: 'View Pro Offer',
    upgradeNow: 'Upgrade Now',
    trialUsedLabel: 'Trial already used',
    trialHeading: 'Start your 3-day free trial.',
    trialSubheading: 'You need an account first. VELLIN is preparing subscriptions, so this screen previews your one-time free trial, your local monthly price, and the Pro tools already built today.',
    trialLabel: 'Trial offer',
    onePerAccount: 'One intro trial per account',
    accountRequired: 'Account required',
    cancelRenewal: 'Cancel renewal',
    renewalCanceled: 'Renewal canceled',
    renewalActive: 'Renewal active',
    chooseRegion: 'Choose Region',
    settingsQuick: 'Quick Settings',
    settingsTitle: 'Manage your VELLIN setup',
    settingsMembership: 'Membership',
    settingsShieldApps: 'Shield Apps',
    settingsPreferences: 'Preferences',
    settingsRetake: 'Retake setup questions',
    settingsCreateAccount: 'Create account or log in',
    settingsSignOut: 'Sign Out',
    profileTitle: 'Profile',
    actionsLabel: 'ACTIONS',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Start Focus Session',
    homeLabel: 'Home',
    reviewLabel: 'Review',
    forecastLabel: 'Craving Forecast',
    friendsLabel: 'Friends',
    profileLabel: 'Profile',
    achievementsLabel: 'Milestones',
    forecastSubtitle: 'Understand and prevent your screen-time urges',
    forecastLockedTitle: 'Craving Forecast Pro',
    forecastLockedDescription: 'Unlock a deeper craving forecast, a personalized reduction roadmap, and a stronger set of prevention tools built from your own tracked VELLIN data.',
    forecastUnlockCta: 'Unlock Craving Forecast',
    milestonesTitle: 'Milestones',
  },
  FR: {
    startTrial: 'Essai gratuit 3 jours',
    viewOffer: "Voir l'offre Pro",
    upgradeNow: 'Passer à Pro',
    trialUsedLabel: 'Essai déjà utilisé',
    trialHeading: 'Commencez votre essai gratuit de 3 jours.',
    trialSubheading: "Vous avez d'abord besoin d'un compte. VELLIN prépare les abonnements, donc cet écran présente votre essai unique, votre prix mensuel local et les outils Pro déjà disponibles.",
    trialLabel: "Offre d'essai",
    onePerAccount: 'Un seul essai par compte',
    accountRequired: 'Compte requis',
    cancelRenewal: 'Annuler le renouvellement',
    renewalCanceled: 'Renouvellement annulé',
    renewalActive: 'Renouvellement actif',
    chooseRegion: 'Choisir la région',
    settingsQuick: 'Réglages rapides',
    settingsTitle: 'Gérez votre configuration VELLIN',
    settingsMembership: 'Abonnement',
    settingsShieldApps: 'Apps bloquées',
    settingsPreferences: 'Préférences',
    settingsRetake: 'Refaire les questions',
    settingsCreateAccount: 'Créer un compte ou se connecter',
    settingsSignOut: 'Se déconnecter',
    profileTitle: 'Profil',
    actionsLabel: 'ACTIONS',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Démarrer une session focus',
    homeLabel: 'Accueil',
    reviewLabel: 'Analyse',
    forecastLabel: 'Prévision des envies',
    friendsLabel: 'Amis',
    profileLabel: 'Profil',
    achievementsLabel: 'Étapes',
    forecastSubtitle: 'Comprenez et évitez vos envies de temps d’écran',
    forecastLockedTitle: 'Prévision des envies Pro',
    forecastLockedDescription: 'Débloquez une analyse plus profonde des envies, une feuille de route personnalisée et de meilleurs outils de prévention basés sur vos données VELLIN.',
    forecastUnlockCta: 'Débloquer la prévision',
    milestonesTitle: 'Étapes',
  },
  DE: {
    startTrial: '3 Tage gratis testen',
    viewOffer: 'Pro-Angebot ansehen',
    upgradeNow: 'Jetzt upgraden',
    trialUsedLabel: 'Testphase bereits genutzt',
    trialHeading: 'Starte deine 3-tägige Testphase.',
    trialSubheading: 'Du brauchst zuerst ein Konto. VELLIN bereitet Abos vor, daher zeigt dieser Bildschirm deine einmalige Testphase, deinen lokalen Monatspreis und die heute verfügbaren Pro-Tools.',
    trialLabel: 'Testangebot',
    onePerAccount: 'Nur eine Testphase pro Konto',
    accountRequired: 'Konto erforderlich',
    cancelRenewal: 'Verlängerung kündigen',
    renewalCanceled: 'Verlängerung beendet',
    renewalActive: 'Verlängerung aktiv',
    chooseRegion: 'Region wählen',
    settingsQuick: 'Schnelleinstellungen',
    settingsTitle: 'Dein VELLIN-Setup verwalten',
    settingsMembership: 'Mitgliedschaft',
    settingsShieldApps: 'Blockier-Apps',
    settingsPreferences: 'Einstellungen',
    settingsRetake: 'Fragen erneut starten',
    settingsCreateAccount: 'Konto erstellen oder anmelden',
    settingsSignOut: 'Abmelden',
    profileTitle: 'Profil',
    actionsLabel: 'AKTIONEN',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Fokussitzung starten',
    homeLabel: 'Start',
    reviewLabel: 'Analyse',
    forecastLabel: 'Craving-Prognose',
    friendsLabel: 'Freunde',
    profileLabel: 'Profil',
    achievementsLabel: 'Meilensteine',
    forecastSubtitle: 'Verstehe und vermeide deine Bildschirmzeit-Impulse',
    forecastLockedTitle: 'Craving-Prognose Pro',
    forecastLockedDescription: 'Schalte eine tiefere Craving-Prognose, einen persönlichen Reduktionsplan und bessere Präventionshilfen auf Basis deiner VELLIN-Daten frei.',
    forecastUnlockCta: 'Prognose freischalten',
    milestonesTitle: 'Meilensteine',
  },
  ES: {
    startTrial: 'Prueba gratis de 3 días',
    viewOffer: 'Ver oferta Pro',
    upgradeNow: 'Actualizar ahora',
    trialUsedLabel: 'Prueba ya utilizada',
    trialHeading: 'Empieza tu prueba gratis de 3 días.',
    trialSubheading: 'Primero necesitas una cuenta. VELLIN está preparando las suscripciones, así que esta pantalla muestra tu prueba única, tu precio mensual local y las herramientas Pro que ya existen.',
    trialLabel: 'Oferta de prueba',
    onePerAccount: 'Una sola prueba por cuenta',
    accountRequired: 'Cuenta obligatoria',
    cancelRenewal: 'Cancelar renovación',
    renewalCanceled: 'Renovación cancelada',
    renewalActive: 'Renovación activa',
    chooseRegion: 'Elegir región',
    settingsQuick: 'Ajustes rápidos',
    settingsTitle: 'Gestiona tu configuración de VELLIN',
    settingsMembership: 'Membresía',
    settingsShieldApps: 'Apps bloqueadas',
    settingsPreferences: 'Preferencias',
    settingsRetake: 'Repetir preguntas',
    settingsCreateAccount: 'Crear cuenta o iniciar sesión',
    settingsSignOut: 'Cerrar sesión',
    profileTitle: 'Perfil',
    actionsLabel: 'ACCIONES',
    navigationLabel: 'NAVEGACIÓN',
    startFocusSession: 'Empezar sesión de foco',
    homeLabel: 'Inicio',
    reviewLabel: 'Análisis',
    forecastLabel: 'Pronóstico de antojos',
    friendsLabel: 'Amigos',
    profileLabel: 'Perfil',
    achievementsLabel: 'Hitos',
    forecastSubtitle: 'Entiende y evita tus impulsos de tiempo de pantalla',
    forecastLockedTitle: 'Pronóstico de antojos Pro',
    forecastLockedDescription: 'Desbloquea un pronóstico más profundo, una hoja de ruta personalizada y mejores herramientas de prevención basadas en tus datos de VELLIN.',
    forecastUnlockCta: 'Desbloquear pronóstico',
    milestonesTitle: 'Hitos',
  },
  IT: {
    startTrial: 'Prova gratuita di 3 giorni',
    viewOffer: "Vedi l'offerta Pro",
    upgradeNow: 'Passa a Pro',
    trialUsedLabel: 'Prova già usata',
    trialHeading: 'Inizia la prova gratuita di 3 giorni.',
    trialSubheading: "Hai prima bisogno di un account. VELLIN sta preparando gli abbonamenti, quindi questa schermata mostra la tua prova unica, il prezzo mensile locale e gli strumenti Pro già disponibili.",
    trialLabel: 'Offerta di prova',
    onePerAccount: 'Una sola prova per account',
    accountRequired: 'Account richiesto',
    cancelRenewal: 'Annulla rinnovo',
    renewalCanceled: 'Rinnovo annullato',
    renewalActive: 'Rinnovo attivo',
    chooseRegion: 'Scegli regione',
    settingsQuick: 'Impostazioni rapide',
    settingsTitle: 'Gestisci la configurazione di VELLIN',
    settingsMembership: 'Abbonamento',
    settingsShieldApps: 'App bloccate',
    settingsPreferences: 'Preferenze',
    settingsRetake: 'Ripeti le domande',
    settingsCreateAccount: 'Crea account o accedi',
    settingsSignOut: 'Esci',
    profileTitle: 'Profilo',
    actionsLabel: 'AZIONI',
    navigationLabel: 'NAVIGAZIONE',
    startFocusSession: 'Avvia sessione focus',
    homeLabel: 'Home',
    reviewLabel: 'Analisi',
    forecastLabel: 'Previsione cravings',
    friendsLabel: 'Amici',
    profileLabel: 'Profilo',
    achievementsLabel: 'Traguardi',
    forecastSubtitle: 'Capisci e previeni i tuoi impulsi di tempo schermo',
    forecastLockedTitle: 'Previsione cravings Pro',
    forecastLockedDescription: 'Sblocca una previsione più profonda, una roadmap personalizzata e strumenti di prevenzione migliori basati sui tuoi dati VELLIN.',
    forecastUnlockCta: 'Sblocca previsione',
    milestonesTitle: 'Traguardi',
  },
  NL: {
    startTrial: 'Start proefperiode van 3 dagen',
    viewOffer: 'Bekijk Pro-aanbod',
    upgradeNow: 'Nu upgraden',
    trialUsedLabel: 'Proefperiode al gebruikt',
    trialHeading: 'Start je gratis proefperiode van 3 dagen.',
    trialSubheading: 'Je hebt eerst een account nodig. VELLIN bereidt abonnementen voor, dus dit scherm toont je eenmalige proefperiode, je lokale maandprijs en de Pro-tools die nu al beschikbaar zijn.',
    trialLabel: 'Proefaanbod',
    onePerAccount: 'Eén proefperiode per account',
    accountRequired: 'Account vereist',
    cancelRenewal: 'Verlenging annuleren',
    renewalCanceled: 'Verlenging geannuleerd',
    renewalActive: 'Verlenging actief',
    chooseRegion: 'Regio kiezen',
    settingsQuick: 'Snelle instellingen',
    settingsTitle: 'Beheer je VELLIN-instelling',
    settingsMembership: 'Lidmaatschap',
    settingsShieldApps: 'Blokkeer-apps',
    settingsPreferences: 'Voorkeuren',
    settingsRetake: 'Vragen opnieuw doen',
    settingsCreateAccount: 'Account maken of inloggen',
    settingsSignOut: 'Uitloggen',
    profileTitle: 'Profiel',
    actionsLabel: 'ACTIES',
    navigationLabel: 'NAVIGATIE',
    startFocusSession: 'Focussessie starten',
    homeLabel: 'Home',
    reviewLabel: 'Analyse',
    forecastLabel: 'Craving-voorspelling',
    friendsLabel: 'Vrienden',
    profileLabel: 'Profiel',
    achievementsLabel: 'Mijlpalen',
    forecastSubtitle: 'Begrijp en voorkom je schermtijd-neigingen',
    forecastLockedTitle: 'Craving-voorspelling Pro',
    forecastLockedDescription: 'Ontgrendel een diepere craving-voorspelling, een persoonlijk reductieplan en sterkere preventietools op basis van je VELLIN-data.',
    forecastUnlockCta: 'Voorspelling ontgrendelen',
    milestonesTitle: 'Mijlpalen',
  },
  BR: {
    startTrial: 'Começar teste grátis',
    viewOffer: 'Ver oferta Pro',
    upgradeNow: 'Fazer upgrade agora',
    trialUsedLabel: 'Teste já usado',
    trialHeading: 'Comece seu teste grátis de 3 dias.',
    trialSubheading: 'Você precisa de uma conta primeiro. A VELLIN ainda está preparando as assinaturas, então esta tela mostra seu teste único, seu preço mensal local e as ferramentas Pro já disponíveis.',
    trialLabel: 'Oferta de teste',
    onePerAccount: 'Um único teste por conta',
    accountRequired: 'Conta obrigatória',
    cancelRenewal: 'Cancelar renovação',
    renewalCanceled: 'Renovação cancelada',
    renewalActive: 'Renovação ativa',
    chooseRegion: 'Escolher região',
    settingsQuick: 'Configurações rápidas',
    settingsTitle: 'Gerencie sua configuração da VELLIN',
    settingsMembership: 'Assinatura',
    settingsShieldApps: 'Apps bloqueados',
    settingsPreferences: 'Preferências',
    settingsRetake: 'Refazer perguntas',
    settingsCreateAccount: 'Criar conta ou entrar',
    settingsSignOut: 'Sair',
    profileTitle: 'Perfil',
    actionsLabel: 'AÇÕES',
    navigationLabel: 'NAVEGAÇÃO',
    startFocusSession: 'Iniciar sessão de foco',
    homeLabel: 'Início',
    reviewLabel: 'Análise',
    forecastLabel: 'Previsão de desejo',
    friendsLabel: 'Amigos',
    profileLabel: 'Perfil',
    achievementsLabel: 'Marcos',
    forecastSubtitle: 'Entenda e evite seus impulsos de tempo de tela',
    forecastLockedTitle: 'Previsão de desejo Pro',
    forecastLockedDescription: 'Desbloqueie uma previsão mais profunda, um plano personalizado e ferramentas de prevenção melhores com base nos seus dados da VELLIN.',
    forecastUnlockCta: 'Desbloquear previsão',
    milestonesTitle: 'Marcos',
  },
  JP: {
    startTrial: '3日間無料トライアル',
    viewOffer: 'Proオファーを見る',
    upgradeNow: '今すぐアップグレード',
    trialUsedLabel: 'トライアルは使用済みです',
    trialHeading: '3日間の無料トライアルを始めましょう。',
    trialSubheading: '最初にアカウントが必要です。VELLINはサブスクリプション準備中のため、この画面では一度きりの無料トライアル、地域価格、現在使えるPro機能を表示します。',
    trialLabel: 'トライアル',
    onePerAccount: '1アカウントにつき1回のみ',
    accountRequired: 'アカウントが必要です',
    cancelRenewal: '自動更新を停止',
    renewalCanceled: '更新停止済み',
    renewalActive: '更新中',
    chooseRegion: '地域を選択',
    settingsQuick: 'クイック設定',
    settingsTitle: 'VELLIN設定を管理',
    settingsMembership: 'メンバーシップ',
    settingsShieldApps: 'ブロックアプリ',
    settingsPreferences: '設定',
    settingsRetake: '質問をやり直す',
    settingsCreateAccount: 'アカウント作成 / ログイン',
    settingsSignOut: 'ログアウト',
    profileTitle: 'プロフィール',
    actionsLabel: 'アクション',
    navigationLabel: 'ナビゲーション',
    startFocusSession: '集中セッションを開始',
    homeLabel: 'ホーム',
    reviewLabel: 'レビュー',
    forecastLabel: '欲求予測',
    friendsLabel: '友だち',
    profileLabel: 'プロフィール',
    achievementsLabel: 'マイルストーン',
    forecastSubtitle: 'スクリーンタイムの衝動を理解して防ぎましょう',
    forecastLockedTitle: '欲求予測 Pro',
    forecastLockedDescription: 'より深い欲求分析、個別ロードマップ、そしてVELLINデータに基づく強力な予防ツールを解除します。',
    forecastUnlockCta: '欲求予測を解除',
    milestonesTitle: 'マイルストーン',
  },
  IN: {
    startTrial: 'Start 3-Day Trial',
    viewOffer: 'View Pro Offer',
    upgradeNow: 'Upgrade Now',
    trialUsedLabel: 'Trial already used',
    trialHeading: 'Start your 3-day free trial.',
    trialSubheading: 'You need an account first. VELLIN is preparing subscriptions, so this screen previews your one-time free trial, your local monthly price, and the Pro tools already built today.',
    trialLabel: 'Trial offer',
    onePerAccount: 'One intro trial per account',
    accountRequired: 'Account required',
    cancelRenewal: 'Cancel renewal',
    renewalCanceled: 'Renewal canceled',
    renewalActive: 'Renewal active',
    chooseRegion: 'Choose Region',
    settingsQuick: 'Quick Settings',
    settingsTitle: 'Manage your VELLIN setup',
    settingsMembership: 'Membership',
    settingsShieldApps: 'Shield Apps',
    settingsPreferences: 'Preferences',
    settingsRetake: 'Retake setup questions',
    settingsCreateAccount: 'Create account or log in',
    settingsSignOut: 'Sign Out',
    profileTitle: 'Profile',
    actionsLabel: 'ACTIONS',
    navigationLabel: 'NAVIGATION',
    startFocusSession: 'Start Focus Session',
    homeLabel: 'Home',
    reviewLabel: 'Review',
    forecastLabel: 'Craving Forecast',
    friendsLabel: 'Friends',
    profileLabel: 'Profile',
    achievementsLabel: 'Milestones',
    forecastSubtitle: 'Understand and prevent your screen-time urges',
    forecastLockedTitle: 'Craving Forecast Pro',
    forecastLockedDescription: 'Unlock a deeper craving forecast, a personalized reduction roadmap, and a stronger set of prevention tools built from your own tracked VELLIN data.',
    forecastUnlockCta: 'Unlock Craving Forecast',
    milestonesTitle: 'Milestones',
  },
};

const getRegionalUiCopy = (countryCode: string): RegionalUiCopy =>
  REGIONAL_UI_COPY[countryCode] || REGIONAL_UI_COPY.US;

const UI_STRING_DEFAULTS = {
  welcomeTitle: 'Master Your Focus',
  welcomeSubtitle: 'VELLIN helps you reclaim your time and achieve deep, uninterrupted focus. Ready to begin?',
  getStarted: 'Get Started',
  authCreateTitle: 'Create your account',
  authLoginTitle: 'Welcome back',
  authCreateDesc: 'Save your focus plan, cravings data, and progress across devices.',
  authLoginDesc: 'Log in to restore your focus system and pick up where you left off.',
  createAccount: 'Create Account',
  logIn: 'Log In',
  preferredName: 'Preferred Name',
  emailAddress: 'Email Address',
  password: 'Password',
  forgotPassword: 'Forgot password?',
  continueWithoutAccount: 'Continue without account',
  alreadyHaveAccount: 'Already have an account? Log In',
  needNewAccount: 'Need a new account? Create one',
  distractionsTitle: 'Distractions',
  distractionsSubtitle: 'Select the primary apps pulling you from your goals.',
  browseApps: 'Browse All Installed Apps',
  allApps: 'All Apps',
  close: 'Close',
  setTargets: 'Set Distraction Targets',
  screenTimeTitle: 'Can VELLIN use your screen time data?',
  screenTimeYes: 'Yes, use my screen time data',
  maybeLater: 'Maybe later',
  reviewTitle: 'Review',
  reviewSubtitle: 'Activity, pickups, and focus trends',
  today: 'Today',
  lastWeek: 'Last Week',
  thirtyDays: '30 Days',
  friendsTitle: 'Friends',
  friendsSubtitle: 'Stay accountable with the people lowering distraction pressure with you.',
  invite: 'Invite',
  addFriend: 'Add Friend',
  addFriendPlaceholder: 'Enter username, e.g. maya_focus',
  weeklyLeaderboard: 'Weekly Leaderboard',
  rankedByHours: 'Ranked by hours saved this week',
  leaderboard: 'Leaderboard',
  milestonesUnlocked: 'Milestones Unlocked',
  leveledUp: "You've just leveled up your focus journey.",
  continue: 'Continue',
} as const;

type UiStringKey = keyof typeof UI_STRING_DEFAULTS;

const UI_STRING_OVERRIDES: Record<string, Partial<Record<UiStringKey, string>>> = {
  FR: {
    welcomeTitle: 'Maîtrisez votre focus',
    welcomeSubtitle: 'VELLIN vous aide à reprendre votre temps et à retrouver un focus profond et calme. Prêt à commencer ?',
    getStarted: 'Commencer',
    authCreateTitle: 'Créez votre compte',
    authLoginTitle: 'Bon retour',
    authCreateDesc: 'Enregistrez votre plan, vos données et vos progrès sur tous vos appareils.',
    authLoginDesc: 'Connectez-vous pour retrouver votre système de focus.',
    createAccount: 'Créer un compte',
    logIn: 'Se connecter',
    preferredName: 'Prénom',
    emailAddress: 'Adresse e-mail',
    password: 'Mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    continueWithoutAccount: 'Continuer sans compte',
    alreadyHaveAccount: 'Vous avez déjà un compte ? Se connecter',
    needNewAccount: 'Besoin d’un compte ? Créer un compte',
    distractionsTitle: 'Distractions',
    distractionsSubtitle: 'Choisissez les apps qui vous éloignent le plus de vos objectifs.',
    browseApps: 'Voir toutes les apps',
    allApps: 'Toutes les apps',
    close: 'Fermer',
    setTargets: 'Définir les distractions',
    screenTimeTitle: 'VELLIN peut-il utiliser vos données de temps d’écran ?',
    screenTimeYes: 'Oui, utiliser mes données',
    maybeLater: 'Plus tard',
    reviewTitle: 'Analyse',
    reviewSubtitle: 'Activité, ouvertures du téléphone et tendances de focus',
    today: "Aujourd'hui",
    lastWeek: 'Semaine passée',
    thirtyDays: '30 jours',
    friendsTitle: 'Amis',
    friendsSubtitle: 'Restez motivé avec les personnes qui réduisent les distractions avec vous.',
    invite: 'Inviter',
    addFriend: 'Ajouter',
    addFriendPlaceholder: "Entrez un nom d'utilisateur",
    weeklyLeaderboard: 'Classement hebdomadaire',
    rankedByHours: 'Classé par heures gagnées cette semaine',
    leaderboard: 'Classement',
    milestonesUnlocked: 'Étapes débloquées',
    leveledUp: 'Vous venez de franchir une nouvelle étape.',
    continue: 'Continuer',
  },
  DE: {
    welcomeTitle: 'Meistere deinen Fokus',
    welcomeSubtitle: 'VELLIN hilft dir, deine Zeit zurückzuholen und tiefen, ungestörten Fokus aufzubauen. Bereit?',
    getStarted: 'Los geht’s',
    authCreateTitle: 'Konto erstellen',
    authLoginTitle: 'Willkommen zurück',
    authCreateDesc: 'Speichere deinen Fokusplan, deine Daten und Fortschritte auf allen Geräten.',
    authLoginDesc: 'Melde dich an, um dein Fokussystem wiederherzustellen.',
    createAccount: 'Konto erstellen',
    logIn: 'Anmelden',
    preferredName: 'Bevorzugter Name',
    emailAddress: 'E-Mail-Adresse',
    password: 'Passwort',
    forgotPassword: 'Passwort vergessen?',
    continueWithoutAccount: 'Ohne Konto fortfahren',
    alreadyHaveAccount: 'Schon ein Konto? Anmelden',
    needNewAccount: 'Neues Konto erstellen',
    distractionsTitle: 'Ablenkungen',
    distractionsSubtitle: 'Wähle die Apps, die dich am stärksten von deinen Zielen abziehen.',
    browseApps: 'Alle Apps durchsuchen',
    allApps: 'Alle Apps',
    close: 'Schließen',
    setTargets: 'Ablenkungsziele setzen',
    screenTimeTitle: 'Darf VELLIN deine Bildschirmzeitdaten verwenden?',
    screenTimeYes: 'Ja, meine Daten nutzen',
    maybeLater: 'Später',
    reviewTitle: 'Analyse',
    reviewSubtitle: 'Aktivität, Handy-Aufnahmen und Fokus-Trends',
    today: 'Heute',
    lastWeek: 'Letzte Woche',
    thirtyDays: '30 Tage',
    friendsTitle: 'Freunde',
    friendsSubtitle: 'Bleib gemeinsam mit anderen auf Kurs.',
    invite: 'Einladen',
    addFriend: 'Freund hinzufügen',
    addFriendPlaceholder: 'Benutzernamen eingeben',
    weeklyLeaderboard: 'Wochenrangliste',
    rankedByHours: 'Nach gesparten Stunden dieser Woche',
    leaderboard: 'Rangliste',
    milestonesUnlocked: 'Meilensteine freigeschaltet',
    leveledUp: 'Du hast gerade eine neue Stufe erreicht.',
    continue: 'Weiter',
  },
  ES: {
    welcomeTitle: 'Domina tu enfoque',
    welcomeSubtitle: 'VELLIN te ayuda a recuperar tu tiempo y lograr concentración profunda sin interrupciones. ¿Empezamos?',
    getStarted: 'Empezar',
    authCreateTitle: 'Crea tu cuenta',
    authLoginTitle: 'Bienvenido de nuevo',
    authCreateDesc: 'Guarda tu plan, tus datos y tu progreso en todos tus dispositivos.',
    authLoginDesc: 'Inicia sesión para recuperar tu sistema de enfoque.',
    createAccount: 'Crear cuenta',
    logIn: 'Iniciar sesión',
    preferredName: 'Nombre',
    emailAddress: 'Correo electrónico',
    password: 'Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    continueWithoutAccount: 'Continuar sin cuenta',
    alreadyHaveAccount: '¿Ya tienes cuenta? Inicia sesión',
    needNewAccount: '¿Necesitas una cuenta? Crea una',
    distractionsTitle: 'Distracciones',
    distractionsSubtitle: 'Selecciona las apps que más te apartan de tus objetivos.',
    browseApps: 'Ver todas las apps',
    allApps: 'Todas las apps',
    close: 'Cerrar',
    setTargets: 'Definir distracciones',
    screenTimeTitle: '¿Puede VELLIN usar tus datos de tiempo de pantalla?',
    screenTimeYes: 'Sí, usar mis datos',
    maybeLater: 'Más tarde',
    reviewTitle: 'Análisis',
    reviewSubtitle: 'Actividad, desbloqueos y tendencias de enfoque',
    today: 'Hoy',
    lastWeek: 'Última semana',
    thirtyDays: '30 días',
    friendsTitle: 'Amigos',
    friendsSubtitle: 'Mantente constante con las personas que también están reduciendo distracciones.',
    invite: 'Invitar',
    addFriend: 'Añadir amigo',
    addFriendPlaceholder: 'Introduce un nombre de usuario',
    weeklyLeaderboard: 'Clasificación semanal',
    rankedByHours: 'Ordenado por horas ahorradas esta semana',
    leaderboard: 'Clasificación',
    milestonesUnlocked: 'Hitos desbloqueados',
    leveledUp: 'Acabas de subir de nivel.',
    continue: 'Continuar',
  },
  IT: {
    welcomeTitle: 'Domina il tuo focus',
    welcomeSubtitle: 'VELLIN ti aiuta a riprenderti il tuo tempo e a costruire una concentrazione profonda. Pronto a iniziare?',
    getStarted: 'Inizia',
    authCreateTitle: 'Crea il tuo account',
    authLoginTitle: 'Bentornato',
    authCreateDesc: 'Salva il tuo piano, i tuoi dati e i tuoi progressi su tutti i dispositivi.',
    authLoginDesc: 'Accedi per riprendere il tuo sistema di focus.',
    createAccount: 'Crea account',
    logIn: 'Accedi',
    preferredName: 'Nome preferito',
    emailAddress: 'Email',
    password: 'Password',
    forgotPassword: 'Password dimenticata?',
    continueWithoutAccount: 'Continua senza account',
    alreadyHaveAccount: 'Hai già un account? Accedi',
    needNewAccount: 'Ti serve un account? Creane uno',
  },
  NL: {
    welcomeTitle: 'Beheers je focus',
    welcomeSubtitle: 'VELLIN helpt je je tijd terug te pakken en diepe, rustige focus op te bouwen. Klaar om te beginnen?',
    getStarted: 'Aan de slag',
    authCreateTitle: 'Maak je account',
    authLoginTitle: 'Welkom terug',
    authCreateDesc: 'Sla je plan, data en voortgang op al je apparaten op.',
    authLoginDesc: 'Log in om je focussysteem terug te halen.',
    createAccount: 'Account maken',
    logIn: 'Inloggen',
    preferredName: 'Voorkeursnaam',
    emailAddress: 'E-mailadres',
    password: 'Wachtwoord',
    forgotPassword: 'Wachtwoord vergeten?',
    continueWithoutAccount: 'Doorgaan zonder account',
    alreadyHaveAccount: 'Al een account? Inloggen',
    needNewAccount: 'Nieuw account maken',
  },
  BR: {
    welcomeTitle: 'Domine seu foco',
    welcomeSubtitle: 'A VELLIN ajuda você a recuperar seu tempo e alcançar foco profundo sem interrupções. Vamos começar?',
    getStarted: 'Começar',
    authCreateTitle: 'Crie sua conta',
    authLoginTitle: 'Bem-vindo de volta',
    authCreateDesc: 'Salve seu plano, seus dados e seu progresso em todos os dispositivos.',
    authLoginDesc: 'Entre para restaurar seu sistema de foco.',
    createAccount: 'Criar conta',
    logIn: 'Entrar',
    preferredName: 'Nome',
    emailAddress: 'E-mail',
    password: 'Senha',
    forgotPassword: 'Esqueceu a senha?',
    continueWithoutAccount: 'Continuar sem conta',
    alreadyHaveAccount: 'Já tem conta? Entrar',
    needNewAccount: 'Precisa de conta? Criar',
  },
  JP: {
    welcomeTitle: '集中を取り戻そう',
    welcomeSubtitle: 'VELLINは時間を取り戻し、深く静かな集中を作るお手伝いをします。始めましょうか？',
    getStarted: 'はじめる',
    authCreateTitle: 'アカウント作成',
    authLoginTitle: 'おかえりなさい',
    authCreateDesc: 'プラン、データ、進捗をデバイス間で保存します。',
    authLoginDesc: 'ログインして集中システムを再開しましょう。',
    createAccount: 'アカウント作成',
    logIn: 'ログイン',
    preferredName: '表示名',
    emailAddress: 'メールアドレス',
    password: 'パスワード',
    forgotPassword: 'パスワードを忘れましたか？',
    continueWithoutAccount: 'アカウントなしで続ける',
    alreadyHaveAccount: 'アカウントをお持ちですか？ ログイン',
    needNewAccount: '新しいアカウントを作成',
  },
};

const getUiString = (countryCode: string, key: UiStringKey) =>
  UI_STRING_OVERRIDES[countryCode]?.[key] || UI_STRING_DEFAULTS[key];

const ONBOARDING_FLOW_VERSION = 2;
const ONBOARDING_RESTORABLE_STEPS: OnboardingStep[] = ['welcome', 'survey', 'recommendation', 'auth', 'appSelection', 'usageAccess', 'realityCheck', 'proPlan', 'completed'];

const hasStoredSurveyAnswers = (value: unknown): value is string[] =>
  Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry.trim().length > 0);

const resolveRestoredOnboardingState = (saved: Partial<PersistedState>, initialRecoveryMode = false) => {
  if (initialRecoveryMode) {
    return {
      hasCompletedOnboarding: false,
      onboardingStep: 'auth' as OnboardingStep,
    };
  }

  const savedVersion = typeof saved.onboardingVersion === 'number' ? saved.onboardingVersion : 0;
  const hasCurrentOnboardingVersion = savedVersion >= ONBOARDING_FLOW_VERSION;
  const savedUsageStatus = saved.deviceUsageAccessStatus === 'requested'
    || saved.deviceUsageAccessStatus === 'granted'
    || saved.deviceUsageAccessStatus === 'skipped'
    ? saved.deviceUsageAccessStatus
    : 'unknown';
  const hasSurveyAnswers = hasStoredSurveyAnswers(saved.userData?.survey);
  const shouldRestartSetup = !hasCurrentOnboardingVersion || !hasSurveyAnswers;
  const savedOnboardingStep = ONBOARDING_RESTORABLE_STEPS.includes(saved.onboardingStep as OnboardingStep)
    ? (saved.onboardingStep as OnboardingStep)
    : 'welcome';

  if (shouldRestartSetup) {
    return {
      hasCompletedOnboarding: false,
      onboardingStep: 'welcome' as OnboardingStep,
    };
  }

  if (Boolean(saved.hasCompletedOnboarding) && canUseNativeDeviceUsage() && savedUsageStatus === 'unknown') {
    return {
      hasCompletedOnboarding: false,
      onboardingStep: 'usageAccess' as OnboardingStep,
    };
  }

  const hasCompletedOnboarding = Boolean(saved.hasCompletedOnboarding);

  return {
    hasCompletedOnboarding,
    onboardingStep: hasCompletedOnboarding ? ('completed' as OnboardingStep) : savedOnboardingStep,
  };
};

const normalizePersistedState = (saved: Partial<PersistedState>): Partial<PersistedState> => {
  const today = new Date().toDateString();
  const lastReclaimedDate = typeof saved.lastReclaimedDate === 'string' ? saved.lastReclaimedDate : null;
  const normalizedSessions = Array.isArray(saved.sessions)
    ? (saved.sessions as Session[]).map((session, index) => ({
        ...session,
        id: ensureStableId('session', session.id, index)
      }))
    : DEFAULT_SESSIONS;
  const normalizedTasks = Array.isArray(saved.tasks)
    ? (saved.tasks as Task[]).map((task, index) => ({
        ...task,
        id: ensureStableId('task', task.id, index),
        title: sanitizePlainText(task.title || '', 80),
        tag: sanitizePlainText(task.tag || 'Focus', 24),
        priority: sanitizePlainText(task.priority || 'Medium', 24),
        repeat: isRepeatType(task.repeat) ? task.repeat : 'today'
      }))
    : createDefaultTasks();
  const normalizedProPlan = saved.proPlan && typeof saved.proPlan === 'object'
    ? {
        ...(saved.proPlan as ProPlan),
        insights: Array.isArray((saved.proPlan as ProPlan).insights) ? (saved.proPlan as ProPlan).insights : [],
        rituals: Array.isArray((saved.proPlan as ProPlan).rituals) ? (saved.proPlan as ProPlan).rituals : [],
        sessions: Array.isArray((saved.proPlan as ProPlan).sessions)
          ? (saved.proPlan as ProPlan).sessions.map((session, index) => ({
              ...session,
              id: ensureStableId('pro-session', session.id, index)
            }))
          : []
      }
    : null;

  return {
    ...saved,
    activeTab: typeof saved.activeTab === 'string'
      ? (saved.activeTab === 'insights'
        ? 'review'
        : saved.activeTab === 'relax'
          ? 'forecast'
          : saved.activeTab === 'blocklist'
            ? 'profile'
            : saved.activeTab)
      : 'home',
    blockedByApp: saved.blockedByApp && typeof saved.blockedByApp === 'object' ? saved.blockedByApp : {},
    completedTaskIds: Array.isArray(saved.completedTaskIds) ? saved.completedTaskIds.filter((id): id is string => typeof id === 'string') : [],
    deviceUsageAccessStatus: saved.deviceUsageAccessStatus === 'requested' || saved.deviceUsageAccessStatus === 'granted' || saved.deviceUsageAccessStatus === 'skipped'
      ? saved.deviceUsageAccessStatus
      : 'unknown',
    focusByDate: saved.focusByDate && typeof saved.focusByDate === 'object' ? saved.focusByDate : {},
    hasCompletedOnboarding: Boolean(saved.hasCompletedOnboarding),
    onboardingStep: ONBOARDING_RESTORABLE_STEPS.includes(saved.onboardingStep as OnboardingStep)
      ? (saved.onboardingStep as OnboardingStep)
      : 'welcome',
    onboardingVersion: typeof saved.onboardingVersion === 'number' ? saved.onboardingVersion : 0,
    isPro: Boolean(saved.isPro),
    proPricingRegion: typeof saved.proPricingRegion === 'string' ? saved.proPricingRegion : 'auto',
    detectedPricingRegion: typeof saved.detectedPricingRegion === 'string' ? saved.detectedPricingRegion : detectUserCountryCode(),
    hasUsedIntroTrial: Boolean(saved.hasUsedIntroTrial),
    introTrialStartedAt: typeof saved.introTrialStartedAt === 'string' ? saved.introTrialStartedAt : null,
    membershipAutoRenew: typeof saved.membershipAutoRenew === 'boolean' ? saved.membershipAutoRenew : true,
    lastGoalDate: typeof saved.lastGoalDate === 'string' ? saved.lastGoalDate : null,
    lastReclaimedDate: lastReclaimedDate === today ? lastReclaimedDate : null,
    proPlan: normalizedProPlan,
    scheduleBlocks: Array.isArray(saved.scheduleBlocks) ? saved.scheduleBlocks as ScheduleBlock[] : DEFAULT_SCHEDULE_BLOCKS,
    sessions: normalizedSessions,
    tasks: normalizedTasks,
    todayReclaimed: lastReclaimedDate === today && typeof saved.todayReclaimed === 'number' ? saved.todayReclaimed : 0,
    unlockedAchievements: Array.isArray(saved.unlockedAchievements) ? saved.unlockedAchievements.filter((id): id is string => typeof id === 'string') : [],
    userData: saved.userData
      ? {
          ...DEFAULT_USER_DATA,
          ...saved.userData,
          name: sanitizePlainText(saved.userData.name || '', 60),
          distractions: Array.isArray(saved.userData.distractions)
            ? saved.userData.distractions
                .filter((item): item is string => typeof item === 'string')
                .map((item) => sanitizePlainText(item, 32))
                .filter(Boolean)
            : DEFAULT_USER_DATA.distractions,
        }
      : DEFAULT_USER_DATA
  };
};

const loadPersistedState = (): Partial<PersistedState> => {
  if (typeof window === 'undefined') return {};
  if (!ENABLE_LOCAL_PERSISTENCE) {
    try {
      localStorage.removeItem('vellin-state');
    } catch {
      // Ignore storage cleanup failures in testing mode.
    }
    return {};
  }
  try {
    const raw = localStorage.getItem('vellin-state');
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    return normalizePersistedState(saved);
  } catch {
    return {};
  }
};

const BrandMark = ({ size = 44 }: { size?: number }) => (
  <div className="brand-mark" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
    <span className="brand-mark-crest" />
    <span className="brand-mark-ring" />
    <span className="brand-mark-orbit brand-mark-orbit-left" />
    <span className="brand-mark-orbit brand-mark-orbit-right" />
  </div>
);

const BrandLockup = ({ subtitle, compact = false }: { subtitle?: string, compact?: boolean }) => (
  <div className={`brand-lockup ${compact ? 'compact' : ''}`}>
    <BrandMark size={compact ? 32 : 44} />
    <div>
      <div className="brand-wordmark">VELLIN</div>
      {subtitle && <div className="brand-tagline">{subtitle}</div>}
    </div>
  </div>
);

const getAvatarInitials = (name: string, email: string) => {
  const source = name.trim() || email.split('@')[0] || 'V';
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'V';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
};

const sanitizeUsername = (value: string) => sanitizePlainText(value, 20).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

const buildDefaultUsername = (name: string, email: string, userId: string) => {
  const base = sanitizeUsername(name) || sanitizeUsername(email.split('@')[0] || '') || 'vellin';
  const suffix = userId.replace(/-/g, '').slice(0, 6).toLowerCase();
  return `${base}${suffix}`;
};

const buildGuestUsername = (name: string) => {
  const base = sanitizeUsername(name) || 'guest_focus';
  return base.slice(0, 20);
};

const getAuthDisplayName = (user: SupabaseUser | null) => {
  if (!user) return '';
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const candidate = metadata?.name ?? metadata?.full_name ?? metadata?.preferred_name;
  return typeof candidate === 'string' ? sanitizePlainText(candidate, 60) : '';
};

const isSafeHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const getAuthAvatarUrl = (user: SupabaseUser | null) => {
  if (!user) return null;
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const directAvatar = metadata?.avatar_url;
  if (typeof directAvatar === 'string' && directAvatar.length > 0 && isSafeHttpUrl(directAvatar)) return directAvatar;
  const directPicture = metadata?.picture;
  if (typeof directPicture === 'string' && directPicture.length > 0 && isSafeHttpUrl(directPicture)) return directPicture;
  const firstIdentity = user.identities?.[0]?.identity_data as Record<string, unknown> | undefined;
  const identityAvatar = firstIdentity?.avatar_url;
  if (typeof identityAvatar === 'string' && identityAvatar.length > 0 && isSafeHttpUrl(identityAvatar)) return identityAvatar;
  const identityPicture = firstIdentity?.picture;
  if (typeof identityPicture === 'string' && identityPicture.length > 0 && isSafeHttpUrl(identityPicture)) return identityPicture;
  return null;
};



// --- Onboarding Components ---


const WelcomeStep = ({ onNext, languageRegion }: { onNext: () => void, languageRegion: string }) => {
  const reduceMotion = useReducedMotion() || Capacitor.isNativePlatform();
  const welcomeHighlights = [
    'Build calmer screen habits',
    'Spot distraction spirals sooner',
    'Protect your best focus time',
  ];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="onboarding-step onboarding-step-shell welcome-step"
      style={{ padding: '62px 24px 6px', minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column', textAlign: 'center' }}
    >
      <div className="welcome-step-copy" style={{ display: 'grid', gap: '16px', marginTop: 'auto' }}>
        <motion.div
          initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}
        >
          <BrandLockup subtitle="Quiet the noise. Keep the signal." />
        </motion.div>
        <h1 className="onboarding-step-title" style={{ fontSize: '2.7rem', fontWeight: 800, marginBottom: '2px', letterSpacing: '-0.03em' }}>{getUiString(languageRegion, 'welcomeTitle')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.08rem', marginBottom: '6px', lineHeight: 1.65 }}>{getUiString(languageRegion, 'welcomeSubtitle')}</p>
        <div className="welcome-highlight-grid">
          {welcomeHighlights.map((item, index) => (
            <div key={`${item}-${index}`} className="glass-card welcome-highlight-card">
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="onboarding-step-actions" style={{ marginTop: 'auto', paddingTop: '10px', paddingBottom: 0 }}>
        <button className="btn-primary onboarding-step-cta" onClick={onNext} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {getUiString(languageRegion, 'getStarted')} <ArrowRight size={20} />
        </button>
      </div>
    </motion.div>
  );
};

const SurveyStep = ({ onNext }: { onNext: (data: string[]) => void }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const selectionTimerRef = useRef<number | null>(null);
  
  const questions = [
    { q: "When do you feel most compelled to scroll?", options: ["Waking Up", "During Work Breaks", "Late at Night", "When Stressed"] },
    { q: "How do you feel after a long session?", options: ["Drained & Lethargic", "Anxious", "Indifferent", "I lose track of time"] },
    { q: "Primary trigger for loss of focus?", options: ["Notifications", "Boredom", "Task Difficulty", "Habitual Checking"] }
  ];

  const handleOption = (opt: string) => {
    if (selectedOption) return;
    setSelectedOption(opt);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(16);
    }

    selectionTimerRef.current = window.setTimeout(() => {
      const newAnswers = [...answers, opt];
      if (step < questions.length - 1) {
        setAnswers(newAnswers);
        setStep(step + 1);
      } else {
        onNext(newAnswers);
      }
      setSelectedOption(null);
      selectionTimerRef.current = null;
    }, 130);
  };

  useEffect(() => {
    return () => {
      if (selectionTimerRef.current) {
        window.clearTimeout(selectionTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="onboarding-step-shell" style={{ padding: '32px 24px 56px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="progress-dots" style={{ marginBottom: '40px', justifyContent: 'flex-start' }}>
        {questions.map((_, i) => (
          <div key={i} className={`dot ${i === step ? 'active' : ''}`}></div>
        ))}
      </div>
      <h2 className="onboarding-step-title" style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '24px', letterSpacing: '-0.02em' }}>{questions[step].q}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} key={step}>
        {questions[step].options.map((opt, i) => (
          <button
            key={i}
            className="glass-card onboarding-choice onboarding-static-card"
            style={{
              padding: '18px 20px',
              textAlign: 'left',
              color: 'var(--text-main)',
              fontSize: '1rem',
              border: selectedOption === opt ? '1px solid rgba(184, 240, 140, 0.8)' : '1px solid var(--card-border)',
              background: selectedOption === opt
                ? 'linear-gradient(135deg, rgba(184, 240, 140, 0.18), rgba(139, 212, 255, 0.16))'
                : undefined,
              boxShadow: selectedOption === opt
                ? '0 0 0 2px rgba(184, 240, 140, 0.16), 0 12px 28px rgba(5, 10, 24, 0.2)'
                : undefined,
              transform: selectedOption === opt ? 'scale(0.985)' : 'none',
            }}
            onClick={() => handleOption(opt)}
            aria-pressed={selectedOption === opt}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const RecommendationStep = ({ surveyData, onNext }: { surveyData: string[] | null, onNext: () => void }) => {
  const trigger = surveyData?.[0] || 'Waking Up';
  const reduceMotion = useReducedMotion() || Capacitor.isNativePlatform();
  let title = 'Friction Injection Protocol';
  let desc = 'A structured plan to rebuild your attention span by injecting mindful friction into habitual checking.';
  let points = [
    'Require 10-second wait screen before overrides',
    'Strict Pomodoro (25m Focus / 5m Rest) enforcement',
    'Disable all non-essential notifications globally'
  ];

  if (trigger === 'Late at Night') {
    title = 'Circadian Alignment Protocol';
    desc = 'Designed to protect your sleep architecture and prevent late-night dopamine loops.';
    points = ['Device lockdown 1hr before bed', 'Block infinite-scroll apps after 8 PM', 'Morning grace period until 9 AM'];
  }

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="onboarding-step-shell protocol-step"
      style={{ padding: '32px 24px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', minHeight: '100dvh', height: '100dvh', justifyContent: 'space-between' }}
    >
      <div style={{ display: 'grid', gap: '18px', marginTop: 'auto' }}>
      <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '24px' }}
        >
        <div style={{ display: 'grid', placeItems: 'center', width: '72px', height: '72px', padding: '16px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(184, 240, 140, 0.28)' }}>
          <CheckCircle2 size={40} color="var(--accent-success)" />
        </div>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--accent-success)' }}>
          Verified Setup
        </div>
      </motion.div>
      <h2 className="onboarding-step-title" style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>Protocol Active</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>Based on your triggers, we've designed your structure.</p>
      
      <div className="glass-card" style={{ padding: '32px', textAlign: 'left', marginBottom: '40px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(6, 182, 212, 0.05))', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
         <h3 className="text-gradient" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{title}</h3>
         <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>{desc}</p>
         <ul style={{ color: 'var(--text-main)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontWeight: 500, fontSize: '0.9rem' }}>
           {points.map((pt, i) => <li key={i} style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-main)' }}>{pt}</span></li>)}
         </ul>
      </div>
      </div>
      <div className="onboarding-step-actions" style={{ marginTop: 'auto', paddingTop: '6px' }}>
        <button className="btn-primary onboarding-step-cta" onClick={onNext} style={{ width: '100%' }}>Continue</button>
      </div>
    </motion.div>
  );
};

const AuthStep = ({
  onCreateAccount,
  onLogin,
  onForgotPassword,
  onUpdatePassword,
  onContinueAsGuest,
  notice,
  pendingConfirmationEmail,
  onClearPendingConfirmation,
  noticeTone,
  isSubmitting,
  authEnabled,
  showRecoveryForm,
  isPasswordResetting,
  languageRegion
}: {
  onCreateAccount: (credentials: { name: string, email: string, password: string }) => Promise<void> | void,
  onLogin: (credentials: { email: string, password: string }) => Promise<void> | void,
  onForgotPassword: (email: string) => Promise<void> | void,
  onUpdatePassword: (nextPassword: string) => Promise<void> | void,
  onContinueAsGuest: () => void,
  notice: string | null,
  pendingConfirmationEmail: string | null,
  onClearPendingConfirmation: () => void,
  noticeTone: 'info' | 'success' | 'warning',
  isSubmitting: boolean,
  authEnabled: boolean,
  showRecoveryForm: boolean,
  isPasswordResetting: boolean,
  languageRegion: string
}) => {
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetPasswordConfirm, setShowResetPasswordConfirm] = useState(false);
  const trimmedName = name.trim();
  const resolvedMode = pendingConfirmationEmail ? 'login' : mode;
  const resolvedEmail = pendingConfirmationEmail ?? email;
  const trimmedEmail = resolvedEmail.trim();
  const hasValidEmail = isValidEmail(trimmedEmail);
  const canCreateAccount = authEnabled && trimmedName.length > 0 && hasValidEmail && password.length >= 6;
  const canLogin = authEnabled && hasValidEmail && password.length >= 6;
  const canSendPasswordReset = authEnabled && hasValidEmail && !isSubmitting;
  const canSaveNewPassword = authEnabled
    && resetPassword.length >= 8
    && resetPassword === resetPasswordConfirm
    && !isPasswordResetting;
  const createCredentials = {
    name: trimmedName,
    email: trimmedEmail,
    password
  };
  const loginCredentials = {
    email: trimmedEmail,
    password
  };
  const isCreateMode = !showRecoveryForm && resolvedMode === 'create';
  const canSubmit = isCreateMode ? canCreateAccount : canLogin;
  const submitLabel = isCreateMode ? getUiString(languageRegion, 'createAccount') : getUiString(languageRegion, 'logIn');

  const handleSubmit = (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    if (isSubmitting || !canSubmit) return;
    if (isCreateMode) {
      void onCreateAccount(createCredentials);
      return;
    }
    void onLogin(loginCredentials);
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} className="app-container auth-screen" style={{ padding: '34px 16px 12px', minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'grid', gap: '10px', marginTop: 'auto' }}>
      <div className="auth-brand-row">
        <BrandLockup subtitle="Focus infrastructure for real life." compact />
      </div>
      <div className="glass-card auth-shell">
        <div className="auth-copy">
          <h1>{isCreateMode ? getUiString(languageRegion, 'authCreateTitle') : getUiString(languageRegion, 'authLoginTitle')}</h1>
          <p>{isCreateMode ? getUiString(languageRegion, 'authCreateDesc') : getUiString(languageRegion, 'authLoginDesc')}</p>
        </div>
        <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
          <button className={`auth-mode-tab ${isCreateMode ? 'active' : ''}`} onClick={() => { onClearPendingConfirmation(); setMode('create'); }} type="button" aria-pressed={isCreateMode}>{getUiString(languageRegion, 'createAccount')}</button>
          <button className={`auth-mode-tab ${!isCreateMode ? 'active' : ''}`} onClick={() => setMode('login')} type="button" aria-pressed={!isCreateMode}>{getUiString(languageRegion, 'logIn')}</button>
        </div>
        {!authEnabled && (
          <div className="glass-card" style={{ padding: '14px 16px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Supabase is not connected yet. Restart the app after checking your environment variables.
          </div>
        )}
        {notice && (
          <div className={`auth-notice auth-notice-${noticeTone}`}>
            {notice}
          </div>
        )}
        {pendingConfirmationEmail && (
          <div className="auth-confirm-card">
            <div className="auth-confirm-label">Email Verification</div>
            <div className="auth-confirm-title">Check {pendingConfirmationEmail}</div>
            <div className="auth-confirm-copy">
              We sent your confirmation link there. Open it, let VELLIN return through the callback page, then come back here only if you still need to log in manually.
            </div>
            <div className="auth-confirm-actions">
              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('https://mail.google.com/mail/u/0/#inbox', '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                Open Gmail
              </button>
              <button className="btn-secondary" type="button" onClick={() => setMode('login')}>
                I Confirmed, Let Me Log In
              </button>
              <button className="btn-secondary" type="button" onClick={onClearPendingConfirmation}>
                Use A Different Email
              </button>
            </div>
          </div>
        )}
        {showRecoveryForm && (
          <div className="auth-confirm-card">
            <div className="auth-confirm-label">Reset Password</div>
            <div className="auth-confirm-title">Choose a new password</div>
            <div className="auth-confirm-copy">
              Your reset link worked. Set a new password below, then use it the next time you log in.
            </div>
            <div className="auth-reset-stack">
              <div className="auth-password-row">
                <input
                  className="auth-input auth-input-password"
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="New Password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                />
                <button className="auth-password-toggle" type="button" aria-label={showResetPassword ? 'Hide password' : 'Show password'} onClick={() => setShowResetPassword((prev) => !prev)}>
                  {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="auth-password-row">
                <input
                  className="auth-input auth-input-password"
                  type={showResetPasswordConfirm ? 'text' : 'password'}
                  placeholder="Confirm New Password"
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                />
                <button className="auth-password-toggle" type="button" aria-label={showResetPasswordConfirm ? 'Hide password confirmation' : 'Show password confirmation'} onClick={() => setShowResetPasswordConfirm((prev) => !prev)}>
                  {showResetPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                className="btn-primary auth-submit"
                type="button"
                disabled={!canSaveNewPassword}
                onClick={() => {
                  if (!canSaveNewPassword) return;
                  void onUpdatePassword(resetPassword);
                }}
              >
                {isPasswordResetting ? 'Saving...' : 'Save New Password'}
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {isCreateMode && (
            <input className="auth-input" placeholder={getUiString(languageRegion, 'preferredName')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
          )}
          <input className="auth-input" type="email" placeholder={getUiString(languageRegion, 'emailAddress')} value={resolvedEmail} onChange={(e) => { if (pendingConfirmationEmail) onClearPendingConfirmation(); setEmail(e.target.value); }} autoComplete="email" maxLength={254} required />
          <div className="auth-password-row">
            <input className="auth-input auth-input-password" type={showPassword ? 'text' : 'password'} placeholder={getUiString(languageRegion, 'password')} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isCreateMode ? 'new-password' : 'current-password'} minLength={6} maxLength={128} required />
            <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((prev) => !prev)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {!isCreateMode && !showRecoveryForm && (
            <button
              className="auth-link-button"
              type="button"
              onClick={() => setShowForgotPassword((prev) => !prev)}
            >
              {getUiString(languageRegion, 'forgotPassword')}
            </button>
          )}
          {!isCreateMode && showForgotPassword && !showRecoveryForm && (
            <div className="auth-confirm-card auth-inline-card">
              <div className="auth-confirm-label">Reset Password</div>
              <div className="auth-confirm-title">Send a reset link</div>
              <div className="auth-confirm-copy">
                Enter the email on your account and we will send you a secure password reset link.
              </div>
              <div className="auth-confirm-actions">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={!canSendPasswordReset}
                  onClick={() => {
                    if (!canSendPasswordReset) return;
                    void onForgotPassword(trimmedEmail);
                  }}
                >
                  Send Reset Link
                </button>
                <button className="btn-secondary" type="button" onClick={() => setShowForgotPassword(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button className="btn-primary auth-submit" type="button" onClick={() => handleSubmit()} style={{ opacity: authEnabled ? (canSubmit ? 1 : 0.82) : 0.72, cursor: isSubmitting ? 'progress' : 'pointer' }} disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : submitLabel}
          </button>
        </form>
        <div className="auth-helper">
          {isCreateMode ? 'Create account requires your preferred name, email, and a password with at least 6 characters.' : 'Log in only requires the email and password already attached to your account.'}
        </div>
        <button className="btn-secondary auth-alt-action" type="button" onClick={() => setMode(isCreateMode ? 'login' : 'create')}>
          {isCreateMode ? getUiString(languageRegion, 'alreadyHaveAccount') : getUiString(languageRegion, 'needNewAccount')}
        </button>
        <button className="btn-secondary auth-alt-action" type="button" onClick={onContinueAsGuest}>
          {getUiString(languageRegion, 'continueWithoutAccount')}
        </button>
      </div>
      </div>
    </motion.div>
  );
};

const AppSelectionStep = ({
  onNext,
  languageRegion,
  installedApps,
  isLoadingInstalledApps,
}: {
  onNext: (apps: string[]) => void,
  languageRegion: string,
  installedApps: InstalledAppEntry[],
  isLoadingInstalledApps: boolean,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [showAllApps, setShowAllApps] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const [showNoSelectionWarning, setShowNoSelectionWarning] = useState(false);
  const toggle = (name: string) => setSelected(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);
  const allApps = useMemo(() => mergeSelectableApps(installedApps), [installedApps]);
  const featuredApps = useMemo(() => mergeSelectableApps(installedApps).slice(0, 6), [installedApps]);
  const installedIconLookup = useMemo(() => installedApps.reduce<Record<string, string>>((acc, app) => {
    if (app.iconDataUrl && app.label) {
      acc[normalizeAppLabel(app.label)] = app.iconDataUrl;
    }
    return acc;
  }, {}), [installedApps]);
  const visibleInstalledApps = useMemo(() => {
    const normalizedSearch = normalizeAppLabel(appSearch);
    if (!normalizedSearch) return allApps;
    return allApps.filter((app) => normalizeAppLabel(app).includes(normalizedSearch));
  }, [allApps, appSearch]);
  const getAppIcon = useCallback((app: string) => installedIconLookup[normalizeAppLabel(app)] || APP_LOGOS[app] || null, [installedIconLookup]);

  const handleContinue = () => {
    if (selected.length === 0 && !showNoSelectionWarning) {
      setShowNoSelectionWarning(true);
      return;
    }
    onNext(selected);
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} className="app-container onboarding-step-shell" style={{ padding: '36px 24px 56px' }}>
       <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.02em' }}>{getUiString(languageRegion, 'distractionsTitle')}</h2>
       <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{getUiString(languageRegion, 'distractionsSubtitle')}</p>
       
      <div className="logo-grid" style={{ marginBottom: '32px' }}>
        {featuredApps.map((app, index) => (
          <div
            key={`${app || 'selected-app'}-${index}`}
            className={`glass-card selectable-card onboarding-static-card ${selected.includes(app) ? 'selected' : ''}`}
            onClick={() => {
              setShowNoSelectionWarning(false);
              toggle(app);
            }}
            aria-pressed={selected.includes(app)}
          >
              {selected.includes(app) && <div className="selectable-check-badge"><CheckCircle2 size={14} /></div>}
              {getAppIcon(app) ? <img src={getAppIcon(app) ?? ''} alt={app} /> : <div className="custom-app-icon selectable-app-fallback">{app.charAt(0)}</div>}
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: selected.includes(app) ? 'var(--text-main)' : 'var(--text-secondary)' }}>{app}</div>
           </div>
        ))}
      </div>

       <button className="btn-secondary" style={{ width: '100%', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setShowAllApps(true)}>
          <Search size={16} /> {getUiString(languageRegion, 'browseApps')}
       </button>

       {showAllApps && (
         <div className="all-apps-modal">
           <div className="all-apps-header">
             <div style={{ fontWeight: 700 }}>{getUiString(languageRegion, 'allApps')}</div>
             <button className="btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setShowAllApps(false)}>{getUiString(languageRegion, 'close')}</button>
           </div>
           <div className="all-apps-search-shell">
             <input
               className="auth-input search"
               placeholder={isLoadingInstalledApps ? 'Loading your installed apps...' : 'Search installed apps'}
               value={appSearch}
               onChange={(event) => setAppSearch(event.target.value)}
               disabled={isLoadingInstalledApps}
             />
           </div>
           <div className="all-apps-list">
             {visibleInstalledApps.map((app, index) => {
              const active = selected.includes(app);
              return (
                <div key={`${app || 'all-app'}-${index}`} className="mock-app-row" onClick={() => { setShowNoSelectionWarning(false); toggle(app); }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     {getAppIcon(app) ? <img src={getAppIcon(app) ?? ''} style={{ width: '36px', height: '36px', borderRadius: '8px' }} alt={app} /> : <div className="custom-app-icon">{app.charAt(0)}</div>}
                     <span>{app}</span>
                    </div>
                    <div className={`app-toggle ${active ? 'active' : ''}`}>{active && <CheckCircle2 size={14} />}</div>
                 </div>
               );
             })}
             {!isLoadingInstalledApps && visibleInstalledApps.length === 0 && (
               <div className="all-apps-empty-state">No installed apps matched that search.</div>
             )}
           </div>
         </div>
       )}

       {showNoSelectionWarning && (
        <div className="auth-notice auth-notice-warning" style={{ marginTop: 'auto', marginBottom: '12px' }}>
          You have not picked any apps to block yet. You can continue, but focus sessions will only act as a timer until you choose some distraction targets.
        </div>
       )}

       <button className="btn-primary" style={{ width: '100%', marginTop: showNoSelectionWarning ? 0 : 'auto' }} onClick={handleContinue}>
         {showNoSelectionWarning ? 'Continue Without Blocking Apps' : getUiString(languageRegion, 'setTargets')}
       </button>
     </motion.div>
  );
};

const DeviceUsageAccessStep = ({
  status,
  blockerEnabled,
  hasDistractionTargets,
  onAllow,
  onOpenBlockerAccess,
  onContinue,
  onSkip,
  languageRegion
}: {
  status: DeviceUsageAccessStatus,
  blockerEnabled: boolean,
  hasDistractionTargets: boolean,
  onAllow: () => void,
  onOpenBlockerAccess: () => void,
  onContinue: () => void,
  onSkip: () => void,
  languageRegion: string
}) => {
  const needsBlockerAccess = canUseNativeDeviceUsage() && hasDistractionTargets;
  const isUsageReady = status === 'granted';
  const isBlockerReady = !needsBlockerAccess || blockerEnabled;
  const canMoveForward = isUsageReady && isBlockerReady;

  return (
  <motion.div initial={false} animate={{ opacity: 1 }} className="app-container onboarding-step-shell" style={{ padding: '36px 24px 14px', minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <div style={{ display: 'grid', gap: '18px', marginTop: 'auto' }}>
      <BrandLockup subtitle="Screen time insights, explained gently." compact />
      <div className="glass-card" style={{ padding: '24px', display: 'grid', gap: '16px' }}>
        <div style={{ fontSize: '0.78rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 800 }}>Screen Time Data</div>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>{getUiString(languageRegion, 'screenTimeTitle')}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
          This helps VELLIN make your Reality Check and craving insights feel personal instead of generic. On Android, VELLIN can open Usage Access settings and read last-week app time after you allow it.
        </p>
        <div className="review-insights" style={{ marginTop: '4px' }}>
          <div className="review-insight-item">See how much time you spent last week on the apps you want to block.</div>
          <div className="review-insight-item">Make your Reality Check feel based on your life, not guesses.</div>
          <div className="review-insight-item">Build better craving forecasts and reduction plans from your own patterns.</div>
        </div>
        {canUseNativeDeviceUsage() && (
          <div className="usage-access-steps">
            <div className="usage-access-step">
              <div className="usage-access-step-index">1</div>
              <div>
                <div className="usage-access-step-title">Open Android settings</div>
                <div className="usage-access-step-copy">VELLIN will take you straight to the Usage Access screen.</div>
              </div>
            </div>
            <div className="usage-access-step">
              <div className="usage-access-step-index">2</div>
              <div>
                <div className="usage-access-step-title">Turn on VELLIN</div>
                <div className="usage-access-step-copy">Look for <strong>VELLIN</strong> in the list and switch Usage Access on.</div>
              </div>
            </div>
            <div className="usage-access-step">
              <div className="usage-access-step-index">3</div>
              <div>
                <div className="usage-access-step-title">Come back and continue</div>
                <div className="usage-access-step-copy">Return to the app and tap Continue once it shows Connected.</div>
              </div>
            </div>
          </div>
        )}
        {canUseNativeDeviceUsage() && (
          <div className="auth-helper">
            Android will open the Usage Access settings screen next. Android does not let apps turn this on automatically, so you still need to switch on VELLIN yourself and then return here.
          </div>
        )}
        {needsBlockerAccess && (
          <div className="glass-card" style={{ padding: '18px', display: 'grid', gap: '12px', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(139, 212, 255, 0.18)' }}>
            <div style={{ fontSize: '0.78rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 800 }}>
              App Blocking
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              To actually kick you out of blocked apps like Instagram during focus, Android also needs <strong style={{ color: 'var(--text-main)' }}>Blocker Access</strong> in Accessibility.
            </div>
            <div className="usage-access-steps" style={{ gap: '10px' }}>
              <div className="usage-access-step">
                <div className="usage-access-step-index">1</div>
                <div>
                  <div className="usage-access-step-title">Open Accessibility</div>
                  <div className="usage-access-step-copy">VELLIN will take you to Android Accessibility settings.</div>
                </div>
              </div>
              <div className="usage-access-step">
                <div className="usage-access-step-index">2</div>
                <div>
                  <div className="usage-access-step-title">Find VELLIN</div>
                  <div className="usage-access-step-copy">On Samsung phones, tap <strong>Installed services</strong> near the bottom. On other phones, look for <strong>Installed apps</strong>, <strong>Downloaded apps</strong>, or <strong>Accessibility services</strong>.</div>
                </div>
              </div>
              <div className="usage-access-step">
                <div className="usage-access-step-index">3</div>
                <div>
                  <div className="usage-access-step-title">Turn VELLIN on</div>
                  <div className="usage-access-step-copy">Switch <strong>Use VELLIN</strong> on, then come back here.</div>
                </div>
              </div>
            </div>
            {blockerEnabled ? (
              <div className="auth-notice auth-notice-success" style={{ margin: 0 }}>
                Blocker Access is connected. VELLIN can now kick you out of blocked apps during focus.
              </div>
            ) : (
              <button className="btn-secondary" onClick={onOpenBlockerAccess} style={{ width: '100%' }}>
                Open Blocker Access
              </button>
            )}
          </div>
        )}
        {status === 'requested' && (
          <div className="auth-notice auth-notice-info">
            Settings have already been opened for you. On Android, enable Usage Access for VELLIN, return to the app, and then tap Continue.
          </div>
        )}
        {status === 'skipped' && (
          <div className="auth-notice auth-notice-info">
            No problem — you can always change this later from Profile in the Device Usage Data section.
          </div>
        )}
        {status === 'granted' && (
          <div className="auth-notice auth-notice-success">
            Screen time data access is connected. VELLIN can now use your real last-week app usage in Reality Check.
          </div>
        )}
        {canMoveForward ? (
          <button className="btn-primary" onClick={onContinue} style={{ width: '100%' }}>
            Continue
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={isUsageReady ? onOpenBlockerAccess : onAllow}
            style={{ width: '100%' }}
          >
            {isUsageReady ? 'Set Up App Blocking' : status === 'requested' ? 'Open Settings Again' : getUiString(languageRegion, 'screenTimeYes')}
          </button>
        )}
        <button className="btn-secondary" onClick={onSkip} style={{ width: '100%' }}>
          {getUiString(languageRegion, 'maybeLater')}
        </button>
      </div>
    </div>
  </motion.div>
  );
};

const ProPlanOfferStep = ({
  onSkip,
  onUpgrade,
  priceLabel,
  priceNote,
  regionalCopy,
  hasUsedIntroTrial,
  isAuthenticated,
}: {
  onSkip: () => void,
  onUpgrade: () => void,
  priceLabel: string,
  priceNote: string,
  regionalCopy: RegionalUiCopy,
  hasUsedIntroTrial: boolean,
  isAuthenticated: boolean,
}) => {
  const canStartTrial = isAuthenticated && !hasUsedIntroTrial;
  const offerHeading = !isAuthenticated
    ? 'Create an account to unlock Pro.'
    : hasUsedIntroTrial
      ? `${regionalCopy.upgradeNow}.`
      : regionalCopy.trialHeading;
  const offerSubheading = !isAuthenticated
    ? 'Free trials are only available on real accounts so your Pro access can be saved properly and only used once.'
    : hasUsedIntroTrial
    ? `Your one-time intro trial has already been used. Upgrade instantly at ${priceLabel}/month when billing goes live, with no second free trial.`
    : regionalCopy.trialSubheading;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pro-offer-step-shell"
    >
      <div className="pro-offer-content">
        <div className="pro-offer-stack" style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center', paddingBottom: '12px' }}>
        <div className="pro-offer-header-row">
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 800 }}>VELLIN Pro</div>
          <button className="btn-secondary pro-offer-close" onClick={onSkip} type="button" aria-label="Close Pro offer">
            <X size={16} />
          </button>
        </div>
        <h2 className="pro-offer-title" style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>{offerHeading}</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{offerSubheading}</p>
        <div className="glass-card pro-offer-card" style={{ padding: '22px', textAlign: 'left', display: 'grid', gap: '12px', background: 'linear-gradient(135deg, rgba(184, 240, 140, 0.14), rgba(139, 212, 255, 0.1))', borderColor: 'rgba(184, 240, 140, 0.28)', borderRadius: '28px', boxShadow: '0 18px 50px rgba(5, 10, 24, 0.28)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.8rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 800, marginBottom: '8px' }}>{regionalCopy.trialLabel}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-main)' }}>
                  {canStartTrial ? `${PRO_MONTHLY_PLAN.trialDays} days free` : priceLabel}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                  {canStartTrial ? `then ${priceLabel}/month later` : 'charged monthly once billing goes live'}
                </span>
              </div>
              <div style={{ marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: 700 }}>
                {priceNote}
              </div>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: '999px', border: '1px solid rgba(184, 240, 140, 0.35)', background: 'rgba(184, 240, 140, 0.12)', color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: 700 }}>
              {regionalCopy.accountRequired}
            </div>
          </div>
          {[
            'Full craving forecast with extra insight cards',
            'Personal reduction roadmap generated from your tracked activity',
            'Extra focus sessions added to your plan immediately',
            'Prevention suggestions and timing guidance'
          ].map((item, idx) => (
            <div key={idx} className="pro-offer-feature-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-success)', boxShadow: '0 0 12px rgba(184, 240, 140, 0.8)' }} />
              <span style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{item}</span>
            </div>
          ))}
          <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            {!isAuthenticated
              ? 'Guest mode cannot start a free trial because trial access has to be saved to a real account.'
              : hasUsedIntroTrial
                ? `${regionalCopy.trialUsedLabel}. Billing is not connected yet, so VELLIN is previewing the instant-upgrade path without starting another free trial.`
                : `${regionalCopy.onePerAccount}. Billing is not connected yet, so VELLIN is preparing the subscription wording now without charging real money today.`}
          </div>
        </div>
        <div className="pro-offer-actions">
          <button className="btn-primary" onClick={onUpgrade} style={{ width: '100%', padding: '18px' }}>
          {!isAuthenticated
            ? 'Create account to start trial'
            : canStartTrial
              ? regionalCopy.startTrial
              : `${regionalCopy.upgradeNow} · ${priceLabel}/month`}
          </button>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            Cancel anytime once billing goes live. Automatic monthly billing will only be turned on when the real subscription system is connected.
          </div>
          <button className="btn-secondary" onClick={onSkip} style={{ width: '100%' }} type="button">Maybe Later</button>
        </div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Dashboard Sub-Components ---

const ScheduledSessionInfo = ({ distractions, onTestApp, focusSeconds, sessions, setSessions, isFocusing }: { distractions: string[], onTestApp: (app: string, opts?: { simulate?: boolean }) => void, focusSeconds: number, sessions: Session[], setSessions: Dispatch<SetStateAction<Session[]>>, isFocusing: boolean }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const addSession = () => {
    const safeSessionName = sanitizePlainText(newSessionName, 60);
    if (safeSessionName) {

      setSessions([...sessions, { id: Date.now().toString(), name: safeSessionName, minutes: 45, difficulty: 'Normal' }]);
      setNewSessionName('');
      setShowAddForm(false);
    }

  };

  const deleteSession = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
  };
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
         <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Targeted Sessions</h3>
         <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: 'var(--accent-success)', border: 'none', color: '#000', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
         </button>
      </div>

      {showAddForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--accent-success)' }}>
          <input 
            className="auth-input" 
            placeholder="Focus Goal (e.g. Code Review)" 
            style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)' }} 
            value={newSessionName} 
            onChange={(e) => setNewSessionName(e.target.value)}
            maxLength={60}
            onKeyDown={(e) => e.key === 'Enter' && addSession()}
            autoFocus
          />
          <button className="btn-primary" style={{ width: '100%', padding: '10px' }} onClick={addSession}>Add Session</button>
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
         {sessions.map((s, index) => (
            <div key={`${s.id || s.name || 'session'}-${index}`} className="glass-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.minutes} minutes {'\u2022'} {s.difficulty}</div>
               </div>
               <button onClick={() => deleteSession(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', opacity: 0.6, cursor: 'pointer' }}>
                  <X size={16} />
               </button>
            </div>
         ))}
      </div>

      <div className="glass-card bento-card large interactive" style={{ textAlign: 'left', background: isFocusing ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(20, 20, 22, 0.8))' : 'rgba(255,255,255,0.02)', border: isFocusing ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--card-border)' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ padding: '8px', background: isFocusing ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
               <Shield size={20} color={isFocusing ? "var(--accent-success)" : "var(--text-tertiary)"} fill={isFocusing ? "var(--accent-success)" : "none"} />
             </div>
             <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: isFocusing ? 'var(--text-main)' : 'var(--text-secondary)' }}>{isFocusing ? 'Active Shield' : 'Shield Inactive'}</h2>
           </div>
           {isFocusing && (
           <div style={{ background: 'var(--text-main)', color: '#000', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              {formatSessionTime(focusSeconds)}
           </div>
           )}
         </div>
         <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{isFocusing ? `Shielding ${distractions.length} apps.` : 'No apps are currently being blocked.'}</div>
         {isFocusing && (
         <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
           {distractions.map((app, index) => (
             <div key={`${app || 'distraction-app'}-${index}`} onClick={() => onTestApp(app)} style={{ cursor: 'pointer', textAlign: 'center', minWidth: '48px', opacity: 0.7 }}>
                 {APP_LOGOS[app] ? <img src={APP_LOGOS[app]} style={{ width: '40px', height: '40px', borderRadius: '10px', margin: '0 auto' }} alt={app} /> : <div className="custom-app-icon">{app.charAt(0)}</div>}
              </div>
            ))}
         </div>
         )}
      </div>
    </div>
  );
};

// --- Dashboard ---
const Dashboard = ({ userData, focusScore, isFocusing, onToggleFocus, onTestApp, setShowCmd, focusSeconds, todayReclaimed, dailyGoalSeconds, sessions, setSessions, tasks, setTasks, completedTaskIds, setCompletedTaskIds, setTaskCompletions, streak, maxStreak, onOpenProPlan, blockedByApp, phonePickups, isPro, proPlan, localizedProPrice, hasUsedIntroTrial, regionalCopy }: { userData: UserData, focusScore: number, isFocusing: boolean, onToggleFocus: () => void, onTestApp: (app: string, opts?: { simulate?: boolean }) => void, setShowCmd: (show: boolean) => void, focusSeconds: number, todayReclaimed: number, dailyGoalSeconds: number, sessions: Session[], setSessions: Dispatch<SetStateAction<Session[]>>, tasks: Task[], setTasks: Dispatch<SetStateAction<Task[]>>, completedTaskIds: string[], setCompletedTaskIds: Dispatch<SetStateAction<string[]>>, setTaskCompletions: Dispatch<SetStateAction<number>>, streak: number, maxStreak: number, onOpenProPlan: () => void, blockedByApp: Record<string, number>, phonePickups: number, isPro: boolean, proPlan: ProPlan | null, localizedProPrice: string, hasUsedIntroTrial: boolean, regionalCopy: RegionalUiCopy }) => {
  const [newTask, setNewTask] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskEndTime, setTaskEndTime] = useState('');
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const safeGoalSeconds = Math.max(1, dailyGoalSeconds);
  const goalProgress = Math.min(100, (todayReclaimed / safeGoalSeconds) * 100);
  const hasDistractionTargets = userData.distractions.length > 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayKey = new Date().toDateString();
  const getLocalISODate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const toLocalDateKey = (isoDate: string) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toDateString();
  };
  const parseStartTime = (raw: string) => {
    const ampmMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (ampmMatch) {
      let hour = Number(ampmMatch[1]);
      const min = Number(ampmMatch[2] || '0');
      const period = ampmMatch[3].toLowerCase();
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        return { time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, token: ampmMatch[0] };
      }
    }
    const timeMatch = raw.match(/\b(\d{1,2}):(\d{2})\b/);
    if (timeMatch) {
      const hour = Number(timeMatch[1]);
      const min = Number(timeMatch[2]);
      if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        return { time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, token: timeMatch[0] };
      }
    }
    return null;
  };
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const minutesToTime = (mins: number) => {
    const safe = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const addMinutesToTime = (time: string, mins: number) => {
    if (!time) return '';
    return minutesToTime(timeToMinutes(time) + mins);
  };
  const computeDurationMins = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    let diff = endMin - startMin;
    if (diff <= 0) diff += 24 * 60;
    return Math.min(24 * 60, Math.max(15, diff));
  };
  const parseTaskInput = (input: string) => {
    let cleaned = input.trim();
    let startTime = taskTime || '';
    const timeMatch = parseStartTime(cleaned);
    if (timeMatch) {
      startTime = timeMatch.time;
      cleaned = cleaned.replace(timeMatch.token, '').replace(/\bat\b/i, '').trim();
    }
    return { title: sanitizePlainText(cleaned, 80), startTime };
  };

  const addTask = () => {
    const parsed = parseTaskInput(newTask);
    const title = sanitizePlainText(parsed.title, 80);
    if (!title) return;
    const startTime = parsed.startTime || taskTime;
    if (!startTime) return;
    const endTime = taskEndTime || addMinutesToTime(startTime, 60);
    if (!endTime) return;
    const durationMins = computeDurationMins(startTime, endTime);
    if (!durationMins) return;
    const repeat = 'today';
    const dueDate = getLocalISODate(0);
    setTasks(prev => [{
      id: Date.now().toString(),
      title,
      done: false,
      lastCompletedDate: null,
      repeat,
      tag: 'Focus',
      priority: 'Medium',
      dueDate,
      startTime,
      durationMins
    }, ...prev]);
    setNewTask('');
    setTaskTime('');
    setTaskEndTime('');
  };

  
  const resolveRepeat = (task: Task): RepeatType => (isRepeatType(task.repeat) ? task.repeat : 'today');
  const isTaskCompleteToday = (task: Task, dateKey: string) => {
    const repeat = resolveRepeat(task);
    if (repeat !== 'today') return task.lastCompletedDate === dateKey;
    if (task.dueDate) return task.done && toLocalDateKey(task.dueDate) === dateKey;
    return task.done;
  };
  const completedTasks = tasks.filter(t => isTaskCompleteToday(t, todayKey)).length;

  const startEditTask = (task: Task) => {
    setEditTaskId(task.id);
    setEditTitle(task.title || '');
    setEditTime(task.startTime || '');
    setEditEndTime(task.startTime ? addMinutesToTime(task.startTime, task.durationMins || 60) : '');
  };
  const cancelEditTask = () => {
    setEditTaskId(null);
    setEditTitle('');
    setEditTime('');
    setEditEndTime('');
  };
  const saveEditTask = () => {
    const safeTitle = sanitizePlainText(editTitle, 80);
    if (!editTaskId || !safeTitle) return;
    if (!editTime || !editEndTime) return;
    const durationMins = computeDurationMins(editTime, editEndTime);
    if (!durationMins) return;
    setTasks(prev => prev.map(t => {
      if (t.id !== editTaskId) return t;
      const next: Task = {
        ...t,
        title: safeTitle,
        startTime: editTime,
        durationMins
      };
      next.lastCompletedDate = null;
      return next;
    }));
    cancelEditTask();
  };

  const toggleTask = (id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;
      const repeat = resolveRepeat(target);
      if (repeat !== 'today') {
        const isDoneToday = target.lastCompletedDate === todayKey;
        if (!isDoneToday) {
          setTaskCompletions(prevCount => prevCount + 1);
        }
        return prev.map(t => (t.id === id ? { ...t, lastCompletedDate: isDoneToday ? null : todayKey } : t));
      }
      const next = prev.map(t => (t.id === id ? { ...t, done: !t.done } : t));
      if (target && !target.done && !completedTaskIds.includes(id)) {
        setTaskCompletions(prevCount => prevCount + 1);
        setCompletedTaskIds(prevIds => [...prevIds, id]);
      }
      return next;
    });
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aTime = a.startTime || '';
    const bTime = b.startTime || '';
    if (aTime === bTime) return 0;
    return aTime.localeCompare(bTime);
  });
  const visibleTasks = sortedTasks.slice(0, 3);
  const remainingTasks = Math.max(0, sortedTasks.length - visibleTasks.length);

  const sortedApps = Object.entries(blockedByApp).sort((a, b) => b[1] - a[1]);
  const topAppEntry = sortedApps[0];
  const topApp = topAppEntry?.[0];
  const topAppCount = topAppEntry?.[1] ?? 0;
  const insightFacts = [
    topApp ? `Most interrupted app: ${topApp} (${topAppCount} logged blocks)` : 'Most interrupted app: not enough data yet.',
    `Pickups logged: ${phonePickups}`,
    `Focus score trend: ${focusScore > 80 ? 'Strong' : focusScore > 50 ? 'Building' : 'Recovery mode'}`
  ];
  const activePlanSummary = proPlan?.summary || `Your latest pattern suggests ${topApp || 'social apps'} is the main pull on your attention. We'll keep lowering friction around that urge window first.`;
  const activePlanSteps = proPlan?.recommendations ?? [
    topApp ? `Reduce ${topApp} in the hour before your usual craving spike.` : 'Reduce your highest-friction app in the evening.',
    `Protect ${Math.max(45, Math.round(dailyGoalSeconds / 120))} minutes of focused time every day.`,
    `Use your blocklist whenever pickups start climbing past ${Math.max(8, Math.round(phonePickups || 8))}.`
  ];

  const formatTimeRange = (time: string, duration: number) => {
    const [h, m] = time.split(':').map(Number);
    const start = new Date();
    start.setHours(h || 0, m || 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}-${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };
  return (
    <motion.div initial={false} animate={{ opacity: 1 }} className="dashboard-shell" style={{ padding: '24px' }}>
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-copy">
          <BrandLockup subtitle="Quiet the noise" compact />
          <div className="dashboard-kicker">Daily focus system</div>
        </div>
        <div className="dashboard-topbar-actions">
          <div className="glass-card dashboard-streak-pill">
            <Flame size={14} color="var(--accent-warning)" />
            <span>{streak} day streak</span>
          </div>
          <button className="dashboard-command-button" onClick={() => setShowCmd(true)} aria-label="Open command menu">
            <Command size={20} />
          </button>
        </div>
      </header>

      <div className={`glass-card focus-hero dashboard-hero ${isFocusing ? 'active' : ''}`}>
        <div className="dashboard-hero-glow" aria-hidden="true" />
        <div className="focus-hero-top dashboard-hero-top">
          <div className="dashboard-hero-copy">
            <div className="hero-eyebrow">Focus Session</div>
            <div className="hero-title">{greeting}, {userData.name || 'there'}.</div>
            <div className="hero-sub">{isFocusing ? 'Session is live. Stay in flow.' : 'Tap start to enter Deep Focus.'}</div>
            <div className="dashboard-hero-badges">
              <span className="dashboard-hero-badge">{formatPrettyTime(todayReclaimed)} reclaimed today</span>
              <span className="dashboard-hero-badge">{tasks.length} planned tasks</span>
              <span className="dashboard-hero-badge">{phonePickups} pickups tracked</span>
            </div>
          </div>
          <div className="score-orb">
            <div className="score-label">Focus Score</div>
            <div className="score-value">{focusScore}</div>
            <div className="score-caption">{focusScore > 80 ? 'Elite' : focusScore > 50 ? 'Strong' : 'Rebuilding'}</div>
          </div>
        </div>
        <div className="focus-hero-mid">
          <div className="focus-timer">{formatSessionTime(focusSeconds)}</div>
          <div className="focus-status">
            <span className={`status-dot ${isFocusing ? 'on' : ''}`} />
            {isFocusing ? 'Session live' : 'Not started'}
          </div>
          <div className="hero-progress">
            <div className="hero-progress-label">Daily goal</div>
            <div className="hero-progress-track">
              <div className="hero-progress-fill" style={{ width: `${goalProgress}%` }} />
            </div>
            <div className="hero-progress-meta">{formatPrettyTime(todayReclaimed)} of {formatPrettyTime(dailyGoalSeconds)}</div>
          </div>
        </div>
        <button className="btn-primary focus-cta focus-cta-giant" onClick={onToggleFocus}>
          {isFocusing ? 'End Session' : 'Start Focus Session'}
        </button>
        {!hasDistractionTargets && (
          <div className="focus-warning-inline">
            Focus can still run without blocked apps, but it will not shield you from distractions until you choose at least one app in your blocklist.
          </div>
        )}
        {isFocusing && <div className="focus-confirm">Focus is active. Distractions are blocked.</div>}
      </div>

      <div className="home-stats dashboard-metric-grid">
        <div className="glass-card stat-card">
          <div className="stat-label">Daily Progress</div>
          <div className="stat-value">{Math.round(goalProgress)}%</div>
          <div className="stat-meta">{formatPrettyTime(todayReclaimed)} today</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Tasks</div>
          <div className="stat-value">{completedTasks}/{tasks.length}</div>
          <div className="stat-meta">Completed</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Best Streak</div>
          <div className="stat-value">{maxStreak}d</div>
          <div className="stat-meta">All-time record</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Top Trigger</div>
          <div className="stat-value stat-value-compact">{topApp || 'Learning'}</div>
          <div className="stat-meta">{topApp ? `${topAppCount} blocks logged` : 'More data coming soon'}</div>
        </div>
      </div>

      <div className="bento-grid premium-grid focus-grid">
        <div className="glass-card bento-card insight-card">
          <div className="dashboard-card-kicker">Signals</div>
          <div className="section-title">Activity Snapshot</div>
          <div className="insight-list">
            {insightFacts.map((fact, idx) => (
              <div key={idx} className="insight-item">{fact}</div>
            ))}
          </div>
        </div>
        <div className="glass-card bento-card">
          <div className="dashboard-card-kicker">Plan</div>
          <div className="section-title">Core Tasks</div>
          <div className="task-input-row">
            <input
              className="task-input"
              placeholder="Set a high priority goal"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              maxLength={80}
              onKeyDown={(e) => e.key === 'Enter' && addTask()}
            />
            <button className="btn-primary task-add" onClick={addTask}>Add</button>
          </div>
          <div className="task-helper">Individual goals for your deep work sessions. VELLIN protects your focus while these are active.</div>
          <div className="task-controls simple">
            <div className="task-field">
              <span className="task-view-label">Start</span>
              <input
                className="task-select task-time"
                type="time"
                aria-label="Start time"
                value={taskTime}
                onChange={(e) => {
                  const nextTime = e.target.value;
                  setTaskTime(nextTime);
                  if (!taskEndTime) {
                    setTaskEndTime(addMinutesToTime(nextTime, 60));
                  }
                }}
              />
            </div>
            <div className="task-field">
              <span className="task-view-label">End</span>
              <input className="task-select task-time" type="time" aria-label="End time" value={taskEndTime} onChange={(e) => setTaskEndTime(e.target.value)} />
            </div>
          </div>
          <div className="task-list">
            {visibleTasks.map((t, index) => {
              const doneToday = isTaskCompleteToday(t, todayKey);
              return (
                <div key={`${t.id || t.title || 'task'}-${index}`} className={`task-item ${doneToday ? 'done' : ''}`}>
                  <button className="task-check" onClick={() => toggleTask(t.id)}>{doneToday ? <CheckCircle2 size={16} /> : <div className="task-dot" />}</button>
                  {editTaskId === t.id ? (
                    <div className="task-edit">
                      <input className="task-edit-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={80} />
                      <div className="task-edit-row">
                        <input className="task-select task-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                        <input className="task-select task-time" type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                      </div>
                      <div className="task-actions">
                        <button className="btn-primary task-save" onClick={saveEditTask}>Save</button>
                        <button className="btn-secondary task-cancel" onClick={cancelEditTask}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="task-text">
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        {t.startTime && <span className="task-due-date">{formatTimeRange(t.startTime, t.durationMins || 45)}</span>}
                      </div>
                    </div>
                  )}
                  <div className="task-actions">
                    {editTaskId !== t.id && (
                      <button className="task-edit-btn" onClick={() => startEditTask(t)}><Pencil size={14} /></button>
                    )}
                    <button className="task-remove" onClick={() => removeTask(t.id)}><X size={14} /></button>
                  </div>
                </div>
              );
            })}
            {!sortedTasks.length && (
              <div className="timeline-empty">No tasks yet.</div>
            )}
            {remainingTasks > 0 && (
              <div className="timeline-empty">+{remainingTasks} more tasks</div>
            )}
          </div>
        </div>
        <div className="glass-card bento-card pro-upgrade-card">
          <div className="dashboard-card-kicker">Upgrade</div>
          <div className="section-row">
            <div className="section-title">Personal Reduction Plan</div>
            <div className="pro-upgrade-lock">{isPro ? 'ACTIVE' : <><Lock size={14} /> PRO</>}</div>
          </div>
          <div className="pro-upgrade-copy">
            <div className="pro-upgrade-title">{isPro ? 'Your active reduction roadmap' : 'Your custom distraction reduction roadmap'}</div>
            <p className="plan-helper">{isPro ? activePlanSummary : hasUsedIntroTrial ? `Your intro trial has been used. Upgrade instantly at ${localizedProPrice}/month once billing goes live and keep your roadmap active with no second free trial.` : `${regionalCopy.trialHeading} Continue later at ${localizedProPrice}/month once billing goes live. Your roadmap studies your pickups, distraction apps, and focus history to lower distraction pressure week by week.`}</p>
          </div>
          <div className="pro-upgrade-highlights">
            {(isPro ? activePlanSteps : [
              'A fuller craving forecast with deeper insight cards',
              'Extra focus sessions added directly into your plan',
              'Prevention suggestions based on your tracked VELLIN activity'
            ]).map((item, index) => (
              <div key={`${item || 'pro-highlight'}-${index}`} className="pro-upgrade-highlight">{item}</div>
            ))}
          </div>
        {!isPro && <button className="btn-primary pro-upgrade-cta" onClick={onOpenProPlan}>{hasUsedIntroTrial ? regionalCopy.upgradeNow : regionalCopy.startTrial}</button>}
        </div>
      </div>

      {isFocusing ? (
         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ margin: '40px 0' }}>
            <ScheduledSessionInfo 
        distractions={userData.distractions} 
        onTestApp={onTestApp} 
        focusSeconds={focusSeconds} 
        sessions={sessions}
        setSessions={setSessions}
        isFocusing={isFocusing}
      />      <button className="btn-secondary" style={{ width: '100%', padding: '18px', color: 'var(--accent-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }} onClick={onToggleFocus}>
              Terminate Session
            </button>
         </motion.div>
      ) : null}
    </motion.div>
  );
};

// --- Command Menu ---
const CommandMenu = ({ isOpen, onClose, onStartFocus, onNavigate, regionalCopy }: { isOpen: boolean, onClose: () => void, onStartFocus: () => void, onNavigate: (tab: string) => void, regionalCopy: RegionalUiCopy }) => {
  const [query, setQuery] = useState('');
  
  if (!isOpen) return null;
  
  return (
    <div className="cmd-modal-overlay" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="cmd-modal" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <Search size={20} color="var(--text-secondary)" />
          <input autoFocus placeholder="Type a command or search..." className="cmd-input" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="cmd-list">
          <div style={{ padding: '8px 24px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>{regionalCopy.actionsLabel}</div>
          <div className="cmd-item" onClick={() => { onStartFocus(); onClose(); }}><Zap size={16} /> {regionalCopy.startFocusSession} <span className="cmd-kbd">{'\u21B5'}</span></div>
          <div className="cmd-item" onClick={() => { onNavigate('forecast'); onClose(); }}><Activity size={16} /> {regionalCopy.forecastLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('friends'); onClose(); }}><Users size={16} /> {regionalCopy.friendsLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('profile'); onClose(); }}><SettingsIcon size={16} /> {regionalCopy.settingsPreferences}</div>
          <div style={{ padding: '16px 24px 8px', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>{regionalCopy.navigationLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('review'); onClose(); }}><BarChart3 size={16} /> {regionalCopy.reviewLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('home'); onClose(); }}><Activity size={16} /> {regionalCopy.homeLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('friends'); onClose(); }}><Users size={16} /> {regionalCopy.friendsLabel}</div>
          <div className="cmd-item" onClick={() => { onNavigate('profile'); onClose(); }}><UserIcon size={16} /> {regionalCopy.profileLabel}</div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Achievements Constants ---

const ACHIEVEMENTS: Achievement[] = [
  { id: 'focus_1h', title: 'Focus Initiate', metric: 'focus_seconds', target: 3600, icon: '\uD83C\uDF31', color: '#10B981', desc: '1 hour of total focus', tier: 'bronze' },
  { id: 'focus_5h', title: 'Deep Voyager', metric: 'focus_seconds', target: 18000, icon: '\uD83C\uDF0A', color: '#3B82F6', desc: '5 hours of total focus', tier: 'silver' },
  { id: 'focus_10h', title: 'Time Weaver', metric: 'focus_seconds', target: 36000, icon: '\uD83E\uDDF6', color: '#8B5CF6', desc: '10 hours of total focus', tier: 'gold' },
  { id: 'focus_25h', title: 'Focus Master', metric: 'focus_seconds', target: 90000, icon: '\uD83C\uDFC6', color: '#F59E0B', desc: '25 hours of total focus', tier: 'platinum' },
  { id: 'focus_50h', title: 'Unstoppable Force', metric: 'focus_seconds', target: 180000, icon: '\u2604\uFE0F', color: '#EF4444', desc: '50 hours of total focus', tier: 'diamond' },
  { id: 'focus_100h', title: 'Zen Architect', metric: 'focus_seconds', target: 360000, icon: '\u26E9\uFE0F', color: '#EC4899', desc: '100 hours of total focus', tier: 'legend' },
  { id: 'focus_250h', title: 'Legendary Mind', metric: 'focus_seconds', target: 900000, icon: '\uD83D\uDC51', color: '#FBBF24', desc: '250 hours of total focus', tier: 'mythic' },

  { id: 'streak_3', title: 'Consistent Fire', metric: 'streak_days', target: 3, icon: '\uD83D\uDD25', color: '#F97316', desc: '3 day focus streak', tier: 'bronze' },
  { id: 'streak_7', title: 'Week of Will', metric: 'streak_days', target: 7, icon: '\uD83D\uDEE1\uFE0F', color: '#06B6D4', desc: '7 day focus streak', tier: 'silver' },
  { id: 'streak_14', title: 'Two-Week Titan', metric: 'streak_days', target: 14, icon: '\uD83D\uDEAA', color: '#22C55E', desc: '14 day focus streak', tier: 'gold' },
  { id: 'streak_30', title: 'Monthly Momentum', metric: 'streak_days', target: 30, icon: '\uD83D\uDCC5', color: '#6366F1', desc: '30 day focus streak', tier: 'platinum' },

  { id: 'sessions_1', title: 'Session Starter', metric: 'sessions', target: 1, icon: '\uD83C\uDFC1', color: '#38BDF8', desc: 'Complete your first session', tier: 'bronze' },
  { id: 'sessions_10', title: 'Focus Regular', metric: 'sessions', target: 10, icon: '\uD83E\uDDEA', color: '#34D399', desc: 'Complete 10 sessions', tier: 'silver' },
  { id: 'sessions_50', title: 'Ritual Builder', metric: 'sessions', target: 50, icon: '\uD83C\uDF0C', color: '#A855F7', desc: 'Complete 50 sessions', tier: 'gold' },
  { id: 'sessions_150', title: 'Session Architect', metric: 'sessions', target: 150, icon: '\uD83D\uDD2E', color: '#E879F9', desc: 'Complete 150 sessions', tier: 'legend' },

  { id: 'tasks_1', title: 'First Task', metric: 'tasks', target: 1, icon: '\u2705', color: '#10B981', desc: 'Complete your first task', tier: 'bronze' },
  { id: 'tasks_25', title: 'Task Flow', metric: 'tasks', target: 25, icon: '\uD83D\uDCCB', color: '#60A5FA', desc: 'Complete 25 tasks', tier: 'silver' },
  { id: 'tasks_100', title: 'Task Master', metric: 'tasks', target: 100, icon: '\uD83C\uDFE0', color: '#F59E0B', desc: 'Complete 100 tasks', tier: 'gold' },
  { id: 'tasks_250', title: 'Task Legend', metric: 'tasks', target: 250, icon: '\uD83D\uDCC8', color: '#F97316', desc: 'Complete 250 tasks', tier: 'platinum' },

  { id: 'goals_1', title: 'Goal Keeper', metric: 'goal_days', target: 1, icon: '\uD83C\uDFC6', color: '#FBBF24', desc: 'Hit your daily goal once', tier: 'bronze' },
  { id: 'goals_7', title: 'Goal Rhythm', metric: 'goal_days', target: 7, icon: '\uD83C\uDF1F', color: '#22D3EE', desc: 'Hit your daily goal 7 times', tier: 'silver' },
  { id: 'goals_30', title: 'Goal Champion', metric: 'goal_days', target: 30, icon: '\uD83C\uDF96\uFE0F', color: '#F472B6', desc: 'Hit your daily goal 30 times', tier: 'gold' },
  { id: 'goals_90', title: 'Goal Virtuoso', metric: 'goal_days', target: 90, icon: '\uD83C\uDFB6', color: '#C084FC', desc: 'Hit your daily goal 90 times', tier: 'legend' }
];

const CelebrationModal = ({ achievement, onClose }: { achievement: Achievement, onClose: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="cmd-modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.95)' }} onClick={onClose}>
    <motion.div initial={{ scale: 0.5, y: 50, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="celebration-card" onClick={e => e.stopPropagation()}>
      <div style={{ fontSize: '5rem', marginBottom: '24px' }}>{achievement.icon}</div>
      <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: '12px' }}>ACHIEVEMENT UNLOCKED!</h2>
      <div style={{ padding: '4px 16px', background: achievement.color, color: '#000', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '20px', display: 'inline-block' }}>{achievement.title}</div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.5, marginBottom: '32px' }}>{achievement.desc}</p>
      <button className="btn-primary" style={{ width: '100%', padding: '18px' }} onClick={onClose}>Let's go!</button>
    </motion.div>
  </motion.div>
);

const MilestoneRecapModal = ({ achievements, onClose }: { achievements: Achievement[], onClose: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="cmd-modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
    <motion.div initial={{ scale: 0.6, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }} className="recap-card" onClick={e => e.stopPropagation()}>
      <h2>Milestones Unlocked</h2>
      <p>You've just leveled up your focus journey.</p>
      <div className="recap-grid">
        {achievements.map(ach => (
          <div key={ach.id} className="recap-item">
            <div className="recap-icon">{ach.icon}</div>
            <div className="recap-title">{ach.title}</div>
            <div className="recap-desc">{ach.desc}</div>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={onClose}>Continue</button>
    </motion.div>
  </motion.div>
);

const CravingHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="forecast-header">
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  </div>
);

const CravingTimeline = ({ values }: { values: number[] }) => {
  const width = 600;
  const height = 140;
  const padding = 12;
  const max = Math.max(1, ...values);
  const step = (width - padding * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => ({
    x: padding + i * step,
    y: height - padding - (v / max) * (height - padding * 2)
  }));
  const path = points.reduce((d, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const prev = points[i - 1];
    const midX = (prev.x + point.x) / 2;
    return `${d} C ${midX} ${prev.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const area = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="glass-card forecast-card">
      <div className="section-title">Craving Timeline</div>
      <div className="forecast-graph">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="cravingLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#b4bcc6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ff5bd1" />
            </linearGradient>
            <linearGradient id="cravingFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 91, 209, 0.35)" />
              <stop offset="100%" stopColor="rgba(24, 24, 29, 0)" />
            </linearGradient>
          </defs>
          <motion.path
            d={area}
            fill="url(#cravingFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
          <motion.path
            d={path}
            fill="none"
            stroke="url(#cravingLine)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
        </svg>
        <div className="forecast-axis">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
      </div>
    </div>
  );
};

const TriggerBreakdown = ({ peakTime, topApp, mood }: { peakTime: string, topApp: string, mood?: string }) => (
  <div className="glass-card forecast-card">
    <div className="section-title">Trigger Breakdown</div>
    <div className="forecast-list">
      <div>Peak craving: <strong>{peakTime}</strong></div>
      <div>Most triggered app: <strong>{topApp}</strong></div>
      {mood ? <div>Common mood: <strong>{mood}</strong></div> : null}
    </div>
  </div>
);

const PreventionSuggestions = ({ suggestions, onStartFocus, onAction }: { suggestions: { title: string, desc: string, cta: string }[], onStartFocus: () => void, onAction: (title: string) => void }) => (
  <div className="forecast-section">
    <div className="section-title">Prevention Suggestions</div>
    <motion.div className="forecast-suggestions" initial="hidden" animate="show" variants={staggerContainer}>
      {suggestions.map((s, i) => (
        <motion.div key={i} variants={fadeUp} className="glass-card suggestion-card">
          <div className="suggestion-title">{s.title}</div>
          <div className="suggestion-desc">{s.desc}</div>
          <button
            className="btn-secondary"
            onClick={() => {
              if (s.title === 'Start a focus session') onStartFocus();
              onAction(s.title);
            }}
          >
            {s.cta}
          </button>
        </motion.div>
      ))}
    </motion.div>
  </div>
);

const ProFeatures = ({ isPro, onUpgrade }: { isPro: boolean, onUpgrade: () => void }) => {
  if (isPro) return null;
  const items = [
    { title: 'Deep Craving Forecast', desc: 'Hourly urge windows, app-level pressure, and better focus timing.' },
    { title: 'Personal Reduction Roadmap', desc: 'A stronger plan built from your pickups, blocks, and focus history.' },
    { title: 'Prevention Rituals', desc: 'Actionable reset steps matched to your distraction pattern.' },
    { title: 'Premium Focus Blocks', desc: 'Longer-form daily sessions added directly into your focus plan.' }
  ];

  return (
    <div className="forecast-section">
      <div className="section-title">VELLIN PRO</div>
      <div className="forecast-pro">
        {items.map((item, idx) => (
          <div key={idx} className={`glass-card pro-card ${isPro ? 'unlocked' : 'locked'}`}>
            <div className="pro-card-head">
              {!isPro && <Lock size={14} />}
              <span>{item.title}</span>
              {isPro && <span className="pro-unlocked">Unlocked</span>}
            </div>
            <div className="pro-card-desc">{item.desc}</div>
            {!isPro && <button className="btn-primary" onClick={onUpgrade}>Unlock Pro</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

const ForecastLocked = ({ onUpgrade, regionalCopy }: { onUpgrade: () => void, regionalCopy: RegionalUiCopy }) => (
  <div className="forecast-lock-shell">
    <div className="glass-card forecast-lock-card">
      <div className="forecast-lock-top">
        <div className="forecast-lock-badge"><Lock size={14} /> PRO ONLY</div>
        <div className="forecast-lock-orb">
          <Activity size={26} />
        </div>
      </div>
      <h2>{regionalCopy.forecastLockedTitle}</h2>
      <p>{regionalCopy.forecastLockedDescription}</p>
      <div className="forecast-lock-grid">
        {[
          'Peak craving windows by hour',
          'Most irresistible apps and trigger chains',
          'Best recovery windows for deep work',
          'Personalized prevention rituals'
        ].map((item, index) => (
          <div key={`${item || 'forecast-lock-chip'}-${index}`} className="forecast-lock-chip">{item}</div>
        ))}
      </div>
      <button className="btn-primary" onClick={onUpgrade}>{regionalCopy.forecastUnlockCta}</button>
    </div>

    <div className="forecast-preview-grid">
      <div className="glass-card forecast-preview-card blurred">
        <div className="section-title">Tonight's Risk</div>
        <div className="forecast-preview-value">8:10 PM</div>
        <div className="forecast-preview-text">Craving intensity rises after your last pickup window.</div>
      </div>
      <div className="glass-card forecast-preview-card blurred">
        <div className="section-title">Primary App</div>
        <div className="forecast-preview-value">Instagram</div>
        <div className="forecast-preview-text">Usually opened first when you drift out of focus.</div>
      </div>
      <div className="glass-card forecast-preview-card blurred large">
        <div className="section-title">Deep Analysis Preview</div>
        <div className="forecast-preview-lines">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  </div>
);

const ForecastPage = ({ isPro, onUpgrade, onStartFocus, onAction, blockedByApp, phonePickups, focusByDate, survey, totalReclaimed, regionalCopy }: { isPro: boolean, onUpgrade: () => void, onStartFocus: () => void, onAction: (title: string) => void, blockedByApp: Record<string, number>, phonePickups: number, focusByDate: Record<string, number>, survey: string[] | null, totalReclaimed: number, regionalCopy: RegionalUiCopy }) => {
  const forecastValues = Array.from({ length: 24 }, (_, i) => {
    const base = 0.3 + 0.2 * Math.sin((i / 24) * Math.PI * 2 - 1);
    const eveningPeak = Math.exp(-Math.pow(i - 20, 2) / 18) * 0.9;
    const afternoon = Math.exp(-Math.pow(i - 14, 2) / 25) * 0.5;
    const pickupBias = Math.min(0.3, phonePickups / 180);
    return base + eveningPeak + afternoon + pickupBias;
  });
  const maxIndex = forecastValues.reduce((best, val, idx) => (val > forecastValues[best] ? idx : best), 0);
  const peakTime = `${((maxIndex + 11) % 12) + 1}:00 ${maxIndex < 12 ? 'AM' : 'PM'}`;
  const topApp = Object.entries(blockedByApp).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Instagram';
  const mood = survey?.[1] || 'Boredom';
  const triggerSource = survey?.[2] || 'Habitual Checking';
  const lowIndex = forecastValues.reduce((best, val, idx) => (val < forecastValues[best] ? idx : best), 0);
  const bestFocusWindow = `${((lowIndex + 11) % 12) + 1}:00 ${lowIndex < 12 ? 'AM' : 'PM'}`;
  const totalFocusHours = (totalReclaimed / 3600).toFixed(1);
  const avgDailyFocus = Object.values(focusByDate).length
    ? Math.round(Object.values(focusByDate).reduce((sum, secs) => sum + secs, 0) / Object.values(focusByDate).length / 60)
    : Math.round(totalReclaimed / 60);
  const researchCards = [
    { label: 'Most vulnerable window', value: peakTime, sub: 'When urges are most likely to break your streak.' },
    { label: 'Most craved app', value: topApp, sub: 'Your most magnetic distraction based on block attempts.' },
    { label: 'Likely emotional trigger', value: mood, sub: `Paired with ${triggerSource.toLowerCase()} in your setup.` },
    { label: 'Best focus window', value: bestFocusWindow, sub: 'The lightest urge period for deep work.' }
  ];
  const suggestions = [
    { title: 'Breath ritual', desc: '60 seconds of slow nasal breathing to reset the urge.', cta: 'Do this now' },
    { title: 'Short walk', desc: 'A 3-minute reset breaks the craving loop.', cta: 'Do this now' },
    { title: 'Micro-task', desc: 'Complete one tiny task to shift momentum.', cta: 'Do this now' },
    { title: 'Hydration reminder', desc: 'Drink water to reduce mental fatigue triggers.', cta: 'Do this now' },
    { title: 'Start a focus session', desc: 'Enter focus mode before the spike hits.', cta: 'Do this now' }
  ];

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
      <CravingHeader title={regionalCopy.forecastLabel} subtitle={regionalCopy.forecastSubtitle} />
      {!isPro ? (
        <ForecastLocked onUpgrade={onUpgrade} regionalCopy={regionalCopy} />
      ) : (
        <>
          <div className="forecast-grid">
            <CravingTimeline values={forecastValues} />
            <TriggerBreakdown peakTime={peakTime} topApp={topApp} mood={mood} />
          </div>
          <div className="forecast-research-grid">
            {researchCards.map((card, index) => (
              <div key={`${card.label || 'forecast-card'}-${index}`} className="glass-card forecast-research-card">
                <div className="section-title">{card.label}</div>
                <div className="forecast-research-value">{card.value}</div>
                <div className="forecast-research-sub">{card.sub}</div>
              </div>
            ))}
          </div>
          <div className="glass-card forecast-card forecast-deep-dive">
            <div className="section-row">
              <div className="section-title">Deep Research</div>
              <span className="forecast-insight-pill">{phonePickups} pickups logged</span>
            </div>
            <div className="forecast-list">
              <div>Your cravings build fastest after repeated pickups in the late day and early evening.</div>
              <div>{topApp} is your highest-friction app, which makes it the best candidate for stricter blocking.</div>
              <div>You have reclaimed {totalFocusHours}h of focus so far, with an average of {avgDailyFocus}m on active days.</div>
              <div>Start focus 20-30 minutes before {peakTime} to intercept the strongest urge wave.</div>
            </div>
          </div>
          <PreventionSuggestions suggestions={suggestions} onStartFocus={onStartFocus} onAction={onAction} />
          <ProFeatures isPro={isPro} onUpgrade={onUpgrade} />
        </>
      )}
    </motion.div>
  );
};

const Blocklist = ({
  distractions,
  onChange,
  embedded = false,
  installedApps,
}: {
  distractions: string[],
  onChange: (next: string[]) => void,
  embedded?: boolean,
  installedApps: InstalledAppEntry[],
}) => {
  const [showAllApps, setShowAllApps] = useState(false);
  const [appSearch, setAppSearch] = useState('');
  const toggle = (app: string) => {
    const next = distractions.includes(app) ? distractions.filter(x => x !== app) : [...distractions, app];
    onChange(next);
  };

  const allApps = useMemo(() => mergeSelectableApps(installedApps), [installedApps]);
  const installedIconLookup = useMemo(() => installedApps.reduce<Record<string, string>>((acc, app) => {
    if (app.iconDataUrl && app.label) {
      acc[normalizeAppLabel(app.label)] = app.iconDataUrl;
    }
    return acc;
  }, {}), [installedApps]);
  const getAppIcon = useCallback((app: string) => installedIconLookup[normalizeAppLabel(app)] || APP_LOGOS[app] || null, [installedIconLookup]);
  const filteredApps = useMemo(() => {
    const normalizedSearch = normalizeAppLabel(appSearch);
    if (!normalizedSearch) return allApps;
    return allApps.filter((app) => normalizeAppLabel(app).includes(normalizedSearch));
  }, [allApps, appSearch]);
  const visibleApps = allApps.slice(0, 6);

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} style={embedded ? { display: 'grid', gap: '12px' } : { padding: '24px' }}>
      {!embedded && (
        <>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.02em' }}>Blocklist</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Select the apps that will be blocked during Focus Sessions.</p>
        </>
      )}
      
      <div className={`blocklist-list ${showAllApps ? 'expanded' : ''}`}>
         {visibleApps.map((app, index) => {
           const isActive = distractions.includes(app);
           return (
            <div key={`${app || 'visible-app'}-${index}`} className="glass-card interactive" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => toggle(app)}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 {getAppIcon(app) ? <img src={getAppIcon(app) ?? ''} style={{ width: '40px', height: '40px', borderRadius: '10px' }} alt={app} /> : <div className="custom-app-icon" style={{ width: '40px', height: '40px' }}>{app.charAt(0)}</div>}
                 <span style={{ fontSize: '1.05rem', fontWeight: 500 }}>{app}</span>
               </div>
               
               {/* iOS style toggle switch */}
               <div style={{ width: '50px', height: '30px', borderRadius: '30px', background: isActive ? 'var(--accent-danger)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: '0.3s' }}>
                 <div style={{ content: '""', position: 'absolute', top: '2px', left: isActive ? '22px' : '2px', width: '26px', height: '26px', background: '#fff', borderRadius: '50%', transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
               </div>
             </div>
           );
         })}
      </div>
      <div style={{ marginTop: '16px' }}>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowAllApps(prev => !prev)}>
          {showAllApps ? 'Show fewer apps' : embedded ? 'Show more apps' : 'Show all apps'}
        </button>
      </div>
      {showAllApps && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '10px' }}>
          <input
            className="auth-input search"
            placeholder="Search installed apps"
            value={appSearch}
            onChange={(event) => setAppSearch(event.target.value)}
          />
          <div className="glass-card" style={{ maxHeight: embedded ? '280px' : '360px', overflowY: 'auto', padding: '8px 0' }}>
            {filteredApps.map((app, index) => {
              const isActive = distractions.includes(app);
              return (
                <button
                  key={`${app || 'searchable-app'}-${index}`}
                  type="button"
                  className="mock-app-row"
                  style={{ width: '100%', background: 'transparent', border: 'none' }}
                  onClick={() => toggle(app)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getAppIcon(app) ? <img src={getAppIcon(app) ?? ''} style={{ width: '34px', height: '34px', borderRadius: '8px' }} alt={app} /> : <div className="custom-app-icon">{app.charAt(0)}</div>}
                    <span>{app}</span>
                  </div>
                  <div className={`app-toggle ${isActive ? 'active' : ''}`}>{isActive && <CheckCircle2 size={14} />}</div>
                </button>
              );
            })}
            {filteredApps.length === 0 && <div className="all-apps-empty-state">No installed apps matched that search.</div>}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const RealityCheckStep = ({ distractions, deviceUsageAccessStatus, weeklyBlockedUsageByApp, onNext }: { distractions: string[], deviceUsageAccessStatus: DeviceUsageAccessStatus, weeklyBlockedUsageByApp: Record<string, number>, onNext: () => void }) => {
  const reduceMotion = useReducedMotion() || Capacitor.isNativePlatform();
  const selectedCount = Math.max(1, distractions.length);
  const distractionLabel = distractions.length ? distractions.join(', ') : 'your chosen distractions';
  const hasConnectedUsageData = deviceUsageAccessStatus === 'granted';
  const deviceUsageSupported = canUseNativeDeviceUsage();
  const topUsageEntry = Object.entries(weeklyBlockedUsageByApp).sort((a, b) => b[1] - a[1])[0];
  const hasMeaningfulUsageData = Boolean(topUsageEntry && topUsageEntry[1] > 0);
  const topUsageText = hasMeaningfulUsageData && topUsageEntry
    ? `${topUsageEntry[0]} took ${Math.round(topUsageEntry[1] / 60000)} minutes last week.`
    : deviceUsageSupported
      ? 'Usage access is connected. VELLIN is waiting for Android to return real last-week app time here.'
      : 'Mobile web cannot read Screen Time or Usage Access directly, so VELLIN is using your setup answers here for now.';

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
      className="onboarding-step-shell reality-check-step"
      style={{ padding: '34px 24px 12px', display: 'flex', flexDirection: 'column', minHeight: '100dvh', height: '100dvh', justifyContent: 'space-between' }}
    >
      <div style={{ marginTop: 'auto' }}>
      <div className="reality-check-hero" style={{ textAlign: 'center', marginBottom: '24px' }}>
         <div style={{ width: '58px', height: '58px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity color="var(--accent-danger)" size={32} />
         </div>
         <h2 className="reality-check-kicker" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '14px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Reality Check</h2>
         <div className="reality-check-count" style={{ fontSize: '4rem', fontWeight: 900, color: 'var(--accent-danger)', lineHeight: 1, textShadow: '0 4px 20px rgba(239, 68, 68, 0.3)' }}>{selectedCount}</div>
         
         <p className="reality-check-copy" style={{ fontSize: '1rem', marginTop: '20px', color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.6 }}>
           {hasConnectedUsageData
             ? `We are now using your connected device usage data to review ${distractionLabel}.`
             : <>You marked <b style={{ color: 'var(--accent-danger)', fontSize: '1.3rem' }}>{selectedCount}</b> distraction {selectedCount === 1 ? 'trigger' : 'triggers'}: {distractionLabel}.</>}
         </p>
         <div className="reality-check-subcopy" style={{ fontSize: '0.95rem', marginTop: '14px', color: 'var(--text-secondary)' }}>
           {hasConnectedUsageData
             ? topUsageText
             : deviceUsageSupported
               ? 'Connect device usage access to replace this setup summary with your real last-week app time from Screen Time or Usage Access.'
               : 'On the website, VELLIN cannot read Screen Time directly. The native iPhone and Android app can ask for that before deeper reports.'}
         </div>
      </div>

      <div className="glass-card bento-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)', marginBottom: '18px' }}>
         <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.05em', fontWeight: 600 }}>WHAT HAPPENS NEXT</div>
         <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3 }}>
           {hasConnectedUsageData
             ? 'We will use your real device usage history for the next Reality Check and the reduction plan.'
             : 'We will keep using your tracked VELLIN behavior for now, and switch to real device usage history once the native mobile connection is finished.'}
         </div>
      </div>

      </div>
      <div className="onboarding-step-actions" style={{ marginTop: 'auto', paddingTop: '6px' }}>
        <button className="btn-primary onboarding-step-cta" style={{ width: '100%', padding: '18px', fontSize: '1.05rem' }} onClick={onNext}>
          It's time to change.
        </button>
      </div>
    </motion.div>
  );
};

const Profile = ({ totalSessions, totalReclaimed, streak, isDarkMode, setIsDarkMode, currentLevel, totalXP, currentXPProgress, xpToNextLevel, dailyGoalHits, taskCompletions, dailyGoalSeconds, setDailyGoalSeconds, notificationsEnabled, onToggleNotifications, notificationPermissionLabel, soundEnabled, setSoundEnabled, breakReminderMins, setBreakReminderMins, distractions, onUpdateDistractions, installedApps, isPro, onOpenProPlan, onRetakeSetup, onSignOut, onDeleteAccount, onOpenAuth, onLeaveGuestMode, onOpenUsageAccess, deviceUsageAccessStatus, accountEmail, username, onSaveUsername, avatarUrl, avatarInitials, isAuthenticated, proPricingRegion, onSetProPricingRegion, localizedProPrice, localizedProPriceNote, hasUsedIntroTrial, isIntroTrialActive, trialDaysLeft, membershipAutoRenew, onCancelMembershipRenewal, regionalCopy }: { totalSessions: number, totalReclaimed: number, streak: number, isDarkMode: boolean, setIsDarkMode: (v: boolean) => void, currentLevel: number, totalXP: number, currentXPProgress: number, xpToNextLevel: number, dailyGoalHits: number, taskCompletions: number, dailyGoalSeconds: number, setDailyGoalSeconds: (v: number) => void, notificationsEnabled: boolean, onToggleNotifications: () => void, notificationPermissionLabel: string, soundEnabled: boolean, setSoundEnabled: (v: boolean) => void, breakReminderMins: number, setBreakReminderMins: (v: number) => void, distractions: string[], onUpdateDistractions: (next: string[]) => void, installedApps: InstalledAppEntry[], isPro: boolean, onOpenProPlan: () => void, onRetakeSetup: () => void, onSignOut: () => void, onDeleteAccount: () => void, onOpenAuth: () => void, onLeaveGuestMode: () => void, onOpenUsageAccess: () => void, deviceUsageAccessStatus: DeviceUsageAccessStatus, accountEmail: string, username: string, onSaveUsername: (nextUsername: string) => Promise<{ ok: boolean, message: string, username?: string }>, avatarUrl: string | null, avatarInitials: string, isAuthenticated: boolean, proPricingRegion: PricingRegionPreference, onSetProPricingRegion: (value: PricingRegionPreference) => void, localizedProPrice: string, localizedProPriceNote: string, hasUsedIntroTrial: boolean, isIntroTrialActive: boolean, trialDaysLeft: number, membershipAutoRenew: boolean, onCancelMembershipRenewal: () => void, regionalCopy: RegionalUiCopy }) => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(username);
  const [usernameStatus, setUsernameStatus] = useState<{ tone: 'info' | 'success' | 'warning', message: string } | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const membershipRef = useRef<HTMLDivElement | null>(null);
  const blocklistRef = useRef<HTMLDivElement | null>(null);
  const preferencesRef = useRef<HTMLDivElement | null>(null);
  const deviceUsageSupported = canUseNativeDeviceUsage();
  const formatTotalTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const goalMinutes = Math.max(30, Math.round(dailyGoalSeconds / 60));
  const goalHours = Math.floor(goalMinutes / 60);
  const goalRemainder = goalMinutes % 60;
  const jumpToSection = (ref: { current: HTMLDivElement | null }) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowSettingsMenu(false);
  };
  const normalizedDraft = sanitizeUsername(usernameDraft);
  const regionOptions = [
    { value: 'auto', label: 'Auto Detect' },
    ...Object.entries(LOCALIZED_PRO_PRICING).map(([code, value]) => ({
      value: code,
      label: value.countryLabel,
    })),
  ];
  const deviceUsageLabel = !deviceUsageSupported
    ? 'Later on iPhone'
    : deviceUsageAccessStatus === 'granted'
      ? 'Connected'
      : deviceUsageAccessStatus === 'requested'
        ? 'Requested'
        : deviceUsageAccessStatus === 'skipped'
          ? 'Skipped'
          : 'Not connected';

  useEffect(() => {
    setUsernameDraft(username);
  }, [username]);

  const submitUsername = async () => {
    setIsSavingUsername(true);
    const result = await onSaveUsername(usernameDraft);
    setIsSavingUsername(false);
    setUsernameStatus({ tone: result.ok ? 'success' : 'warning', message: result.message });
    if (result.ok) {
      setIsEditingUsername(false);
      if (result.username) {
        setUsernameDraft(result.username);
      }
    }
  };

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em' }}>{regionalCopy.profileTitle}</h1>
        <button className="profile-settings-button" type="button" onClick={() => setShowSettingsMenu((prev) => !prev)} aria-label="Open profile settings">
          <SettingsIcon size={20} color="var(--text-secondary)" />
        </button>
        {showSettingsMenu && (
          <>
            <button
              type="button"
              aria-label="Close profile settings"
              className="profile-settings-scrim"
              onClick={() => setShowSettingsMenu(false)}
            />
            <div className="glass-card profile-settings-menu" role="dialog" aria-modal="true" aria-label="Profile settings">
              <div className="profile-settings-header">
                <div>
                  <div className="profile-settings-label">{regionalCopy.settingsQuick}</div>
                  <div className="profile-settings-title">{regionalCopy.settingsTitle}</div>
                </div>
                <button className="profile-settings-close" type="button" onClick={() => setShowSettingsMenu(false)} aria-label="Close profile settings">
                  <X size={18} />
                </button>
              </div>
              <div className="profile-settings-list">
                <button className="profile-settings-item" type="button" onClick={() => jumpToSection(membershipRef)}>{regionalCopy.settingsMembership}</button>
                <button className="profile-settings-item" type="button" onClick={() => jumpToSection(blocklistRef)}>{regionalCopy.settingsShieldApps}</button>
                <button className="profile-settings-item" type="button" onClick={() => jumpToSection(preferencesRef)}>{regionalCopy.settingsPreferences}</button>
                <button className="profile-settings-item" type="button" onClick={() => { setShowSettingsMenu(false); onRetakeSetup(); }}>{regionalCopy.settingsRetake}</button>
                {!isAuthenticated && <button className="profile-settings-item" type="button" onClick={() => { setShowSettingsMenu(false); onOpenAuth(); }}>{regionalCopy.settingsCreateAccount}</button>}
                {isAuthenticated && <button className="profile-settings-item danger" type="button" onClick={() => { setShowSettingsMenu(false); onSignOut(); }}>{regionalCopy.settingsSignOut}</button>}
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
         <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--accent-gradient)', padding: '4px', marginBottom: '16px' }}>
               <div className="profile-avatar-shell">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="profile-avatar-image" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="profile-avatar-fallback">{avatarInitials || <User size={50} color="#fff" style={{ opacity: 0.8 }} />}</div>
                  )}
               </div>
            </div>
            <div style={{ position: 'absolute', bottom: '18px', right: '0', background: 'var(--accent-success)', color: '#000', fontSize: '0.65rem', fontWeight: 900, padding: '4px 8px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>LVL {currentLevel}</div>
         </div>
         <div className="profile-identity-card">
           <div className="profile-identity-top">
             <div>
               <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>@{username || 'vellinuser'}</h2>
               <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Your unique username for adding friends</p>
             </div>
             <button className="btn-secondary profile-username-edit" type="button" onClick={() => { setIsEditingUsername((prev) => !prev); setUsernameStatus(null); }}>
               {isEditingUsername ? 'Close' : 'Edit'}
             </button>
           </div>
           {isEditingUsername && (
             <div className="profile-username-editor">
               <input
                 className="auth-input profile-username-input"
                 value={usernameDraft}
                 onChange={(event) => setUsernameDraft(event.target.value)}
                 placeholder="Choose a username"
                 maxLength={20}
                 autoCapitalize="none"
                 autoCorrect="off"
                 spellCheck={false}
               />
               <div className="profile-username-hint">Only letters, numbers, and underscores. This is how friends add you.</div>
               <div className="profile-username-actions">
                 <div className="profile-username-preview">Preview: @{normalizedDraft || 'yourname'}</div>
                 <button className="btn-primary" type="button" onClick={() => void submitUsername()} disabled={isSavingUsername}>
                   {isSavingUsername ? 'Saving...' : 'Save Username'}
                 </button>
               </div>
               {usernameStatus && <div className={`auth-notice auth-notice-${usernameStatus.tone}`}>{usernameStatus.message}</div>}
             </div>
           )}
         </div>
         <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: '4px' }}>{accountEmail || 'Guest mode · saved on this device'}</p>
         <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{totalXP} XP {'\u00B7'} {currentXPProgress}/{xpToNextLevel} to next level</div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '32px' }}>
         {[
           { label: 'FOCUS', value: formatTotalTime(totalReclaimed), color: 'var(--accent-primary)' },
           { label: 'STREAK', value: `${streak}d`, color: 'var(--accent-warning)' },
           { label: 'SESSIONS', value: totalSessions, color: 'var(--accent-success)' },
           { label: 'GOALS', value: dailyGoalHits, color: 'var(--accent-secondary)' },
           { label: 'TASKS', value: taskCompletions, color: 'var(--accent-warning)' },
           { label: 'LEVEL', value: currentLevel, color: 'var(--accent-success)' }
        ].map((s, index) => (
          <div key={`${s.label || 'profile-stat'}-${index}`} className="glass-card" style={{ padding: '16px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color }}>{s.value}</div>
           </div>
         ))}
      </div>

      {/* Membership Card */}
      <div ref={membershipRef} className="glass-card profile-membership-card" style={{ padding: '20px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-warning)', marginBottom: '4px' }}>
              {isIntroTrialActive ? `Trial Active · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left` : isPro ? 'Pro Membership Active' : hasUsedIntroTrial ? 'Upgrade To Pro Instantly' : `${PRO_MONTHLY_PLAN.trialDays}-Day Free Trial Available`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isIntroTrialActive
                ? `Your one-time trial is running now. Billing is not connected yet, so VELLIN is previewing the subscription experience only.`
                : isPro
                  ? membershipAutoRenew
                    ? `Deep forecast insights, premium focus blocks, and your personalized reduction roadmap are unlocked. ${regionalCopy.renewalActive}.`
                    : `Deep forecast insights, premium focus blocks, and your personalized reduction roadmap stay unlocked for the current paid period. ${regionalCopy.renewalCanceled}.`
                  : hasUsedIntroTrial
                    ? `Your intro trial has already been used. You can still upgrade instantly at ${localizedProPrice}/month once billing goes live, but another free trial will not be offered.`
                    : `Start a one-time ${PRO_MONTHLY_PLAN.trialDays}-day free trial, then continue at ${localizedProPrice}/month later. Cancel anytime once billing goes live.`}
            </div>
            <div className="membership-trial-row">
              <div className="membership-trial-pill">
                {hasUsedIntroTrial ? regionalCopy.trialUsedLabel : `${PRO_MONTHLY_PLAN.trialDays}-day free trial`}
              </div>
              <div className="membership-trial-note">{localizedProPriceNote}</div>
            </div>
            <div className="membership-region-row">
              <label className="membership-region-label" htmlFor="pro-region-select">App Language Region</label>
              <select
                id="pro-region-select"
                className="auth-input membership-region-select"
                value={proPricingRegion}
                onChange={(e) => onSetProPricingRegion(e.target.value as PricingRegionPreference)}
              >
                {regionOptions.map((option, index) => (
                  <option key={`${option.value || 'region-option'}-${index}`} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div className="membership-manage-note">Changing this updates your app language and local copy. Pricing stays automatic and is estimated from the detected store region.</div>
            </div>
            {(isPro || isIntroTrialActive) && (
              <div className="membership-manage-row">
                <button className="btn-secondary membership-manage-btn" type="button" onClick={onCancelMembershipRenewal}>
                  {isIntroTrialActive ? 'Cancel Free Trial' : regionalCopy.cancelRenewal}
                </button>
                <div className="membership-manage-note">
                  {isIntroTrialActive
                    ? 'Canceling the trial ends Pro access right away and it will not continue into a paid plan later.'
                    : membershipAutoRenew
                      ? 'When live billing is connected, this will stop future charges while keeping the current paid month active.'
                      : 'Future renewal is already off in VELLIN. When live billing is connected, this is where subscription cancellation will stay in sync.'}
                </div>
              </div>
            )}
          </div>
         {isPro ? <CreditCard size={24} color="var(--accent-warning)" /> : <button className="btn-primary profile-upgrade-btn" onClick={onOpenProPlan}>{hasUsedIntroTrial ? regionalCopy.upgradeNow : regionalCopy.startTrial}</button>}
       </div>

      {/* Settings List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
         <div ref={blocklistRef} className="glass-card" style={{ padding: '20px' }}>
            <div className="section-row" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Focus Setup Questions</h3>
              <span className="pro-pill">Setup</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px' }}>Reopen the original starter questions whenever you want to refresh your trigger profile and recommendations.</div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={onRetakeSetup}>Retake setup questions</button>
         </div>

         <div ref={preferencesRef} className="glass-card" style={{ padding: '20px' }}>
            <div className="section-row" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Focus Blocklist</h3>
              <span className="pro-pill">Shield</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px' }}>Choose which apps get blocked automatically when a focus task or session starts.</div>
              <Blocklist distractions={distractions} onChange={onUpdateDistractions} embedded installedApps={installedApps} />
         </div>

         <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.1em' }}>Preferences</h3>

            <div className="toggle-row">
               <div>
                  <div className="toggle-title">Notifications</div>
                  <div className="toggle-sub">Three daily nudges and focus reminders</div>
               </div>
               <button className={`toggle-switch ${notificationsEnabled ? 'on' : ''}`} onClick={onToggleNotifications} aria-label="Toggle notifications">
                  <span />
               </button>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.6, marginTop: '-2px', marginBottom: '18px' }}>
              VELLIN can send three unique nudges around 9:15, 14:30, and 20:15 once the user allows notifications. Status: {notificationPermissionLabel}.
            </div>
            <div className="toggle-row">
               <div>
                  <div className="toggle-title">Sound Effects</div>
                  <div className="toggle-sub">Chimes for starts, stops, and unlocks</div>
               </div>
               <button className={`toggle-switch ${soundEnabled ? 'on' : ''}`} onClick={() => setSoundEnabled(!soundEnabled)} aria-label="Toggle sounds">
                  <span />
               </button>
            </div>

            <div className="toggle-row">
               <div>
                  <div className="toggle-title">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</div>
                  <div className="toggle-sub">Switch the overall theme</div>
               </div>
               <button className={`toggle-switch ${isDarkMode ? 'on' : ''}`} onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle theme">
                  <span />
               </button>
            </div>

            <div className="range-row">
               <div className="range-label">Daily Goal</div>
              <input className="range-input" type="range" min={30} max={1440} step={15} value={goalMinutes} onChange={(e) => setDailyGoalSeconds(Number(e.target.value) * 60)} />
               <div className="range-value">{goalHours ? `${goalHours}h ` : ''}{goalRemainder}m focus</div>
            </div>

            <div className="range-row">
               <div className="range-label">Break Reminder</div>
                <input className="range-input" type="range" min={15} max={90} step={5} value={breakReminderMins} onChange={(e) => setBreakReminderMins(Number(e.target.value))} />
                <div className="range-value">Every {breakReminderMins} minutes</div>
             </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.6, marginTop: '-6px' }}>
              While a focus session is running, VELLIN will prompt a short reset at this interval. If notifications are allowed, it can appear as a device notification too.
            </div>

          </div>
         <div className="glass-card" style={{ padding: '20px' }}>
            <div className="section-row" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Device Usage Data</h3>
              <span className="pro-pill">{deviceUsageLabel}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px', lineHeight: 1.6 }}>
              {deviceUsageSupported
                ? 'VELLIN can read Android Usage Access data so Reality Check can use your actual last-week app usage.'
                : 'True iPhone Screen Time sync still needs the Apple-native Xcode build and entitlement step.'}
            </div>
            {deviceUsageSupported ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                <button className="btn-secondary" type="button" style={{ width: '100%' }} onClick={onOpenUsageAccess}>
                  Manage device usage access
                </button>
                <div className="auth-helper">
                  If Android opens settings, enable Usage Access for VELLIN and then reopen the app.
                </div>
              </div>
            ) : (
              <div className="auth-notice auth-notice-info">
                iPhone Screen Time cannot be finished on this Windows machine alone, so VELLIN is keeping your reports honest and using tracked VELLIN activity for now.
              </div>
            )}
         </div>
         <div className="glass-card" style={{ padding: '20px' }}>
            <div className="section-row" style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Legal & Support</h3>
              <span className="pro-pill">Ready</span>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <a className="btn-secondary" href="/privacy" target="_blank" rel="noreferrer" style={{ width: '100%', textAlign: 'center' }}>Privacy Policy</a>
              <a className="btn-secondary" href="/terms" target="_blank" rel="noreferrer" style={{ width: '100%', textAlign: 'center' }}>Terms of Service</a>
              <a className="btn-secondary" href="/support" target="_blank" rel="noreferrer" style={{ width: '100%', textAlign: 'center' }}>Support</a>
            </div>
         </div>
         {isAuthenticated ? (
           <>
             <button className="interactive" style={{ marginTop: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-danger)', background: 'transparent', border: 'none', width: '100%', cursor: 'pointer' }} onClick={onSignOut}>
                <LogOut size={18} />
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Sign Out</span>
             </button>
             <button className="interactive" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#ffd7d7', background: 'rgba(255, 141, 161, 0.08)', border: '1px solid rgba(255, 141, 161, 0.18)', borderRadius: '18px', width: '100%', cursor: 'pointer', justifyContent: 'center' }} onClick={onDeleteAccount}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Delete Account</span>
             </button>
           </>
         ) : (
           <div className="glass-card" style={{ padding: '18px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, display: 'grid', gap: '12px' }}>
             <div>You are using VELLIN in guest mode. Friends, cloud sync, and account deletion become available once you create an account.</div>
             <button className="btn-primary" type="button" onClick={onOpenAuth}>Create account or log in</button>
             <button className="btn-secondary" type="button" onClick={onLeaveGuestMode}>Leave guest mode</button>
           </div>
         )}
      </div>
    </motion.div>
  );
};


const Review = ({ totalReclaimed, todayReclaimed, totalSessions, focusScore, blockedCount, blockedByApp, focusByDate, dailyGoalHits, dailyGoalSeconds, phonePickups, onOpenProPlan, isPro, proPlan, languageRegion }: { totalReclaimed: number, todayReclaimed: number, totalSessions: number, focusScore: number, blockedCount: number, blockedByApp: Record<string, number>, focusByDate: Record<string, number>, dailyGoalHits: number, dailyGoalSeconds: number, phonePickups: number, onOpenProPlan: () => void, isPro: boolean, proPlan: ProPlan | null, languageRegion: string }) => {
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const rangeDays = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  const series = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (rangeDays - 1 - i));
    const key = d.toDateString();
    const label = rangeDays > 7 ? d.getDate().toString() : d.toLocaleDateString(undefined, { weekday: 'short' });
    return { key, label, seconds: focusByDate[key] || 0 };
  });
  const maxSeconds = Math.max(1, ...series.map(d => d.seconds));
  const todayKey = new Date().toDateString();
  const seriesTotalSeconds = series.reduce((sum, d) => sum + d.seconds, 0);
  const totalRangeSeconds = range === 'today'
    ? Math.max(todayReclaimed, focusByDate[todayKey] || 0)
    : (seriesTotalSeconds || totalReclaimed);
  const focusHours = (totalRangeSeconds / 3600).toFixed(1);
  const avgMinutes = Math.round(totalRangeSeconds / Math.max(1, rangeDays) / 60);
  const topApps = Object.entries(blockedByApp).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mostFocused = series.reduce((best, item) => item.seconds > best.seconds ? item : best, series[0]);
  const appTotal = topApps.reduce((sum, [, count]) => sum + count, 0);

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
      <div className="review-header">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{getUiString(languageRegion, 'reviewTitle')}</h1>
          <div className="review-sub">{getUiString(languageRegion, 'reviewSubtitle')}</div>
        </div>
        <div className="review-range">
          {[{ key: 'today', label: getUiString(languageRegion, 'today') }, { key: '7d', label: getUiString(languageRegion, 'lastWeek') }, { key: '30d', label: getUiString(languageRegion, 'thirtyDays') }].map(opt => (
            <button key={opt.key} className={`review-pill ${range === opt.key ? 'active' : ''}`} onClick={() => setRange(opt.key as 'today' | '7d' | '30d')}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="review-grid">
        <div className="glass-card review-card">
          <div className="review-label">Focus Hours</div>
          <div className="review-value">{focusHours}h</div>
          <div className="review-meta">{avgMinutes}m average per day</div>
        </div>
        <div className="glass-card review-card">
          <div className="review-label">Phone Pickups</div>
          <div className="review-value">{phonePickups}</div>
          <div className="review-meta">{blockedCount} blocks prevented</div>
        </div>
        <div className="glass-card review-card">
          <div className="review-label">Sessions</div>
          <div className="review-value">{totalSessions}</div>
          <div className="review-meta">Focus score {focusScore}</div>
        </div>
        <div className="glass-card review-card">
          <div className="review-label">Goal Days</div>
          <div className="review-value">{dailyGoalHits}</div>
          <div className="review-meta">Goals met this month</div>
        </div>
      </div>

      <div className="glass-card review-card large">
        <div className="section-title">Activity</div>
        <div className="review-chart" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }}>
          {series.map(d => (
            <div key={d.key} className="review-bar">
              <div className="review-bar-fill" style={{ height: `${(d.seconds / maxSeconds) * 100}%` }} />
              <span>{d.label}</span>
            </div>
          ))}
        </div>
        <div className="review-meta">Total {Math.round(totalRangeSeconds / 60)} minutes</div>
      </div>

      <div className="glass-card review-card large">
        <div className="section-title">Focus vs Daily Goal</div>
        <div className="review-compare" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }}>
          {series.map((d) => (
            <div key={d.key} className="review-compare-bar">
              <div className="compare-bars">
                <span className="compare-bar focus" style={{ height: `${(d.seconds / maxSeconds) * 100}%` }} />
                <span className="compare-bar screen" style={{ height: `${Math.min(100, (dailyGoalSeconds ? (d.seconds / dailyGoalSeconds) * 100 : 0))}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>
        <div className="review-meta">Blue is actual focus time. Purple shows how close each day came to your current focus goal.</div>
      </div>

      <div className="review-grid">
        <div className="glass-card review-card">
          <div className="section-title">Tracked Distraction Pressure</div>
          <div className="review-insights">
            <div className="review-insight-item">Logged pickups: {phonePickups}</div>
            <div className="review-insight-item">Blocked distractions: {blockedCount}</div>
            <div className="review-insight-item">Unique blocked apps: {Object.keys(blockedByApp).length}</div>
            <div className="review-insight-item">Most interrupted app: {topApps[0]?.[0] || 'No data yet'}</div>
          </div>
        </div>
        <div className="glass-card review-card">
          <div className="section-title">Insights</div>
          <div className="review-insights">
            <div className="review-insight-item">Most focused day: {mostFocused?.label || 'N/A'}</div>
            <div className="review-insight-item">Average focus: {avgMinutes}m per day</div>
            <div className="review-insight-item">Focus sessions completed: {totalSessions}</div>
            <div className="review-insight-item">Goal days hit: {dailyGoalHits}</div>
          </div>
        </div>
      </div>

      <div className="review-grid">
        <div className="glass-card review-card">
          <div className="section-title">Top Apps</div>
          <div className="review-list">
            {topApps.length ? topApps.map(([app, count], index) => (
              <div key={`${app || 'top-app'}-${index}`} className="review-app">
                <span>{app}</span>
                <div className="app-bar"><span style={{ width: `${Math.min(100, (count / (topApps[0][1] || 1)) * 100)}%` }} /></div>
                <span>{appTotal ? Math.round((count / appTotal) * 100) : 0}%</span>
              </div>
            )) : <div className="review-meta">No distraction data yet.</div>}
          </div>
        </div>
        <div className="glass-card review-card">
          <div className="section-title">Momentum</div>
          <div className="review-value">{focusScore > 85 ? 'Elite' : focusScore > 60 ? 'Strong' : 'Rebuilding'}</div>
          <div className="review-meta">Keep the streak alive</div>
        </div>
      </div>

      <div className="glass-card review-card large pro-callout">
        <div className="section-row">
          <div>
            <div className="section-title">{isPro ? 'Pro Plan Active' : 'Pro Focus Plan'}</div>
            <div className="review-sub">{isPro ? 'Your personalized reduction tools are unlocked and running.' : 'A focused plan to reduce distraction pressure using the tools already available in VELLIN today.'}</div>
          </div>
          <span className="pro-pill">{isPro ? 'ACTIVE' : 'PRO'}</span>
        </div>
        <div className="review-insights" style={{ marginTop: '10px' }}>
          {(isPro
            ? (proPlan?.recommendations ?? [
              'Craving Forecast is fully unlocked with your behavioral data.',
              `Your current plan is using ${phonePickups} logged pickups and ${blockedCount} blocked distractions.`,
              'Your focus plan can now be refreshed any time from the premium tools.'
            ])
            : [
              'Choose a target distraction threshold and get a personalized reduction plan.',
              'Add extra focus sessions directly into your plan.',
              'See forecast insights based on your tracked VELLIN activity.'
            ]).map((item, index) => (
            <div key={`${item || 'review-insight'}-${index}`} className="review-insight-item">{item}</div>
          ))}
        </div>
        {!isPro && <button className="btn-primary focus-cta" onClick={onOpenProPlan}>Unlock Full Plan</button>}
      </div>
    </motion.div>
  );
};

const FriendsPage = ({
  supabase,
  authUserId,
  userName,
  username,
  accountEmail,
  totalReclaimed,
  phonePickups,
  streak,
  totalSessions,
  blockedCount,
  friendsBackendReady,
  onInvite,
  onShowToast,
  languageRegion
}: {
  supabase: SupabaseClient | null,
  authUserId: string | null,
  userName: string,
  username: string,
  accountEmail: string,
  totalReclaimed: number,
  phonePickups: number,
  streak: number,
  totalSessions: number,
  blockedCount: number,
  friendsBackendReady: boolean,
  onInvite: () => void,
  onShowToast: (message: string) => void,
  languageRegion: string
}) => {
  const baseName = userName || accountEmail.split('@')[0] || 'You';
  const savedHours = Number((totalReclaimed / 3600).toFixed(1));
  const distractionEvents = phonePickups + blockedCount;
  const [friendQuery, setFriendQuery] = useState('');
  const [friendNotice, setFriendNotice] = useState<string | null>(null);
  const [friendNoticeTone, setFriendNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [friends, setFriends] = useState<FriendSnapshot[]>([]);
  const normalizedUsername = sanitizeUsername(username);
  const isGuestMode = !authUserId;

  const selfSnapshot = useMemo<FriendSnapshot>(() => ({
    id: authUserId || 'you',
    name: baseName,
    handle: `@${normalizedUsername || 'you'}`,
    hoursSaved: savedHours,
    distractionEvents,
    streak,
    status: 'You are trending down this week',
    trend: `${Math.max(1, Math.round(totalSessions / 2))} focus blocks completed · ${blockedCount} distractions blocked`,
    highlight: `Saved ${savedHours.toFixed(1)} hours so far`
  }), [authUserId, baseName, blockedCount, distractionEvents, normalizedUsername, savedHours, streak, totalSessions]);

  const mapSocialProfileToFriend = useCallback((profile: SocialProfileRow): FriendSnapshot => ({
    id: profile.user_id,
    name: profile.display_name || profile.username,
    handle: `@${profile.username}`,
    hoursSaved: Number(profile.public_hours_saved ?? 0),
    distractionEvents: Number(profile.public_screen_time_hours ?? 0),
    streak: Number(profile.public_streak ?? 0),
    status: Number(profile.public_screen_time_hours ?? 0) <= 5 ? 'Holding a low-distraction rhythm' : 'Still working through frequent pickups',
    trend: `${Number(profile.public_sessions ?? 0)} focus sessions logged`,
    highlight: `Saved ${Number(profile.public_hours_saved ?? 0).toFixed(1)} hours`
  }), []);

  const loadFriends = useCallback(async () => {
    if (!supabase || !authUserId || !friendsBackendReady) {
      setFriends([]);
      return;
    }

    setIsLoadingFriends(true);
    const { data: linkRows, error: linkError } = await supabase
      .from('friend_links')
      .select('friend_user_id')
      .eq('user_id', authUserId);

    if (linkError) {
      setFriendNoticeTone('warning');
      setFriendNotice('Friends setup is almost ready. Run the latest Supabase social SQL to enable real username connections.');
      setIsLoadingFriends(false);
      return;
    }

    const friendIds = (linkRows as FriendLinkRow[] | null)?.map((row) => row.friend_user_id).filter(Boolean) ?? [];
    if (!friendIds.length) {
      setFriends([]);
      setIsLoadingFriends(false);
      return;
    }

    const { data: friendProfiles, error: profilesError } = await supabase
      .from('social_profiles')
      .select('user_id, username, display_name, avatar_url, public_hours_saved, public_screen_time_hours, public_streak, public_sessions')
      .in('user_id', friendIds);

    if (profilesError) {
      setFriendNoticeTone('warning');
      setFriendNotice('Friends could not load yet. Make sure the social tables are enabled in Supabase.');
      setIsLoadingFriends(false);
      return;
    }

    const connectedFriends = ((friendProfiles as SocialProfileRow[] | null) ?? []).map(mapSocialProfileToFriend);
    setFriends(connectedFriends);
    setIsLoadingFriends(false);
  }, [authUserId, friendsBackendReady, mapSocialProfileToFriend, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFriends();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFriends]);

  const handleAddFriend = async () => {
    const nextUsername = sanitizeUsername(friendQuery);
    if (!nextUsername) {
      setFriendNoticeTone('warning');
      setFriendNotice('Enter your friend’s username to connect.');
      return;
    }
    if (!supabase || !authUserId || !friendsBackendReady) {
      setFriendNoticeTone('warning');
      setFriendNotice('Friends setup needs the latest Supabase social SQL before username adds can go live.');
      return;
    }
    if (nextUsername === normalizedUsername) {
      setFriendNoticeTone('warning');
      setFriendNotice('You already own that username.');
      return;
    }

    setIsAddingFriend(true);
    setFriendNoticeTone('info');
    setFriendNotice(`Looking for @${nextUsername}...`);
    const { data: profile, error } = await supabase
      .from('social_profiles')
      .select('user_id, username, display_name, avatar_url, public_hours_saved, public_screen_time_hours, public_streak, public_sessions')
      .eq('username', nextUsername)
      .maybeSingle();

    if (error) {
      setFriendNoticeTone('warning');
      setFriendNotice('We could not look up that username yet. Make sure the social tables are enabled in Supabase.');
      setIsAddingFriend(false);
      return;
    }

    const friendProfile = profile as SocialProfileRow | null;
    if (!friendProfile) {
      setFriendNoticeTone('warning');
      setFriendNotice(`No VELLIN account was found for @${nextUsername}.`);
      setIsAddingFriend(false);
      return;
    }

    const { error: linkError } = await supabase
      .from('friend_links')
      .upsert([
        { user_id: authUserId, friend_user_id: friendProfile.user_id },
        { user_id: friendProfile.user_id, friend_user_id: authUserId },
      ], { onConflict: 'user_id,friend_user_id' });

    setIsAddingFriend(false);

    if (linkError) {
      setFriendNoticeTone('warning');
      setFriendNotice('We found the username, but couldn’t save the connection yet.');
      return;
    }

    setFriendQuery('');
    setFriendNoticeTone('success');
    setFriendNotice(`@${friendProfile.username} is now in your circle.`);
    onShowToast(`Added @${friendProfile.username} to Friends.`);
    await loadFriends();
  };

  const leaderboard = [selfSnapshot, ...friends.filter((friend) => friend.id !== selfSnapshot.id)].sort((a, b) => b.hoursSaved - a.hoursSaved);
  const podium = [leaderboard[1], leaderboard[0], leaderboard[2]].filter(Boolean) as FriendSnapshot[];
  const currentUserRank = Math.max(1, leaderboard.findIndex((friend) => friend.id === selfSnapshot.id) + 1);
  const friendCode = `VELLIN-${(accountEmail.split('@')[0] || 'FOCUS').replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'FOCUS'}`;

  if (isGuestMode) {
    return (
      <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
        <div className="friends-header">
          <div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '6px' }}>{getUiString(languageRegion, 'friendsTitle')}</h1>
            <div className="review-sub">Account-based social features live here once you sign up.</div>
          </div>
        </div>
        <div className="glass-card friends-hero" style={{ marginBottom: '16px' }}>
          <div>
            <div className="section-title">Create an account to unlock Friends</div>
            <div className="friends-hero-title">Leaderboards, usernames, and shared accountability need cloud sync.</div>
            <div className="friends-hero-copy">You can keep using focus sessions in guest mode, then create an account later when you want sync and social features.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '20px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Tip: finish setup in guest mode for now, then create an account later when you are ready to sync across devices.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
      <div className="friends-header">
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.04em', marginBottom: '6px' }}>{getUiString(languageRegion, 'friendsTitle')}</h1>
          <div className="review-sub">{getUiString(languageRegion, 'friendsSubtitle')}</div>
        </div>
        <button className="btn-primary pro-plan-btn" onClick={onInvite}><UserIcon size={16} /> {getUiString(languageRegion, 'invite')}</button>
      </div>

      <div className="glass-card friends-hero">
        <div>
          <div className="section-title">Your Circle</div>
          <div className="friends-hero-title">Compare hours saved, distraction events, and focus streaks in one place.</div>
          <div className="friends-hero-copy">Use your username to connect friends instantly, then compare your progress in a tighter leaderboard.</div>
        </div>
        <div className="friends-code-card">
          <div className="friends-code-label">Your Username</div>
          <div className="friends-code-value">@{normalizedUsername || 'setup'}</div>
          <div className="friends-code-meta">Friend code: {friendCode}</div>
        </div>
      </div>

      <div className="glass-card friends-add-card">
        <div className="section-row" style={{ marginBottom: '14px' }}>
          <div>
            <div className="section-title">Add A Friend</div>
            <div className="review-sub">Search by username and connect them to your circle.</div>
          </div>
          {!friendsBackendReady && <span className="pro-pill">SETUP</span>}
        </div>
        <div className="friends-add-row">
          <input
            className="auth-input friends-input"
            placeholder={getUiString(languageRegion, 'addFriendPlaceholder')}
            value={friendQuery}
            onChange={(event) => setFriendQuery(event.target.value)}
            maxLength={20}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAddFriend();
              }
            }}
          />
          <button className="btn-primary friends-add-button" onClick={() => void handleAddFriend()} disabled={isAddingFriend}>
            {isAddingFriend ? 'Adding...' : getUiString(languageRegion, 'addFriend')}
          </button>
        </div>
        <div className="friends-code-meta" style={{ marginTop: '10px' }}>
          Share your username `@{normalizedUsername || 'setup'}` with friends so they can add you.
        </div>
        {friendNotice && <div className={`auth-notice auth-notice-${friendNoticeTone}`} style={{ marginTop: '12px' }}>{friendNotice}</div>}
      </div>

      <div className="glass-card friends-podium">
        <div className="section-row" style={{ marginBottom: '14px' }}>
          <div>
            <div className="section-title">Weekly Leaderboard</div>
            <div className="review-sub">{getUiString(languageRegion, 'rankedByHours')}</div>
          </div>
          <span className="pro-pill">You're #{currentUserRank}</span>
        </div>
        <div className="friends-podium-grid">
          {podium.map((friend, index) => {
            const place = friend.id === leaderboard[0]?.id ? 1 : friend.id === leaderboard[1]?.id ? 2 : 3;
            return (
              <div key={`${friend.id || friend.handle || 'podium'}-${index}`} className={`friends-podium-card place-${place} ${friend.id === selfSnapshot.id ? 'you' : ''}`}>
                <div className="friends-podium-place">#{place}</div>
                <div className="friends-podium-name">{friend.name}</div>
                <div className="friends-podium-handle">{friend.handle}</div>
                <div className="friends-podium-hours">{friend.hoursSaved.toFixed(1)}h</div>
                <div className="friends-podium-meta">{friend.streak} day streak</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="friends-summary-grid">
        <div className="glass-card friends-summary-card">
          <div className="review-label">Hours Saved</div>
          <div className="review-value">{savedHours.toFixed(1)}h</div>
          <div className="review-meta">Your reclaimed focus time</div>
        </div>
        <div className="glass-card friends-summary-card">
          <div className="review-label">Current Streak</div>
          <div className="review-value">{streak}d</div>
          <div className="review-meta">Consistency wins</div>
        </div>
        <div className="glass-card friends-summary-card">
          <div className="review-label">Distraction Events</div>
          <div className="review-value">{distractionEvents}</div>
          <div className="review-meta">Pickups and blocked taps logged</div>
        </div>
      </div>

      <div className="glass-card friends-leaderboard">
        <div className="section-row">
          <div className="section-title">{getUiString(languageRegion, 'leaderboard')}</div>
          <span className="pro-pill">{Math.max(0, leaderboard.length - 1)} friends</span>
        </div>
        <div className="friends-leaderboard-scroll">
          <div className="friends-list">
            {leaderboard.map((friend, index) => (
              <div key={`${friend.id || friend.handle || 'leaderboard'}-${index}`} className={`friends-card ${friend.id === selfSnapshot.id ? 'you' : ''}`}>
                <div className="friends-rank">{index + 1}</div>
                <div className="friends-main">
                  <div className="friends-name-row">
                    <div className="friends-name">{friend.name}</div>
                    <div className="friends-handle">{friend.handle}</div>
                  </div>
                  <div className="friends-status">{friend.status}</div>
                  <div className="friends-metrics">
                    <span>{friend.hoursSaved.toFixed(1)}h saved</span>
                    <span>{friend.distractionEvents} distraction events</span>
                    <span>{friend.streak} day streak</span>
                  </div>
                </div>
                <div className="friends-side">
                  <div className="friends-highlight">{friend.highlight}</div>
                  <div className="friends-trend">{friend.trend}</div>
                </div>
              </div>
            ))}
            {!friends.length && !isLoadingFriends && (
              <div className="friends-empty-state">No connected friends yet. Add someone by username to start the leaderboard.</div>
            )}
            {isLoadingFriends && <div className="friends-empty-state">Loading your circle...</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ProPlanModal = ({ isOpen, onClose, targetMins, setTargetMins, plan, onApply }: { isOpen: boolean, onClose: () => void, targetMins: number, setTargetMins: (v: number) => void, plan: ProPlan | null, onApply: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="cmd-modal-overlay" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} className="glass-card pro-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div className="section-title">Personalized Focus Plan</div>
            <div className="review-sub">Generated from your tracked VELLIN activity</div>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="range-row">
          <div className="range-label">Goal Target (Daily Distraction Limit)</div>
          <input className="range-input" type="range" min={30} max={240} step={15} value={targetMins} onChange={(e) => setTargetMins(Number(e.target.value))} />
          <div className="range-value">{Math.floor(targetMins / 60)}h {targetMins % 60}m</div>
        </div>
        <div className="auth-helper" style={{ marginTop: '-4px' }}>
          Your roadmap updates automatically from your tracked VELLIN activity and the target you choose here.
        </div>

        {plan && (
          <div className="pro-plan-results">
            <div className="section-title">AI Road Map</div>
            <div className="pro-plan-summary">{plan.summary}</div>
            <div className="section-title" style={{ marginTop: '12px' }}>Deep Research</div>
            <div className="pro-plan-list">
              {plan.insights.map((insight: string, idx: number) => (
                <div key={idx} className="pro-plan-item">{insight}</div>
              ))}
            </div>
            <div className="pro-plan-list">
              {plan.recommendations.map((rec: string, idx: number) => (
                <div key={idx} className="pro-plan-item">{rec}</div>
              ))}
            </div>
            <div className="section-title" style={{ marginTop: '12px' }}>Prevention Rituals</div>
            <div className="pro-plan-list">
              {plan.rituals.map((ritual: string, idx: number) => (
                <div key={idx} className="pro-plan-item">{ritual}</div>
              ))}
            </div>
            <div className="section-title" style={{ marginTop: '12px' }}>Personalized Focus Blocks</div>
            <div className="plan-list">
             {plan.sessions.map((s: Session, index: number) => (
                <div key={`${s.id || s.name || 'plan-session'}-${index}`} className="plan-item">
                  <div>
                    <div className="plan-title">{s.name}</div>
                    <div className="plan-meta">{s.minutes} min {'\u00B7'} {s.difficulty}</div>
                  </div>
                  <div className={`plan-badge ${s.difficulty === 'High' ? 'badge-deep' : 'badge-normal'}`}>{s.difficulty}</div>
                </div>
              ))}
            </div>
            <button className="btn-primary focus-cta" onClick={onApply}>Apply Roadmap</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
// --- Simplified App component logic ---
export default function App() {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const initialRecoveryMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URL(window.location.href).searchParams.get('reset_password') === '1';
  }, []);
  const restoredOnboardingState = useMemo(
    () => resolveRestoredOnboardingState(persistedState, initialRecoveryMode),
    [initialRecoveryMode, persistedState],
  );
  const supabase = useMemo<SupabaseClient | null>(() => createSupabaseBrowserClient(), []);

  const [activeTab, setActiveTab] = useState(persistedState.activeTab ?? 'home');
  const [isFocusing, setIsFocusing] = useState(false);
  const [showBlockScreen, setShowBlockScreen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(restoredOnboardingState.onboardingStep);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(restoredOnboardingState.hasCompletedOnboarding);
  const [isRetakingSetup, setIsRetakingSetup] = useState(false);
  const [usageAccessStandalone, setUsageAccessStandalone] = useState(false);
  const [showProOffer, setShowProOffer] = useState(false);
  const [isPro, setIsPro] = useState(persistedState.isPro ?? false);
  const [blockedAppName, setBlockedAppName] = useState<string | null>(null);

  const [showCmd, setShowCmd] = useState(false);
  
  const [userData, setUserData] = useState<UserData>(persistedState.userData ?? DEFAULT_USER_DATA);
  const [focusScore, setFocusScore] = useState(persistedState.focusScore ?? 89);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notificationPermissionState, setNotificationPermissionState] = useState<NotificationPermissionState>('unsupported');
  const [notificationScheduleDay, setNotificationScheduleDay] = useState(createTodayISO());
  const dailyNudgeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduledNudgeDayRef = useRef<string | null>(null);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(initialRecoveryMode ? 'Set a new password below to finish your recovery flow.' : null);
  const [authNoticeTone, setAuthNoticeTone] = useState<'info' | 'success' | 'warning'>('info');
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [showPasswordRecoveryForm, setShowPasswordRecoveryForm] = useState(initialRecoveryMode);
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [socialUsername, setSocialUsername] = useState('');
  const [friendsBackendReady, setFriendsBackendReady] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousSoundEnabledRef = useRef(persistedState.soundEnabled ?? false);
  const [totalSessions, setTotalSessions] = useState(persistedState.totalSessions ?? 0);
  const [totalReclaimed, setTotalReclaimed] = useState(persistedState.totalReclaimed ?? 0); 
  const [todayReclaimed, setTodayReclaimed] = useState(persistedState.todayReclaimed ?? 0);
  const [lastReclaimedDate, setLastReclaimedDate] = useState<string | null>(persistedState.lastReclaimedDate ?? null);
  const [streak, setStreak] = useState(persistedState.streak ?? 0);
  const [maxStreak, setMaxStreak] = useState(persistedState.maxStreak ?? 0);
  const [lastFocusDate, setLastFocusDate] = useState<string | null>(persistedState.lastFocusDate ?? null);

  // Refs for tracking focus logic safely across renders
  const lastFocusDateRef = useRef<string | null>(persistedState.lastFocusDate ?? null);
  const lastGoalDateRef = useRef<string | null>(persistedState.lastGoalDate ?? null);
  const lastReclaimedDateRef = useRef<string | null>(persistedState.lastReclaimedDate ?? null);
  const streakRef = useRef(persistedState.streak ?? 0);
  const focusSecondsRef = useRef(0);
  const lastBreakReminderAtRef = useRef<number | null>(null);

  // Sync refs with state
  useEffect(() => { lastFocusDateRef.current = lastFocusDate; }, [lastFocusDate]);
  useEffect(() => { lastReclaimedDateRef.current = lastReclaimedDate; }, [lastReclaimedDate]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { focusSecondsRef.current = focusSeconds; }, [focusSeconds]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const permission = await readNotificationPermission();
      if (!cancelled) {
        setNotificationPermissionState(permission);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [sessions, setSessions] = useState<Session[]>(persistedState.sessions ?? DEFAULT_SESSIONS);
  const [tasks, setTasks] = useState<Task[]>(persistedState.tasks ?? createDefaultTasks());
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(persistedState.completedTaskIds ?? []);
  const [taskCompletions, setTaskCompletions] = useState(persistedState.taskCompletions ?? 0);
  const [dailyGoalSeconds, setDailyGoalSeconds] = useState(persistedState.dailyGoalSeconds ?? 2 * 60 * 60);
  const [deviceUsageAccessStatus, setDeviceUsageAccessStatus] = useState<DeviceUsageAccessStatus>(persistedState.deviceUsageAccessStatus ?? 'unknown');
  const [notificationsEnabled, setNotificationsEnabled] = useState(persistedState.notificationsEnabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(persistedState.soundEnabled ?? false);
  const [breakReminderMins, setBreakReminderMins] = useState(persistedState.breakReminderMins ?? 25);
  const [dailyGoalHits, setDailyGoalHits] = useState(persistedState.dailyGoalHits ?? 0);
  const [lastGoalDate, setLastGoalDate] = useState<string | null>(persistedState.lastGoalDate ?? null);
  useEffect(() => { lastGoalDateRef.current = lastGoalDate; }, [lastGoalDate]);
  const [blockedCount, setBlockedCount] = useState(persistedState.blockedCount ?? 0);
  const [blockedByApp, setBlockedByApp] = useState<Record<string, number>>(persistedState.blockedByApp ?? {});
  const [isFocusBlockerEnabled, setIsFocusBlockerEnabled] = useState(() => !canUseNativeDeviceUsage());
  const [showBlockerSetupPrompt, setShowBlockerSetupPrompt] = useState(false);
  const [weeklyBlockedUsageByApp, setWeeklyBlockedUsageByApp] = useState<Record<string, number>>({});
  const [phonePickups, setPhonePickups] = useState(persistedState.phonePickups ?? 0);
  const [focusByDate, setFocusByDate] = useState<Record<string, number>>(persistedState.focusByDate ?? {});
  const [scheduleBlocks] = useState<ScheduleBlock[]>(persistedState.scheduleBlocks ?? DEFAULT_SCHEDULE_BLOCKS);
  const [triggeredTaskStarts, setTriggeredTaskStarts] = useState<Record<string, string>>({});
  const [activeAutoTaskId, setActiveAutoTaskId] = useState<string | null>(null);
  const [showProPlan, setShowProPlan] = useState(false);
  const [proPlanTargetMins, setProPlanTargetMins] = useState(90);
  useEffect(() => {
    if (!canUseNativeDeviceUsage()) return;
    let cancelled = false;
    void (async () => {
      const nativeStatus = await readDeviceUsageStatus();
      if (!cancelled && nativeStatus === 'granted') {
        setDeviceUsageAccessStatus('granted');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [proPlan, setProPlan] = useState<ProPlan | null>(persistedState.proPlan ?? null);
  const [localizedProPrice, setLocalizedProPrice] = useState('$6.99');
  const [localizedProPriceNote, setLocalizedProPriceNote] = useState('Localized for the United States');
  const [detectedPricingRegion, setDetectedPricingRegion] = useState(() => persistedState.detectedPricingRegion || detectUserCountryCode());
  const [proPricingRegion, setProPricingRegion] = useState<PricingRegionPreference>((persistedState.proPricingRegion as PricingRegionPreference) ?? 'auto');
  const [hasUsedIntroTrial, setHasUsedIntroTrial] = useState(Boolean(persistedState.hasUsedIntroTrial));
  const [introTrialStartedAt, setIntroTrialStartedAt] = useState<string | null>(persistedState.introTrialStartedAt ?? null);
  const [membershipAutoRenew, setMembershipAutoRenew] = useState(persistedState.membershipAutoRenew ?? true);
  const [trialNow, setTrialNow] = useState(() => Date.now());
  const [installedApps, setInstalledApps] = useState<InstalledAppEntry[]>([]);
  const [isLoadingInstalledApps, setIsLoadingInstalledApps] = useState(() => canUseNativeDeviceUsage());
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const previousUsageStatusRef = useRef<DeviceUsageAccessStatus>(persistedState.deviceUsageAccessStatus ?? 'unknown');
  const resolvedPricingRegion = proPricingRegion === 'auto' ? detectedPricingRegion : proPricingRegion;
  const regionalCopy = useMemo(() => getRegionalUiCopy(resolvedPricingRegion), [resolvedPricingRegion]);

  useEffect(() => {
    const priceTimer = window.setTimeout(() => {
      const pricing = getLocalizedProPricingForPreference('auto', detectedPricingRegion);
      setLocalizedProPrice(formatLocalizedPrice(pricing));
      setLocalizedProPriceNote(`Billing region locked to ${pricing.countryLabel}`);
    }, 0);
    return () => window.clearTimeout(priceTimer);
  }, [detectedPricingRegion]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTrialNow(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!canUseNativeDeviceUsage()) return;
    let cancelled = false;
    void (async () => {
      const apps = await getInstalledApps();
      if (!cancelled) {
        setInstalledApps(apps);
        setIsLoadingInstalledApps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const blockedPackageEntries = useMemo(() => installedApps.filter((app) => (
    userData.distractions.some((selectedApp) => normalizeAppLabel(selectedApp) === normalizeAppLabel(app.label))
  )), [installedApps, userData.distractions]);
  const blockedPackageNames = useMemo(() => blockedPackageEntries.map((app) => app.packageName), [blockedPackageEntries]);
  const labelForBlockedPackage = useCallback((packageName: string) => (
    blockedPackageEntries.find((app) => app.packageName === packageName)?.label
    || installedApps.find((app) => app.packageName === packageName)?.label
    || packageName
  ), [blockedPackageEntries, installedApps]);
  const refreshFocusBlockerStatus = useCallback(async () => {
    if (!canUseNativeDeviceUsage() || !Capacitor.isNativePlatform()) return false;
    const enabled = await readFocusBlockerStatus();
    setIsFocusBlockerEnabled(enabled);
    if (enabled) {
      setShowBlockerSetupPrompt(false);
    }
    return enabled;
  }, []);
  const consumeNativeBlockedEvent = useCallback(async () => {
    if (!canUseNativeDeviceUsage() || !Capacitor.isNativePlatform()) return;
    const event = await consumeLastBlockedApp();
    if (!event.packageName) return;

    const blockedLabel = labelForBlockedPackage(event.packageName);
    setBlockedAppName(blockedLabel);
    setShowBlockScreen(true);
    setBlockedCount((prev) => prev + 1);
    setPhonePickups((prev) => prev + 1);
    setBlockedByApp((prev) => ({ ...prev, [blockedLabel]: (prev[blockedLabel] || 0) + 1 }));
  }, [labelForBlockedPackage]);
  useEffect(() => {
    if (!canUseNativeDeviceUsage() || !Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void (async () => {
      const enabled = await readFocusBlockerStatus();
      if (!cancelled) {
        setIsFocusBlockerEnabled(enabled);
        if (enabled) {
          setShowBlockerSetupPrompt(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!canUseNativeDeviceUsage() || !Capacitor.isNativePlatform()) return;
    void syncFocusBlockConfig({
      active: (isFocusing || Boolean(activeAutoTaskId)) && blockedPackageNames.length > 0,
      blockedPackages: blockedPackageNames,
    }).then((enabled) => {
      setIsFocusBlockerEnabled(enabled);
      if (enabled) {
        setShowBlockerSetupPrompt(false);
      }
    });
  }, [activeAutoTaskId, blockedPackageNames, isFocusing]);
  useEffect(() => {
    if (!canUseNativeDeviceUsage() || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const refreshNativeState = async () => {
      const nativeStatus = await readDeviceUsageStatus();
      if (!cancelled && nativeStatus === 'granted') {
        setDeviceUsageAccessStatus('granted');
      }
      if (!cancelled) {
        await refreshFocusBlockerStatus();
        await consumeNativeBlockedEvent();
      }
    };

    void CapacitorApp.addListener('appStateChange', (event) => {
      if (event.isActive) {
        void refreshNativeState();
      }
    }).then((handle) => {
      listenerHandle = handle;
    });

    void refreshNativeState();

    return () => {
      cancelled = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [consumeNativeBlockedEvent, refreshFocusBlockerStatus]);
  const scrollVisibleSurfaceToTop = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (typeof document !== 'undefined') {
      document.querySelectorAll<HTMLElement>('.onboarding-step-shell, .auth-screen, .pro-offer-step-shell, .all-apps-list').forEach((node) => {
        node.scrollTo({ top: 0, behavior: 'auto' });
      });
    }
  }, []);
  useEffect(() => {
    scrollVisibleSurfaceToTop();
  }, [activeTab, onboardingStep, showProOffer, showProPlan, scrollVisibleSurfaceToTop]);
  const profileAvatarUrl = useMemo(() => getAuthAvatarUrl(authUser), [authUser]);
  const profileAvatarInitials = useMemo(() => getAvatarInitials(userData.name, authUser?.email ?? ''), [authUser?.email, userData.name]);
  const fallbackSocialUsername = useMemo(() => (
    authUser
      ? buildDefaultUsername(userData.name, authUser.email ?? '', authUser.id)
      : buildGuestUsername(userData.name)
  ), [authUser, userData.name]);
  const resolvedSocialUsername = socialUsername || fallbackSocialUsername;
  const trialEndsAt = useMemo(() => {
    if (!introTrialStartedAt) return null;
    const started = new Date(introTrialStartedAt);
    if (Number.isNaN(started.getTime())) return null;
    return new Date(started.getTime() + PRO_MONTHLY_PLAN.trialDays * 24 * 60 * 60 * 1000);
  }, [introTrialStartedAt]);
  const isIntroTrialActive = useMemo(() => {
    if (!trialEndsAt || !isPro) return false;
    return trialEndsAt.getTime() > trialNow;
  }, [isPro, trialEndsAt, trialNow]);
  const trialDaysLeft = useMemo(() => {
    if (!trialEndsAt) return 0;
    return Math.max(0, Math.ceil((trialEndsAt.getTime() - trialNow) / (24 * 60 * 60 * 1000)));
  }, [trialEndsAt, trialNow]);
  const hasProAccess = Boolean(authUser && isPro);

  // Gamification Logic
  const XP_PER_MINUTE = 1;
  const XP_PER_SESSION = 10;
  const XP_PER_TASK = 5;
  const XP_PER_GOAL_DAY = 25;

  const totalXP = Math.floor(totalReclaimed / 60) * XP_PER_MINUTE
    + totalSessions * XP_PER_SESSION
    + taskCompletions * XP_PER_TASK
    + dailyGoalHits * XP_PER_GOAL_DAY;

  const xpForLevel = (level: number) => 120 + (level - 1) * 80;
  let currentLevel = 1;
  let xpRemainder = totalXP;
  while (xpRemainder >= xpForLevel(currentLevel)) {
    xpRemainder -= xpForLevel(currentLevel);
    currentLevel += 1;
  }
  const xpToNextLevel = xpForLevel(currentLevel);
  const currentXPProgress = xpRemainder;

  const achievementValues = useMemo<Record<AchievementMetric, number>>(() => ({
    focus_seconds: totalReclaimed,
    streak_days: streak,
    sessions: totalSessions,
    tasks: taskCompletions,
    goal_days: dailyGoalHits
  }), [totalReclaimed, streak, totalSessions, taskCompletions, dailyGoalHits]);

  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(persistedState.unlockedAchievements ?? []);
  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [recentUnlocks, setRecentUnlocks] = useState<Achievement[]>([]);
  const [showRecap, setShowRecap] = useState(false);

  useEffect(() => {
    const newlyUnlocked = ACHIEVEMENTS.filter(ach => {
      const current = achievementValues[ach.metric];
      return current >= ach.target && !unlockedAchievements.includes(ach.id);
    });
    if (!newlyUnlocked.length) return;
    const unlockTimer = window.setTimeout(() => {
      setUnlockedAchievements(prev => [...prev, ...newlyUnlocked.map(a => a.id)]);
      if (newlyUnlocked.length === 1) {
        setCelebratingAchievement(newlyUnlocked[0]);
      } else {
        setRecentUnlocks(newlyUnlocked);
        setShowRecap(true);
      }
    }, 0);
    return () => window.clearTimeout(unlockTimer);
  }, [achievementValues, unlockedAchievements]);

  const [isDarkMode, setIsDarkMode] = useState(persistedState.isDarkMode ?? true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
    }
  }, [isDarkMode]);

  const hasHydratedRemoteStateRef = useRef(false);
  const isApplyingRemoteStateRef = useRef(false);
  const remoteSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedProfileRef = useRef(false);
  const isApplyingProfileRef = useRef(false);
  const remoteProfileSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialSyncDisabledRef = useRef(false);

  const buildPersistedPayload = useCallback((): PersistedState => ({
    activeTab,
    blockedByApp,
    blockedCount,
    breakReminderMins,
    completedTaskIds,
    dailyGoalHits,
    dailyGoalSeconds,
    deviceUsageAccessStatus,
    focusByDate,
    userData,
    focusScore,
    hasCompletedOnboarding,
    onboardingStep,
    onboardingVersion: ONBOARDING_FLOW_VERSION,
    isDarkMode,
    isPro,
    lastFocusDate,
    lastGoalDate,
    lastReclaimedDate,
    maxStreak,
    notificationsEnabled,
    phonePickups,
    proPlan,
    proPricingRegion,
    detectedPricingRegion,
    hasUsedIntroTrial,
    introTrialStartedAt,
    membershipAutoRenew,
    scheduleBlocks,
    sessions,
    soundEnabled,
    streak,
    taskCompletions,
    tasks,
    todayReclaimed,
    totalSessions,
    totalReclaimed,
    unlockedAchievements
  }), [activeTab, blockedByApp, blockedCount, breakReminderMins, completedTaskIds, dailyGoalHits, dailyGoalSeconds, deviceUsageAccessStatus, focusByDate, userData, focusScore, hasCompletedOnboarding, onboardingStep, isDarkMode, isPro, lastFocusDate, lastGoalDate, lastReclaimedDate, maxStreak, notificationsEnabled, phonePickups, proPlan, proPricingRegion, detectedPricingRegion, hasUsedIntroTrial, introTrialStartedAt, membershipAutoRenew, scheduleBlocks, sessions, soundEnabled, streak, taskCompletions, tasks, todayReclaimed, totalSessions, totalReclaimed, unlockedAchievements]);

  const buildProfilePayload = useCallback((userId: string): SupabaseProfileRow => ({
    user_id: userId,
    display_name: sanitizePlainText(userData.name, 60),
    is_pro: isPro,
    daily_goal_seconds: dailyGoalSeconds,
    notifications_enabled: notificationsEnabled,
    sound_enabled: soundEnabled,
    break_reminder_mins: breakReminderMins,
    is_dark_mode: isDarkMode,
    distraction_apps: userData.distractions.map((app) => sanitizePlainText(app, 32)).filter(Boolean),
  }), [breakReminderMins, dailyGoalSeconds, isDarkMode, isPro, notificationsEnabled, soundEnabled, userData.distractions, userData.name]);

  const buildSocialProfilePayload = useCallback((userId: string): SocialProfileRow => ({
    user_id: userId,
    username: resolvedSocialUsername || buildDefaultUsername(userData.name, authUser?.email ?? '', userId),
    display_name: sanitizePlainText(userData.name || getAuthDisplayName(authUser) || (authUser?.email?.split('@')[0] ?? 'VELLIN User'), 60),
    avatar_url: profileAvatarUrl,
    public_hours_saved: Number((totalReclaimed / 3600).toFixed(1)),
    // Reuse the existing numeric column for tracked distraction events until the social schema expands.
    public_screen_time_hours: Number(phonePickups + blockedCount),
    public_streak: streak,
    public_sessions: totalSessions,
  }), [authUser, blockedCount, phonePickups, profileAvatarUrl, resolvedSocialUsername, streak, totalReclaimed, totalSessions, userData.name]);

  const applyProfileRow = useCallback((profile: Partial<SupabaseProfileRow>) => {
    isApplyingProfileRef.current = true;

    if (typeof profile.display_name === 'string') {
      const displayName = sanitizePlainText(profile.display_name, 60);
      setUserData(prev => ({ ...prev, name: displayName }));
    }
    if (typeof profile.is_pro === 'boolean') {
      setIsPro(profile.is_pro);
    }
    if (typeof profile.daily_goal_seconds === 'number') {
      setDailyGoalSeconds(profile.daily_goal_seconds);
    }
    if (typeof profile.notifications_enabled === 'boolean') {
      setNotificationsEnabled(profile.notifications_enabled);
    }
    if (typeof profile.sound_enabled === 'boolean') {
      setSoundEnabled(profile.sound_enabled);
    }
    if (typeof profile.break_reminder_mins === 'number') {
      setBreakReminderMins(profile.break_reminder_mins);
    }
    if (typeof profile.is_dark_mode === 'boolean') {
      setIsDarkMode(profile.is_dark_mode);
    }
    if (Array.isArray(profile.distraction_apps)) {
      const distractionApps = profile.distraction_apps
        .filter((app): app is string => typeof app === 'string')
        .map((app) => sanitizePlainText(app, 32))
        .filter(Boolean);
      setUserData(prev => ({ ...prev, distractions: distractionApps }));
    }

    window.setTimeout(() => {
      isApplyingProfileRef.current = false;
    }, 0);
  }, []);

  const applyPersistedState = useCallback((saved: Partial<PersistedState>) => {
    const normalized = normalizePersistedState(saved);
    const restoredOnboarding = resolveRestoredOnboardingState(normalized);
    isApplyingRemoteStateRef.current = true;

    setActiveTab(normalized.activeTab ?? 'home');
    setBlockedByApp(normalized.blockedByApp ?? {});
    setBlockedCount(normalized.blockedCount ?? 0);
    setBreakReminderMins(normalized.breakReminderMins ?? 25);
    setCompletedTaskIds(normalized.completedTaskIds ?? []);
    setDailyGoalHits(normalized.dailyGoalHits ?? 0);
    setDailyGoalSeconds(normalized.dailyGoalSeconds ?? 2 * 60 * 60);
    setDeviceUsageAccessStatus(normalized.deviceUsageAccessStatus ?? 'unknown');
    setFocusByDate(normalized.focusByDate ?? {});
    setFocusScore(normalized.focusScore ?? 89);
    setHasCompletedOnboarding(restoredOnboarding.hasCompletedOnboarding);
    setOnboardingStep(restoredOnboarding.onboardingStep);
    setIsDarkMode(normalized.isDarkMode ?? true);
    setIsPro(normalized.isPro ?? false);
    setLastFocusDate(normalized.lastFocusDate ?? null);
    setLastGoalDate(normalized.lastGoalDate ?? null);
    setLastReclaimedDate(normalized.lastReclaimedDate ?? null);
    setMaxStreak(normalized.maxStreak ?? 0);
    setNotificationsEnabled(normalized.notificationsEnabled ?? true);
    setPhonePickups(normalized.phonePickups ?? 0);
    setProPlan(normalized.proPlan ?? null);
    setProPricingRegion((normalized.proPricingRegion as PricingRegionPreference) ?? 'auto');
    setDetectedPricingRegion(normalized.detectedPricingRegion ?? detectUserCountryCode());
    setHasUsedIntroTrial(normalized.hasUsedIntroTrial ?? false);
    setIntroTrialStartedAt(normalized.introTrialStartedAt ?? null);
    setMembershipAutoRenew(normalized.membershipAutoRenew ?? true);
    setSessions(normalized.sessions ?? DEFAULT_SESSIONS);
    setSoundEnabled(normalized.soundEnabled ?? false);
    setStreak(normalized.streak ?? 0);
    setTaskCompletions(normalized.taskCompletions ?? 0);
    setTasks(normalized.tasks ?? createDefaultTasks());
    setTodayReclaimed(normalized.todayReclaimed ?? 0);
    setTotalReclaimed(normalized.totalReclaimed ?? 0);
    setTotalSessions(normalized.totalSessions ?? 0);
    setUnlockedAchievements(normalized.unlockedAchievements ?? []);
    setUserData(normalized.userData ?? DEFAULT_USER_DATA);

    lastFocusDateRef.current = normalized.lastFocusDate ?? null;
    lastGoalDateRef.current = normalized.lastGoalDate ?? null;
    lastReclaimedDateRef.current = normalized.lastReclaimedDate ?? null;
    streakRef.current = normalized.streak ?? 0;

    window.setTimeout(() => {
      isApplyingRemoteStateRef.current = false;
    }, 0);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ENABLE_LOCAL_PERSISTENCE) {
      try {
        localStorage.removeItem('vellin-state');
      } catch {
        // Ignore storage cleanup failures in testing mode.
      }
      return;
    }
    try {
      localStorage.setItem('vellin-state', JSON.stringify(buildPersistedPayload()));
    } catch {
      // Ignore storage write failures.
    }
  }, [buildPersistedPayload]);

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playUISound = useCallback((kind: 'primary' | 'secondary' | 'toggle') => {
    if (!soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.connect(ctx.destination);

    const shapeTone = (frequency: number, start: number, duration: number, gainPeak: number, type: OscillatorType) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    if (kind === 'primary') {
      shapeTone(540, now, 0.12, 0.05, 'triangle');
      shapeTone(760, now + 0.055, 0.14, 0.04, 'sine');
    } else if (kind === 'toggle') {
      shapeTone(420, now, 0.08, 0.04, 'square');
      shapeTone(640, now + 0.04, 0.1, 0.03, 'triangle');
    } else {
      shapeTone(360, now, 0.08, 0.03, 'sine');
      shapeTone(500, now + 0.035, 0.08, 0.025, 'triangle');
    }

    master.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  }, [getAudioContext, soundEnabled]);

  const triggerHaptic = useCallback((kind: 'primary' | 'secondary' | 'toggle') => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(kind === 'primary' ? 16 : kind === 'toggle' ? 10 : 7);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!soundEnabled && (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function')) return;

    const clickHandler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const interactive = target.closest('button, .nav-item, .cmd-item, .task-check, .task-edit-btn, .task-remove, .interactive, .toggle-switch');
      if (!(interactive instanceof HTMLElement)) return;
      if (interactive instanceof HTMLButtonElement && interactive.disabled) return;

      const kind = interactive.classList.contains('toggle-switch')
        ? 'toggle'
        : interactive.classList.contains('btn-primary') || interactive.classList.contains('focus-cta')
          ? 'primary'
          : 'secondary';

      if (soundEnabled) {
        playUISound(kind);
      }
      triggerHaptic(kind);
    };

    document.addEventListener('click', clickHandler, true);
    return () => document.removeEventListener('click', clickHandler, true);
  }, [playUISound, soundEnabled, triggerHaptic]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (soundEnabled && !previousSoundEnabledRef.current) {
      playUISound('toggle');
    }
    previousSoundEnabledRef.current = soundEnabled;
  }, [playUISound, soundEnabled]);

  useEffect(() => {
    if (!supabase || !authUser) {
      hasHydratedRemoteStateRef.current = false;
      hasHydratedProfileRef.current = false;
      return;
    }

    let isCancelled = false;

    const loadRemoteState = async () => {
      const { data, error } = await supabase
        .from('user_app_state')
        .select('state')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (isCancelled) return;

      if (error) {
        hasHydratedRemoteStateRef.current = true;
        return;
      }

      if (data?.state && typeof data.state === 'object') {
        applyPersistedState(data.state as Partial<PersistedState>);
      }
      hasHydratedRemoteStateRef.current = true;
    };

    void loadRemoteState();

    return () => {
      isCancelled = true;
    };
  }, [applyPersistedState, authUser, supabase]);

  useEffect(() => {
    if (!supabase || !authUser) return;

    let isCancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, is_pro, daily_goal_seconds, notifications_enabled, sound_enabled, break_reminder_mins, is_dark_mode, distraction_apps')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (isCancelled) return;

      if (data) {
        applyProfileRow(data as Partial<SupabaseProfileRow>);
      } else {
        void supabase.from('profiles').upsert(buildProfilePayload(authUser.id), { onConflict: 'user_id' });
      }

      hasHydratedProfileRef.current = true;
    };

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [applyProfileRow, authUser, buildProfilePayload, supabase]);

  useEffect(() => {
    if (!supabase || !authUser || !hasHydratedRemoteStateRef.current || isApplyingRemoteStateRef.current) return;

    if (remoteSaveTimeoutRef.current) {
      clearTimeout(remoteSaveTimeoutRef.current);
    }

    remoteSaveTimeoutRef.current = setTimeout(() => {
      void supabase
        .from('user_app_state')
        .upsert({
          user_id: authUser.id,
          state: buildPersistedPayload(),
        }, { onConflict: 'user_id' });
    }, 600);

    return () => {
      if (remoteSaveTimeoutRef.current) {
        clearTimeout(remoteSaveTimeoutRef.current);
      }
    };
  }, [authUser, buildPersistedPayload, supabase]);

  useEffect(() => {
    if (!supabase || !authUser || !hasHydratedProfileRef.current || isApplyingProfileRef.current) return;

    if (remoteProfileSaveTimeoutRef.current) {
      clearTimeout(remoteProfileSaveTimeoutRef.current);
    }

    remoteProfileSaveTimeoutRef.current = setTimeout(() => {
      void supabase
        .from('profiles')
        .upsert(buildProfilePayload(authUser.id), { onConflict: 'user_id' });
    }, 400);

    return () => {
      if (remoteProfileSaveTimeoutRef.current) {
        clearTimeout(remoteProfileSaveTimeoutRef.current);
      }
    };
  }, [authUser, buildProfilePayload, supabase]);

  useEffect(() => {
    if (!supabase || !authUser || socialSyncDisabledRef.current) return;

    let isCancelled = false;

    const syncSocialProfile = async () => {
      const { data, error } = await supabase
        .from('social_profiles')
        .select('user_id, username')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (isCancelled) return;

      if (error) {
        const message = `${error.message ?? ''}`.toLowerCase();
        if (message.includes('social_profiles') || message.includes('friend_links') || message.includes('does not exist') || message.includes('schema cache')) {
          socialSyncDisabledRef.current = true;
          setFriendsBackendReady(false);
        }
        return;
      }

      const resolvedUsername = typeof data?.username === 'string' && data.username
        ? sanitizeUsername(data.username)
        : resolvedSocialUsername;

      if (resolvedUsername && resolvedUsername !== socialUsername) {
        setSocialUsername(resolvedUsername);
      }

      const { error: upsertError } = await supabase
        .from('social_profiles')
        .upsert({
          ...buildSocialProfilePayload(authUser.id),
          username: resolvedUsername || resolvedSocialUsername,
        }, { onConflict: 'user_id' });

      if (isCancelled) return;

      if (upsertError) {
        const message = `${upsertError.message ?? ''}`.toLowerCase();
        if (message.includes('social_profiles') || message.includes('does not exist') || message.includes('schema cache')) {
          socialSyncDisabledRef.current = true;
          setFriendsBackendReady(false);
          return;
        }
      }

      setFriendsBackendReady(true);
    };

    void syncSocialProfile();

    return () => {
      isCancelled = true;
    };
  }, [authUser, buildSocialProfilePayload, resolvedSocialUsername, socialUsername, supabase]);

  const updateStreak = useCallback(() => {
    const today = new Date().toDateString();
    if (lastFocusDateRef.current === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    let newStreak = 1;
    if (lastFocusDateRef.current === yesterday.toDateString()) {
      newStreak = streakRef.current + 1;
    }

    setStreak(newStreak);
    setMaxStreak(prev => Math.max(prev, newStreak));
    setLastFocusDate(today);
  }, []);

  const recordGoalHitIfNeeded = useCallback((nextTodayReclaimed: number, today: string) => {
    if (nextTodayReclaimed < dailyGoalSeconds || lastGoalDateRef.current === today) return;
    setDailyGoalHits(prev => prev + 1);
    setLastGoalDate(today);
    lastGoalDateRef.current = today;
  }, [dailyGoalSeconds]);

  const addTodayReclaimed = useCallback((seconds: number) => {
    const today = new Date().toDateString();
    setTodayReclaimed(prev => {
      const next = lastReclaimedDateRef.current === today ? prev + seconds : seconds;
      recordGoalHitIfNeeded(next, today);
      return next;
    });
    setLastReclaimedDate(today);
    lastReclaimedDateRef.current = today;
    setFocusByDate(prev => ({
      ...prev,
      [today]: (prev[today] || 0) + seconds
    }));
  }, [recordGoalHitIfNeeded]);

  const finalizeFocusSession = useCallback(() => {
    const currentSeconds = focusSecondsRef.current;
    let outcome: 'idle' | 'abandoned' | 'completed' = 'idle';
    if (currentSeconds > 0) {
      if (currentSeconds < 15) {
        setFocusScore(prev => Math.max(0, prev - 10));
        outcome = 'abandoned';
      } else {
        setTotalSessions(prev => prev + 1);
        setTotalReclaimed(prev => prev + currentSeconds);
        addTodayReclaimed(currentSeconds);
        updateStreak();
        outcome = 'completed';
      }
    }
    setFocusSeconds(0);
    focusSecondsRef.current = 0;
    lastBreakReminderAtRef.current = null;
    return { currentSeconds, outcome };
  }, [addTodayReclaimed, updateStreak]);

  // Show Toast Helper
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3000);
  }, []);

  const notificationPermissionLabel = notificationPermissionState === 'granted'
    ? 'allowed'
    : notificationPermissionState === 'denied'
      ? 'blocked'
      : notificationPermissionState === 'default'
        ? 'permission needed'
        : 'not available in this browser';

  const clearDailyNudgeTimers = useCallback(() => {
    dailyNudgeTimeoutsRef.current.forEach(clearTimeout);
    dailyNudgeTimeoutsRef.current = [];
  }, []);

  const dispatchDailyNudge = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    const notification = new Notification(title, {
      body,
      tag: `vellin-daily-${title}`,
      icon: './vellin-mark.svg'
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  const requestNotificationAccess = useCallback(async () => {
    const nextPermission = await requestNotificationPermission();
    setNotificationPermissionState(nextPermission);

    if (nextPermission === 'unsupported') {
      showToast('Notifications are not available in this browser. Native mobile permissions are the next step.');
      return false;
    }

    if (nextPermission === 'granted') {
      return true;
    }

    if (nextPermission === 'denied') {
      showToast('Notifications are blocked. Turn them on in your browser or device settings.');
    } else {
      showToast('Notification permission was dismissed. We will ask again when you turn them on.');
    }
    return false;
  }, [showToast]);

  const handleNotificationsToggle = useCallback(async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      clearDailyNudgeTimers();
      scheduledNudgeDayRef.current = null;
      showToast('Notifications turned off.');
      return;
    }

    const granted = await requestNotificationAccess();
    if (!granted) {
      setNotificationsEnabled(false);
      return;
    }

    setNotificationsEnabled(true);
    showToast('Notifications enabled. VELLIN will send three daily nudges plus focus reminders.');
  }, [clearDailyNudgeTimers, notificationsEnabled, requestNotificationAccess, showToast]);

  const handleSaveUsername = useCallback(async (nextUsernameRaw: string) => {
    const nextUsername = sanitizeUsername(nextUsernameRaw);
    if (!nextUsername) {
      return { ok: false, message: 'Enter a username using letters, numbers, or underscores.' };
    }
    if (nextUsername.length < 3) {
      return { ok: false, message: 'Username must be at least 3 characters.' };
    }
    if (!supabase || !authUser || !friendsBackendReady) {
      return { ok: false, message: 'Username editing will work once the social profile tables are fully available.' };
    }

    const { data: existing, error: existingError } = await supabase
      .from('social_profiles')
      .select('user_id, username')
      .eq('username', nextUsername)
      .maybeSingle();

    if (existingError) {
      return { ok: false, message: 'We could not verify that username right now.' };
    }

    if (existing && existing.user_id !== authUser.id) {
      return { ok: false, message: `@${nextUsername} is already taken. Try a small variation.` };
    }

    const { error } = await supabase
      .from('social_profiles')
      .upsert({
        ...buildSocialProfilePayload(authUser.id),
        username: nextUsername,
      }, { onConflict: 'user_id' });

    if (error) {
      return { ok: false, message: 'We could not save that username yet. Please try again.' };
    }

    setSocialUsername(nextUsername);
    showToast(`Username updated to @${nextUsername}.`);
    return { ok: true, message: `Your username is now @${nextUsername}. Friends can use that to add you.`, username: nextUsername };
  }, [authUser, buildSocialProfilePayload, friendsBackendReady, showToast, supabase]);

  const syncAuthUser = useCallback((user: SupabaseUser | null) => {
    setAuthUser(user);
    if (!user) return;
    const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '';
    const derivedName = sanitizePlainText(metadataName || user.email?.split('@')[0] || '', 60);
    if (!derivedName) return;
    setUserData(prev => ({ ...prev, name: derivedName }));
  }, []);

  const refreshAuthUserFromClient = useCallback(async () => {
    if (!supabase) return null;
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    syncAuthUser(user ?? null);
    return user ?? null;
  }, [supabase, syncAuthUser]);

  const completeOnboardingFlow = useCallback(() => {
    setHasCompletedOnboarding(true);
    setIsRetakingSetup(false);
    setUsageAccessStandalone(false);
    setOnboardingStep('completed');
  }, []);

  const resetToAuthSetup = useCallback(() => {
    setShowCmd(false);
    setShowProPlan(false);
    setShowProOffer(false);
    setShowBlockScreen(false);
    setBlockedAppName(null);
    setShowRecap(false);
    setRecentUnlocks([]);
    setCelebratingAchievement(null);
    setActiveTab('home');
    setIsFocusing(false);
    setFocusSeconds(0);
    focusSecondsRef.current = 0;
    lastBreakReminderAtRef.current = null;
    setHasCompletedOnboarding(false);
    setIsRetakingSetup(false);
    setUsageAccessStandalone(false);
    setOnboardingStep('auth');
    setAuthNotice(null);
    setAuthNoticeTone('info');
    setPendingConfirmationEmail(null);
    setShowPasswordRecoveryForm(false);
    setIsPasswordResetting(false);
    setSocialUsername('');
    setUserData({ ...DEFAULT_USER_DATA });
    setFocusScore(89);
    setSessions([...DEFAULT_SESSIONS]);
    setTasks(createDefaultTasks());
    setCompletedTaskIds([]);
    setTaskCompletions(0);
    setDailyGoalSeconds(2 * 60 * 60);
    setDeviceUsageAccessStatus('unknown');
    setNotificationsEnabled(true);
    setSoundEnabled(false);
    setBreakReminderMins(25);
    setDailyGoalHits(0);
    setLastGoalDate(null);
    setBlockedCount(0);
    setBlockedByApp({});
    setWeeklyBlockedUsageByApp({});
    setPhonePickups(0);
    setFocusByDate({});
    setTriggeredTaskStarts({});
    setActiveAutoTaskId(null);
    setProPlan(null);
    setIsPro(false);
    setHasUsedIntroTrial(false);
    setIntroTrialStartedAt(null);
    setMembershipAutoRenew(true);
    setTotalSessions(0);
    setTotalReclaimed(0);
    setTodayReclaimed(0);
    setLastReclaimedDate(null);
    setStreak(0);
    setMaxStreak(0);
    setLastFocusDate(null);
    setUnlockedAchievements([]);
    lastFocusDateRef.current = null;
    lastGoalDateRef.current = null;
    lastReclaimedDateRef.current = null;
    streakRef.current = 0;
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('vellin-state');
      } catch {
        // Ignore local storage cleanup failures.
      }
    }
  }, []);

  const nextOnboarding = useCallback(() => {
    const shouldAskForUsageAccess = canUseNativeDeviceUsage() && deviceUsageAccessStatus === 'unknown';
    const usageAccessStep: OnboardingStep[] = shouldAskForUsageAccess ? ['usageAccess'] : [];
    const steps: OnboardingStep[] = isRetakingSetup
      ? ['survey', 'recommendation', 'appSelection', ...usageAccessStep, 'realityCheck', 'completed']
      : isPro
        ? ['welcome', 'survey', 'recommendation', 'auth', 'appSelection', ...usageAccessStep, 'realityCheck', 'completed']
        : ['welcome', 'survey', 'recommendation', 'auth', 'appSelection', ...usageAccessStep, 'realityCheck', 'proPlan', 'completed'];
    const currentIndex = steps.indexOf(onboardingStep);
    const nextStep = currentIndex >= 0 ? steps[currentIndex + 1] : steps[0];
    if (!nextStep || nextStep === 'completed') {
      completeOnboardingFlow();
      return;
    }
    setOnboardingStep(nextStep);
  }, [completeOnboardingFlow, deviceUsageAccessStatus, isPro, isRetakingSetup, onboardingStep]);
  useEffect(() => {
    const previousStatus = previousUsageStatusRef.current;
    if (
      previousStatus !== 'granted'
      && deviceUsageAccessStatus === 'granted'
      && onboardingStep === 'usageAccess'
      && !usageAccessStandalone
    ) {
      window.setTimeout(() => {
        nextOnboarding();
      }, 0);
    }
    previousUsageStatusRef.current = deviceUsageAccessStatus;
  }, [deviceUsageAccessStatus, nextOnboarding, onboardingStep, usageAccessStandalone]);

  const getNativeDeleteRequestHeaders = useCallback(async () => {
    if (!supabase) {
      throw new Error('Account actions are not available right now.');
    }

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error('Log in again before deleting this account.');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }, [supabase]);

  const handleCreateAccount = useCallback(async ({ name, email, password }: { name: string, email: string, password: string }) => {
    const safeName = sanitizePlainText(name, 60);
    const safeEmail = normalizeEmail(email);
    setAuthNotice(null);
    setAuthNoticeTone('info');
    setPendingConfirmationEmail(null);
    if (!supabase) {
      showToast('Supabase is not connected. Restart the app after checking your env setup.');
      return;
    }
    if (!safeName) {
      showToast('Enter your name to create an account.');
      return;
    }
    if (!safeEmail || !password) {
      showToast('Enter your name, email, and password to create an account.');
      return;
    }
    if (!isValidEmail(safeEmail)) {
      showToast('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (containsControlChars(password)) {
      showToast('Password cannot contain hidden control characters.');
      return;
    }
    setAuthLoading(true);
    let needsEmailConfirmation = false;
    let payloadError: string | null = null;

    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signUp({
        email: safeEmail,
        password,
        options: {
          emailRedirectTo: MOBILE_AUTH_REDIRECT_URL,
          data: {
            name: safeName,
          },
        },
      });

      payloadError = error?.message ?? null;
      needsEmailConfirmation = !data.session && !data.user?.email_confirmed_at;
    } else {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: safeName,
          email: safeEmail,
          password,
          isNative: false,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        user?: { email?: string };
        needsEmailConfirmation?: boolean;
        name?: string;
      } | null;

      if (!response.ok) {
        payloadError = payload?.error || 'We could not create your account right now.';
      } else {
        needsEmailConfirmation = Boolean(payload?.needsEmailConfirmation);
      }
    }

    setAuthLoading(false);

    if (payloadError) {
      const message = payloadError.toLowerCase();
      if (message.includes('rate limit')) {
        const notice = `We already sent a confirmation email to ${safeEmail}. Check your Gmail inbox, spam, and promotions tabs, then tap the confirmation link before logging in.`;
        setAuthNotice(notice);
        setAuthNoticeTone('warning');
        setPendingConfirmationEmail(safeEmail);
        showToast('Check your Gmail to confirm your email before logging in.');
        return;
      }
      showToast(payloadError);
      return;
    }

    const nextUser = await refreshAuthUserFromClient();
    if (!nextUser?.email) {
      if (needsEmailConfirmation) {
        setAuthNotice(`We sent a confirmation link to ${safeEmail}. Tap it from Gmail and VELLIN will return through the callback page so you can land back in the app cleanly.`);
        setAuthNoticeTone('success');
        setPendingConfirmationEmail(safeEmail);
        showToast('Confirmation email sent. Check your Gmail before logging in.');
        setUserData(prev => ({ ...prev, name: safeName }));
        return;
      }
      showToast('Account creation did not complete. Please try again.');
      return;
    }
    if (needsEmailConfirmation) {
      setAuthNotice(`We sent a confirmation link to ${safeEmail}. Tap it from Gmail and VELLIN will return through the callback page so you can land back in the app cleanly.`);
      setAuthNoticeTone('success');
      setPendingConfirmationEmail(safeEmail);
      showToast('Confirmation email sent. Check your Gmail before logging in.');
      setUserData(prev => ({ ...prev, name: safeName }));
      return;
    }
    setUserData(prev => ({ ...prev, name: safeName }));
    nextOnboarding();
      setAuthNotice('Account created. Check your inbox if email confirmation is enabled.');
      setAuthNoticeTone('success');
  }, [nextOnboarding, refreshAuthUserFromClient, showToast, supabase]);

  const handleLogin = useCallback(async ({ email, password }: { email: string, password: string }) => {
    const safeEmail = normalizeEmail(email);
    setAuthNotice(null);
    setAuthNoticeTone('info');
    setPendingConfirmationEmail(null);
    if (!supabase) {
      showToast('Supabase is not connected. Restart the app after checking your env setup.');
      return;
    }
    if (!safeEmail || !password) {
      showToast('Enter your email and password to log in.');
      return;
    }
    if (!isValidEmail(safeEmail)) {
      showToast('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (containsControlChars(password)) {
      showToast('Password cannot contain hidden control characters.');
      return;
    }
    setAuthLoading(true);
    let payloadError: string | null = null;

    if (Capacitor.isNativePlatform()) {
      const { error } = await supabase.auth.signInWithPassword({
        email: safeEmail,
        password,
      });
      payloadError = error?.message ?? null;
    } else {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: safeEmail,
          password,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        payloadError = payload?.error || 'We could not sign you in right now.';
      }
    }

    setAuthLoading(false);

    if (payloadError) {
      const message = `${payloadError}`.toLowerCase();
      if (message.includes('email not confirmed')) {
        const notice = `This email still needs to be confirmed. Open Gmail for ${safeEmail}, look for the VELLIN confirmation email, and tap the link before trying to log in again.`;
        setAuthNotice(notice);
        setAuthNoticeTone('warning');
        setPendingConfirmationEmail(safeEmail);
        showToast('Please confirm your email in Gmail before logging in.');
        return;
      }
      showToast(payloadError);
      return;
    }
    const nextUser = await refreshAuthUserFromClient();
    if (!nextUser?.email) {
      showToast('Login did not complete. Please try again.');
      return;
    }
    const userEmail = nextUser.email;
    setPendingConfirmationEmail(null);
    const authName = getAuthDisplayName(nextUser);
    setUserData(prev => ({ ...prev, name: authName || prev.name || userEmail.split('@')[0] || '' }));
    completeOnboardingFlow();
    setActiveTab('home');
    }, [completeOnboardingFlow, refreshAuthUserFromClient, showToast, supabase]);

  const handleForgotPassword = useCallback(async (email: string) => {
    const safeEmail = normalizeEmail(email);
    setAuthNotice(null);
    setAuthNoticeTone('info');
    if (!supabase) {
      showToast('Password reset is not available right now.');
      return;
    }
    if (!safeEmail || !isValidEmail(safeEmail)) {
      showToast('Enter the email on your account first.');
      return;
    }

    setAuthLoading(true);
    let payloadMessage = 'If that email exists, we sent a password reset link.';
    let payloadError: string | null = null;

    if (Capacitor.isNativePlatform()) {
      const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
        redirectTo: NATIVE_PASSWORD_RESET_REDIRECT_URL,
      });
      payloadError = error?.message ?? null;
    } else {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: safeEmail,
          isNative: false,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      if (!response.ok) {
        payloadError = payload?.error || 'We could not send a reset link right now.';
      } else {
        payloadMessage = payload?.message || payloadMessage;
      }
    }

    setAuthLoading(false);

    if (payloadError) {
      showToast(payloadError);
      return;
    }

    setPendingConfirmationEmail(safeEmail);
    setAuthNotice(`We sent a secure password reset link to ${safeEmail}. Open it from your email, and VELLIN will bring you back to set a new password.`);
    setAuthNoticeTone('success');
    showToast(payloadMessage || 'Password reset link sent.');
  }, [showToast, supabase]);

  const handleUpdatePassword = useCallback(async (nextPassword: string) => {
    if (!supabase) {
      showToast('Password reset is not available right now.');
      return;
    }
    if (nextPassword.length < 8) {
      showToast('Use at least 8 characters for your new password.');
      return;
    }
    if (containsControlChars(nextPassword)) {
      showToast('Password cannot contain hidden control characters.');
      return;
    }

    setIsPasswordResetting(true);
    const { error } = await supabase.auth.updateUser({
      password: nextPassword,
    });
    setIsPasswordResetting(false);

    if (error) {
      showToast(error.message);
      return;
    }

    setShowPasswordRecoveryForm(false);
    setPendingConfirmationEmail(null);
    setAuthNotice('Your password has been updated. You can log in with the new one now.');
    setAuthNoticeTone('success');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('reset_password');
      window.history.replaceState({}, '', url.toString());
    }
    showToast('Password updated.');
  }, [showToast, supabase]);

  const handleContinueAsGuest = useCallback(() => {
    setAuthNotice('You can use VELLIN without an account for now. If you want cloud sync or Friends later, create an account from a fresh setup run.');
    setAuthNoticeTone('info');
    setPendingConfirmationEmail(null);
    nextOnboarding();
    }, [nextOnboarding]);

  const openUsageAccessStep = useCallback(() => {
    if (!canUseNativeDeviceUsage()) {
      showToast('Android Usage Access is ready. iPhone Screen Time still needs a Mac/Xcode build step.');
      return;
    }
    setShowCmd(false);
    setShowProPlan(false);
    setShowProOffer(false);
    setShowBlockScreen(false);
    setActiveTab('home');
    setHasCompletedOnboarding(false);
    setIsRetakingSetup(false);
    setUsageAccessStandalone(true);
    setOnboardingStep('usageAccess');
  }, [showToast]);

  const openAuthFromGuest = useCallback(() => {
    resetToAuthSetup();
    setAuthNotice('Create an account or log in to sync your current VELLIN progress.');
    setAuthNoticeTone('info');
  }, [resetToAuthSetup]);

  const openProOffer = useCallback(() => {
    if (!authUser) {
      openAuthFromGuest();
      showToast('Create an account or log in before previewing or buying Pro.');
      return;
    }
    setProPlan(null);
    if (hasProAccess) {
      setShowProPlan(true);
      return;
    }
    setShowProOffer(true);
  }, [authUser, hasProAccess, openAuthFromGuest, showToast]);

  const leaveGuestMode = useCallback(() => {
    resetToAuthSetup();
    setAuthNotice('Create an account or log in to move from guest mode into a saved VELLIN account.');
    setAuthNoticeTone('info');
  }, [resetToAuthSetup]);

  const requestDeviceUsageAccess = useCallback(() => {
    void (async () => {
      let nextStatus: DeviceUsageAccessStatus = 'requested';
      if (canUseNativeDeviceUsage()) {
        const requestedStatus = await requestDeviceUsagePermission();
        nextStatus = requestedStatus === 'granted' ? 'granted' : 'requested';
        setDeviceUsageAccessStatus(nextStatus);
      } else {
        setDeviceUsageAccessStatus('requested');
        nextStatus = 'requested';
      }

      if (usageAccessStandalone) {
        setUsageAccessStandalone(false);
        completeOnboardingFlow();
        setActiveTab('profile');
        showToast(canUseNativeDeviceUsage()
          ? 'Screen time data access saved. Finish Android Usage Access in system settings if it has not been granted yet.'
          : 'Screen time data was noted. iPhone Screen Time still needs the Apple-native Xcode build step.');
        return;
      }

      if (nextStatus === 'granted' || !canUseNativeDeviceUsage()) {
        nextOnboarding();
      }

      showToast(canUseNativeDeviceUsage()
        ? nextStatus === 'granted'
          ? 'Android usage access connected. You can continue now.'
          : 'Android usage access opened. Turn on VELLIN in settings, come back, then tap Continue.'
        : 'Screen time data marked for setup. iPhone Screen Time still needs the Apple-native Xcode build.');
    })();
  }, [completeOnboardingFlow, nextOnboarding, showToast, usageAccessStandalone]);

  const skipDeviceUsageAccess = useCallback(() => {
    setDeviceUsageAccessStatus('skipped');
    if (usageAccessStandalone) {
      setUsageAccessStandalone(false);
      completeOnboardingFlow();
      setActiveTab('profile');
      return;
    }
    nextOnboarding();
  }, [completeOnboardingFlow, nextOnboarding, usageAccessStandalone]);

  const handleSignOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    syncAuthUser(null);
    resetToAuthSetup();
    setAuthNotice('You signed out. Log back in or create an account to keep going.');
    setAuthNoticeTone('info');
  }, [resetToAuthSetup, supabase, syncAuthUser]);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = typeof window === 'undefined'
      ? false
      : window.confirm('Delete your account permanently? This removes your login and account data from Supabase.');
    if (!confirmed) return;

    let response: Response;
    try {
      if (Capacitor.isNativePlatform()) {
        const headers = await getNativeDeleteRequestHeaders();
        response = await fetch(`${NATIVE_ACCOUNT_API_BASE_URL}/api/account/delete`, {
          method: 'DELETE',
          headers,
        });
      } else {
        response = await fetch('/api/account/delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Delete account is not available right now.');
      return;
    }

    const payload = await response.json().catch(() => null) as { error?: string } | null;

    if (!response.ok) {
      showToast(payload?.error || 'Delete account is not fully configured yet.');
      return;
    }

    if (supabase) {
      await supabase.auth.signOut();
    }

    syncAuthUser(null);
    resetToAuthSetup();
  }, [getNativeDeleteRequestHeaders, resetToAuthSetup, showToast, supabase, syncAuthUser]);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    const hydrateAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      syncAuthUser(user ?? null);
    };

    void hydrateAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordRecoveryForm(true);
        setOnboardingStep('auth');
        setHasCompletedOnboarding(false);
        setAuthNotice('Choose a new password to finish your recovery flow.');
        setAuthNoticeTone('info');
      }
      syncAuthUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, syncAuthUser]);

  useEffect(() => {
    if (!supabase || !Capacitor.isNativePlatform()) return;

    const handleIncomingAuthUrl = async (url: string) => {
      try {
        const parsedUrl = new URL(url);
        const code = parsedUrl.searchParams.get('code');
        const nextTarget = parsedUrl.searchParams.get('next') || '';
        if (!code) return;

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          showToast('Verification link opened, but the mobile sign-in did not finish yet.');
          return;
        }

        const nextUser = data.user ?? data.session?.user ?? null;
        if (nextUser) {
          syncAuthUser(nextUser);
          setPendingConfirmationEmail(null);
          if (nextTarget.includes('reset_password=1')) {
            setShowPasswordRecoveryForm(true);
            setOnboardingStep('auth');
            setHasCompletedOnboarding(false);
            setAuthNotice('Set a new password below to finish your recovery flow.');
            setAuthNoticeTone('info');
            showToast('Reset link confirmed. Choose your new password.');
          } else {
            setAuthNotice(null);
            setAuthNoticeTone('info');
            completeOnboardingFlow();
            setActiveTab('home');
            showToast('Email confirmed. You are back in VELLIN.');
          }
        }
      } catch {
        showToast('That verification link could not be read on this device.');
      }
    };

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) {
        void handleIncomingAuthUrl(result.url);
      }
    });

    void CapacitorApp.addListener('appUrlOpen', (event) => {
      if (event.url) {
        void handleIncomingAuthUrl(event.url);
      }
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [completeOnboardingFlow, showToast, supabase, syncAuthUser]);

  const retakeSetupQuestions = () => {
    setShowProOffer(false);
    setShowProPlan(false);
    setShowCmd(false);
    setShowBlockScreen(false);
    setActiveTab('home');
    setIsRetakingSetup(true);
    setHasCompletedOnboarding(false);
    setUsageAccessStandalone(false);
    setOnboardingStep('survey');
  };

  const createPersonalizedProPlan = useCallback((): ProPlan => {
    const sortedApps = Object.entries(blockedByApp).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topApps = sortedApps.map(([app]) => app);
    const target = proPlanTargetMins;
    const focusDays = Object.values(focusByDate);
    const avgDailyFocus = focusDays.length
      ? Math.round(focusDays.reduce((sum, secs) => sum + secs, 0) / focusDays.length / 60)
      : Math.round(totalReclaimed / 60);
    const cravingWindow = phonePickups > 12 ? 'late afternoon and evening' : phonePickups > 4 ? 'midday check-in windows' : 'short idle moments';
    const bestAppsLine = topApps.length ? topApps.join(', ') : 'Instagram, TikTok, and other infinite-scroll apps';
    const recommendations = [
      `Cap ${bestAppsLine} to a combined ${target} minutes on high-risk days.`,
      `Start one protective focus block 25 minutes before your usual ${cravingWindow} craving spike.`,
      `Use stricter blocking after ${phonePickups} logged pickups so the habit loop has more friction.`,
      `Treat ${topApps[0] || 'your top distraction'} as your primary intercept app for the next seven days.`
    ];
    const insights = [
      `Your tracked data points to ${topApps[0] || 'scrolling apps'} as the first place attention slips when focus gets thinner.`,
      `You have reclaimed ${formatPrettyTime(totalReclaimed)} so far, with an average of ${avgDailyFocus} focused minutes on active days.`,
      `The most useful next win is not more intensity. It is earlier protection before your highest-risk window begins.`
    ];
    const rituals = [
      'Use a 60-second breathing reset when the urge feels automatic rather than intentional.',
      'Take a 3-minute walk or water break before reopening any blocked app.',
      'Swap the first craving moment for one micro-task so the day turns back toward momentum.'
    ];
    const sessions: Session[] = [
      { id: 'pro-peak-focus', name: 'Peak Focus Block', minutes: Math.min(90, Math.max(45, Math.round(target * 0.4))), difficulty: 'High' },
      { id: 'pro-cognitive-recovery', name: 'Cognitive Recovery', minutes: 30, difficulty: 'Normal' },
      { id: 'pro-deep-work-sprint', name: 'Deep Work Sprint', minutes: Math.min(60, Math.max(30, Math.round(target * 0.3))), difficulty: 'High' },
      { id: 'pro-evening-intercept', name: 'Evening Craving Intercept', minutes: 20, difficulty: 'Normal' }
    ];

    return {
      summary: `VELLIN reviewed ${phonePickups} pickups, ${blockedCount} blocks, and your recent focus history. Your strongest pressure currently clusters around ${cravingWindow}, so this Pro roadmap shifts protection earlier and aims for a ${Math.floor(target / 60)}h ${target % 60}m distraction budget.`,
      insights,
      recommendations,
      rituals,
      sessions
    };
  }, [blockedByApp, blockedCount, focusByDate, phonePickups, proPlanTargetMins, totalReclaimed]);

  const displayedProPlan = useMemo(() => (hasProAccess ? createPersonalizedProPlan() : proPlan), [createPersonalizedProPlan, hasProAccess, proPlan]);

  const handlePurchasePro = () => {
    if (!authUser) {
      openAuthFromGuest();
      showToast('Create an account or log in before buying Pro.');
      return;
    }
    const generatedPlan = createPersonalizedProPlan();
    setIsPro(true);
    setMembershipAutoRenew(true);
    if (!hasUsedIntroTrial) {
      setHasUsedIntroTrial(true);
      setIntroTrialStartedAt(new Date().toISOString());
    } else {
      setIntroTrialStartedAt(null);
    }
    setProPlan(generatedPlan);
    setSessions(generatedPlan.sessions);
    setShowProOffer(false);
    setShowProPlan(false);
    setActiveTab('forecast');
    showToast(hasUsedIntroTrial ? 'Pro preview unlocked. Your forecast and personalized roadmap are ready.' : `Your ${PRO_MONTHLY_PLAN.trialDays}-day free trial has started. Your forecast and personalized roadmap are ready.`);
  };

  const handleCancelMembershipRenewal = useCallback(() => {
    if (isIntroTrialActive) {
      setMembershipAutoRenew(false);
      setIsPro(false);
      setShowProOffer(false);
      setShowProPlan(false);
      showToast('Your free trial has been canceled and Pro access has ended.');
      return;
    }

    if (!isPro) {
      showToast('There is no active Pro membership to cancel right now.');
      return;
    }

    setMembershipAutoRenew(false);
    showToast('Renewal is now turned off in VELLIN. When billing goes live, this same control will stop future charges while keeping your current paid month active.');
  }, [isIntroTrialActive, isPro, showToast]);

  useEffect(() => {
    if (!isPro || !introTrialStartedAt) return;
    const started = new Date(introTrialStartedAt);
    if (Number.isNaN(started.getTime())) return;
    const expiry = started.getTime() + PRO_MONTHLY_PLAN.trialDays * 24 * 60 * 60 * 1000;
    if (Date.now() >= expiry && isIntroTrialActive === false) {
      const timeout = window.setTimeout(() => {
        setIsPro(false);
        setMembershipAutoRenew(false);
        showToast(`Your ${PRO_MONTHLY_PLAN.trialDays}-day free trial has ended. Billing will be connected later before automatic renewal is enabled.`);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [introTrialStartedAt, isIntroTrialActive, isPro, showToast]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Focus Timer Update logic
  useEffect(() => {
    if (!isFocusing) return;
    const interval = setInterval(() => {
      setFocusSeconds(prev => {
        const next = prev + 1;
        focusSecondsRef.current = next;
        return next;
      });
    }, 1000);
    return () => { if (interval) clearInterval(interval); };
  }, [isFocusing]); 

  // Handle Distraction Time
  const handleAppDistraction = (app: string, opts?: { simulate?: boolean }) => {
    if (app === 'VELLIN') {
      return;
    }
    const isSelectedForBlocking = userData.distractions.includes(app);
    if (opts?.simulate) {
      setTotalReclaimed(prev => prev + 15 * 60);
      addTodayReclaimed(15 * 60);
      showToast("Simulated +15m Reclaimed");
      return;
    }
    if (!isSelectedForBlocking) {
      showToast(`${app} is not on your blocklist.`);
      return;
    }
    if (!isFocusing && !activeAutoTaskId) {
      showToast(`${app} is selected, but blocking only runs during a focus session.`);
      return;
    }
    setFocusScore(prev => Math.max(0, prev - 5));
    if (isFocusing) {
      setBlockedAppName(app);
      setShowBlockScreen(true);
    }
    setBlockedCount(prev => prev + 1);
    setPhonePickups(prev => prev + 1);
    setBlockedByApp(prev => ({ ...prev, [app]: (prev[app] || 0) + 1 }));
    showToast(`Blocked ${app} -5 Focus Score`);
  };

  const openNativeBlockerSettings = useCallback(() => {
    void openFocusBlockerSettings();
  }, []);

  const handleToggleFocus = () => {
    if (!isFocusing) {
      if (
        Capacitor.isNativePlatform()
        && canUseNativeDeviceUsage()
        && userData.distractions.length > 0
        && blockedPackageNames.length > 0
        && !isFocusBlockerEnabled
      ) {
        setShowBlockerSetupPrompt(true);
        return;
      }
      lastBreakReminderAtRef.current = null;
      setIsFocusing(true);
      setShowBlockScreen(false);
      setBlockedAppName(null);
      return;
    }

    const { currentSeconds, outcome } = finalizeFocusSession();
    if (activeAutoTaskId) {
      setActiveAutoTaskId(null);
    }
    setShowBlockScreen(false);
    setBlockedAppName(null);
    setIsFocusing(false);

    if (outcome === 'completed') {
      showToast(`Session Complete! +${currentSeconds}s Reclaimed`);
    } else if (outcome === 'abandoned') {
      showToast("Session Abandoned -10 Focus Score");
    }
  };

  const applyProPlan = () => {
    if (!displayedProPlan) return;
    setProPlan(displayedProPlan);
    setSessions(displayedProPlan.sessions);
    setShowProPlan(false);
    showToast('Personal reduction plan updated.');
  };

  useEffect(() => {
    if (!isFocusing || !notificationsEnabled || breakReminderMins <= 0) return;
    const intervalSec = breakReminderMins * 60;
    let reminderTimer: ReturnType<typeof setTimeout> | null = null;
    if (focusSeconds > 0 && focusSeconds % intervalSec === 0 && focusSeconds !== lastBreakReminderAtRef.current) {
      reminderTimer = setTimeout(() => {
        showToast("Time for a short reset break.");
        void sendImmediateNotification('Break reminder', 'Step away for a minute, reset your eyes, and come back clear.');
      }, 0);
      lastBreakReminderAtRef.current = focusSeconds;
    }
    return () => {
      if (reminderTimer) clearTimeout(reminderTimer);
    };
  }, [focusSeconds, isFocusing, notificationsEnabled, breakReminderMins, showToast]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 5, 0);
    const msUntilNextMidnight = nextMidnight.getTime() - now.getTime();
    const midnightTimer = setTimeout(() => {
      scheduledNudgeDayRef.current = null;
      setNotificationScheduleDay(createTodayISO());
    }, msUntilNextMidnight);

    return () => clearTimeout(midnightTimer);
  }, [notificationScheduleDay]);

  useEffect(() => {
    clearDailyNudgeTimers();

    if (!notificationsEnabled || notificationPermissionState !== 'granted') {
      void cancelDailyNativeNudges();
      scheduledNudgeDayRef.current = null;
      return;
    }

    const todayKey = createTodayISO();
    if (scheduledNudgeDayRef.current === todayKey) {
      return;
    }

    const dayNumber = Number(todayKey.replaceAll('-', ''));
    DAILY_NUDGE_SLOTS.forEach((slot, index) => {
      const scheduledFor = new Date();
      scheduledFor.setHours(slot.hour, slot.minute, 0, 0);
      const delay = scheduledFor.getTime() - Date.now();
      if (delay <= 0) return;

      const message = DAILY_NUDGE_LIBRARY[(dayNumber + index * 2) % DAILY_NUDGE_LIBRARY.length];
      const timeout = setTimeout(() => {
        dispatchDailyNudge(message.title, message.body);
      }, delay);
      dailyNudgeTimeoutsRef.current.push(timeout);
    });

    void scheduleDailyNativeNudges(
      DAILY_NUDGE_SLOTS,
      DAILY_NUDGE_SLOTS.map((_, index) => DAILY_NUDGE_LIBRARY[(dayNumber + index * 2) % DAILY_NUDGE_LIBRARY.length])
    );

    scheduledNudgeDayRef.current = todayKey;

    return () => {
      clearDailyNudgeTimers();
    };
  }, [clearDailyNudgeTimers, dispatchDailyNudge, notificationPermissionState, notificationScheduleDay, notificationsEnabled]);

  useEffect(() => {
    if (deviceUsageAccessStatus !== 'granted') return;
    let cancelled = false;
    void (async () => {
      const result = await getWeeklyUsageForLabels(userData.distractions, installedApps);
      if (!cancelled && result.status === 'granted') {
        setWeeklyBlockedUsageByApp(result.usageByLabel);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceUsageAccessStatus, installedApps, userData.distractions]);

  const visibleWeeklyBlockedUsageByApp = deviceUsageAccessStatus === 'granted'
    ? weeklyBlockedUsageByApp
    : {};

  useEffect(() => {
    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const toLocalDateKey = (isoDate: string) => {
      const [y, m, d] = isoDate.split('-').map(Number);
      return new Date(y, m - 1, d).toDateString();
    };
    const isWeekday = (date: Date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6;
    };
    const resolveRepeat = (task: Task): RepeatType => (isRepeatType(task.repeat) ? task.repeat : 'today');
    const isTaskScheduledToday = (task: Task, date: Date, dateKey: string) => {
      const repeat = resolveRepeat(task);
      if (repeat === 'daily') return true;
      if (repeat === 'weekdays') return isWeekday(date);
      if (repeat === 'today') {
        if (task.dueDate) return toLocalDateKey(task.dueDate) === dateKey;
        return true;
      }
      return true;
    };
    const isTaskCompleteToday = (task: Task, dateKey: string) => {
      const repeat = resolveRepeat(task);
      if (repeat !== 'today') return task.lastCompletedDate === dateKey;
      return !!task.done;
    };
    const interval: ReturnType<typeof setInterval> = setInterval(() => {
      const now = new Date();
      const todayKey = now.toDateString();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      tasks.forEach(t => {
        if (!t.startTime) return;
        if (!isTaskScheduledToday(t, now, todayKey)) return;
        if (isTaskCompleteToday(t, todayKey)) return;
        const startMinutes = timeToMinutes(t.startTime);
        const duration = t.durationMins || 45;
        const endMinutes = startMinutes + duration;
        const taskKey = `${t.id}-${todayKey}`;
        if (!triggeredTaskStarts[taskKey] && nowMinutes >= startMinutes && nowMinutes < endMinutes) {
          setTriggeredTaskStarts(prev => ({ ...prev, [taskKey]: todayKey }));
          setActiveAutoTaskId(t.id);
          if (!isFocusing) {
            lastBreakReminderAtRef.current = null;
            setIsFocusing(true);
          }
          showToast(`Focus block started: ${t.title}`);
        }
        if (triggeredTaskStarts[taskKey] === todayKey && activeAutoTaskId === t.id && nowMinutes >= endMinutes) {
          setTaskCompletions(prevCount => prevCount + 1);
          if (resolveRepeat(t) === 'today') {
            setCompletedTaskIds(prevIds => (prevIds.includes(t.id) ? prevIds : [...prevIds, t.id]));
          }
          setTasks(prev => prev.map(item => {
            if (item.id !== t.id) return item;
            const repeat = resolveRepeat(item);
            if (repeat !== 'today') return { ...item, lastCompletedDate: todayKey };
            return { ...item, done: true };
          }));
          const { outcome } = finalizeFocusSession();
          setActiveAutoTaskId(null);
          if (isFocusing) setIsFocusing(false);
          setShowBlockScreen(false);
          setBlockedAppName(null);
          showToast(outcome === 'completed' ? `Session complete: ${t.title}` : `Task closed: ${t.title}`);
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [tasks, triggeredTaskStarts, isFocusing, activeAutoTaskId, finalizeFocusSession, showToast]);

  useEffect(() => {
    const timer = setInterval(() => {
      const today = new Date().toDateString();
      if (lastReclaimedDate && lastReclaimedDate !== today) {
        setTodayReclaimed(0);
        setLastReclaimedDate(today);
        lastReclaimedDateRef.current = today;
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [lastReclaimedDate]);

  useEffect(() => {
    const today = new Date().toDateString();
    const normalizedTodayReclaimed = lastReclaimedDate === today ? todayReclaimed : 0;
    if (normalizedTodayReclaimed < dailyGoalSeconds || lastGoalDate === today) return;
    const goalTimer = window.setTimeout(() => {
      setDailyGoalHits(prev => prev + 1);
      setLastGoalDate(today);
      lastGoalDateRef.current = today;
    }, 0);
    return () => window.clearTimeout(goalTimer);
  }, [todayReclaimed, dailyGoalSeconds, lastGoalDate, lastReclaimedDate]);

  // Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmd(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!hasCompletedOnboarding) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="ambient-glow" />
        <div className="ambient-glow secondary" />
        <div className="app-container onboarding-container">
          <AnimatePresence mode="wait">
            {onboardingStep === 'welcome' && <WelcomeStep key="welcome" onNext={nextOnboarding} languageRegion={resolvedPricingRegion} />}
            {onboardingStep === 'survey' && <SurveyStep key="survey" onNext={(data) => { setUserData({...userData, survey: data}); nextOnboarding(); }} />}
            {onboardingStep === 'recommendation' && <RecommendationStep key="recommend" surveyData={userData.survey} onNext={nextOnboarding} />}
            {onboardingStep === 'auth' && (
              <AuthStep
                key="auth"
                onCreateAccount={handleCreateAccount}
                onLogin={handleLogin}
                onForgotPassword={handleForgotPassword}
                onUpdatePassword={handleUpdatePassword}
                onContinueAsGuest={handleContinueAsGuest}
                notice={authNotice}
                pendingConfirmationEmail={pendingConfirmationEmail}
                onClearPendingConfirmation={() => {
                  setPendingConfirmationEmail(null);
                  setAuthNotice(null);
                  setAuthNoticeTone('info');
                }}
                noticeTone={authNoticeTone}
                isSubmitting={authLoading}
                authEnabled={Boolean(supabase)}
                showRecoveryForm={showPasswordRecoveryForm}
                isPasswordResetting={isPasswordResetting}
                languageRegion={resolvedPricingRegion}
              />
            )}
            {onboardingStep === 'appSelection' && (
              <AppSelectionStep
                key="apps"
                languageRegion={resolvedPricingRegion}
                installedApps={installedApps}
                isLoadingInstalledApps={isLoadingInstalledApps}
                onNext={(apps) => { setUserData({...userData, distractions: apps}); nextOnboarding(); }}
              />
            )}
            {onboardingStep === 'usageAccess' && (
              <DeviceUsageAccessStep
                key="usage-access"
                status={deviceUsageAccessStatus}
                blockerEnabled={isFocusBlockerEnabled}
                hasDistractionTargets={userData.distractions.length > 0}
                onAllow={requestDeviceUsageAccess}
                onOpenBlockerAccess={openNativeBlockerSettings}
                onContinue={nextOnboarding}
                onSkip={skipDeviceUsageAccess}
                languageRegion={resolvedPricingRegion}
              />
            )}
            {onboardingStep === 'realityCheck' && <RealityCheckStep key="reality" distractions={userData.distractions} deviceUsageAccessStatus={deviceUsageAccessStatus} weeklyBlockedUsageByApp={visibleWeeklyBlockedUsageByApp} onNext={nextOnboarding} />}
            {onboardingStep === 'proPlan' && (
              <ProPlanOfferStep
                key="pro-plan"
                onSkip={completeOnboardingFlow}
                onUpgrade={handlePurchasePro}
                priceLabel={localizedProPrice}
                priceNote={localizedProPriceNote}
                regionalCopy={regionalCopy}
                hasUsedIntroTrial={hasUsedIntroTrial}
                isAuthenticated={Boolean(authUser)}
              />
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  if (showProOffer) {
    return (
      <>
        <div className="noise-overlay" />
        <div className="ambient-glow" />
        <div className="ambient-glow secondary" />
        <div className="app-container pro-offer-container">
          <ProPlanOfferStep
            onSkip={() => setShowProOffer(false)}
            onUpgrade={handlePurchasePro}
            priceLabel={localizedProPrice}
            priceNote={localizedProPriceNote}
            regionalCopy={regionalCopy}
            hasUsedIntroTrial={hasUsedIntroTrial}
            isAuthenticated={Boolean(authUser)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="noise-overlay" />
      <div className="ambient-glow" />
      <div className="ambient-glow secondary" />
      
      <div className="app-container">
        <AnimatePresence>
          {celebratingAchievement && (
            <CelebrationModal achievement={celebratingAchievement} onClose={() => setCelebratingAchievement(null)} />
          )}
          {showRecap && (
            <MilestoneRecapModal achievements={recentUnlocks} onClose={() => { setShowRecap(false); setRecentUnlocks([]); }} />
          )}
          {showBlockScreen && (
            <motion.div key="block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="block-overlay">
               <ShieldCheck size={80} color="var(--accent-danger)" style={{ marginBottom: '24px' }} />
               <h1>Blocked by VELLIN</h1>
               <div className="quote">{blockedAppName ? `${blockedAppName} is on your block list while focus is running.` : '"Discipline is choosing between what you want now and what you want most."'}</div>
               <button className="btn-warning" onClick={handleToggleFocus}>End Focus Session</button>
            </motion.div>
          )}
          {showBlockerSetupPrompt && (
            <motion.div key="blocker-setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="block-overlay blocker-setup-overlay">
              <Shield size={72} color="var(--accent-primary)" style={{ marginBottom: '18px' }} />
              <h1>Turn On Blocker Access</h1>
              <div className="quote">
                Android needs one extra accessibility permission before VELLIN can kick blocked apps like Instagram out during a focus session.
              </div>
              <div className="glass-card blocker-setup-card">
                <div className="blocker-setup-step"><strong>1.</strong> Open Android Accessibility settings.</div>
                <div className="blocker-setup-step"><strong>2.</strong> Find <strong>VELLIN</strong> and switch Blocker Access on.</div>
                <div className="blocker-setup-step"><strong>3.</strong> Come back here and start the focus timer again.</div>
              </div>
              <div className="blocker-setup-actions">
                <button className="btn-primary" onClick={openNativeBlockerSettings}>Open Blocker Access</button>
                <button className="btn-secondary" onClick={() => { setShowBlockerSetupPrompt(false); lastBreakReminderAtRef.current = null; setIsFocusing(true); setShowBlockScreen(false); setBlockedAppName(null); }}>
                  Start Without Blocking
                </button>
              </div>
            </motion.div>
          )}
          {showCmd && (
            <CommandMenu
              key="cmd"
              isOpen={showCmd}
              onClose={() => setShowCmd(false)}
              onStartFocus={() => {
                if (!isFocusing) {
                  handleToggleFocus();
                }
              }}
              onNavigate={(tab) => setActiveTab(tab)}
              regionalCopy={regionalCopy}
            />
          )}
          {showProPlan && (
            <ProPlanModal
              isOpen={showProPlan}
              onClose={() => setShowProPlan(false)}
              targetMins={proPlanTargetMins}
              setTargetMins={setProPlanTargetMins}
              plan={displayedProPlan}
              onApply={applyProPlan}
            />
          )}
        </AnimatePresence>

        <main ref={mainScrollRef} className="app-main-shell" style={{ flex: 1, width: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'home' && (
            <Dashboard 
              userData={userData} 
              focusScore={focusScore} 
              focusSeconds={focusSeconds} 
              isFocusing={isFocusing} 
              onToggleFocus={handleToggleFocus} 
              onTestApp={handleAppDistraction} 
              setShowCmd={setShowCmd} 
              todayReclaimed={todayReclaimed}
              dailyGoalSeconds={dailyGoalSeconds}
              sessions={sessions}
              setSessions={setSessions}
              tasks={tasks}
              setTasks={setTasks}
              completedTaskIds={completedTaskIds}
              setCompletedTaskIds={setCompletedTaskIds}
              setTaskCompletions={setTaskCompletions}
              streak={streak}
              maxStreak={maxStreak}
              onOpenProPlan={openProOffer}
              blockedByApp={blockedByApp}
              phonePickups={phonePickups}
              isPro={hasProAccess}
              proPlan={displayedProPlan}
              localizedProPrice={localizedProPrice}
              hasUsedIntroTrial={hasUsedIntroTrial}
              regionalCopy={regionalCopy}
            />
          )}
          {activeTab === 'review' && (
            <Review
              totalReclaimed={totalReclaimed}
              todayReclaimed={todayReclaimed}
              totalSessions={totalSessions}
              focusScore={focusScore}
              blockedCount={blockedCount}
              blockedByApp={blockedByApp}
              focusByDate={focusByDate}
              dailyGoalHits={dailyGoalHits}
              dailyGoalSeconds={dailyGoalSeconds}
              phonePickups={phonePickups}
              onOpenProPlan={openProOffer}
              isPro={hasProAccess}
              proPlan={displayedProPlan}
              languageRegion={resolvedPricingRegion}
            />
          )}
          {activeTab === 'profile' && (
            <Profile
              totalSessions={totalSessions}
              totalReclaimed={totalReclaimed}
              streak={streak}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              currentLevel={currentLevel}
              totalXP={totalXP}
              currentXPProgress={currentXPProgress}
              xpToNextLevel={xpToNextLevel}
              dailyGoalHits={dailyGoalHits}
              taskCompletions={taskCompletions}
              dailyGoalSeconds={dailyGoalSeconds}
              setDailyGoalSeconds={setDailyGoalSeconds}
              notificationsEnabled={notificationsEnabled}
              onToggleNotifications={() => { void handleNotificationsToggle(); }}
              notificationPermissionLabel={notificationPermissionLabel}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              breakReminderMins={breakReminderMins}
              setBreakReminderMins={setBreakReminderMins}
              distractions={userData.distractions}
              onUpdateDistractions={(next) => setUserData(prev => ({ ...prev, distractions: next }))}
              installedApps={installedApps}
              isPro={hasProAccess}
              onOpenProPlan={openProOffer}
              onRetakeSetup={retakeSetupQuestions}
              onSignOut={() => { void handleSignOut(); }}
              onDeleteAccount={() => { void handleDeleteAccount(); }}
              onOpenAuth={openAuthFromGuest}
              onLeaveGuestMode={leaveGuestMode}
              onOpenUsageAccess={openUsageAccessStep}
              deviceUsageAccessStatus={deviceUsageAccessStatus}
              accountEmail={authUser?.email ?? 'Guest mode · saved on this device'}
              username={resolvedSocialUsername}
              onSaveUsername={handleSaveUsername}
              avatarUrl={profileAvatarUrl}
              avatarInitials={profileAvatarInitials}
              isAuthenticated={Boolean(authUser)}
              proPricingRegion={proPricingRegion}
              onSetProPricingRegion={setProPricingRegion}
              localizedProPrice={localizedProPrice}
              localizedProPriceNote={localizedProPriceNote}
              hasUsedIntroTrial={hasUsedIntroTrial}
              isIntroTrialActive={isIntroTrialActive}
              trialDaysLeft={trialDaysLeft}
              membershipAutoRenew={membershipAutoRenew}
              onCancelMembershipRenewal={handleCancelMembershipRenewal}
              regionalCopy={regionalCopy}
            />
          )}
          {activeTab === 'forecast' && (
            <ForecastPage
              isPro={hasProAccess}
              onUpgrade={openProOffer}
              onStartFocus={() => {
                if (!isFocusing) {
                  handleToggleFocus();
                }
              }}
              onAction={(title) => {
                const message =
                  title === 'Breath ritual' ? 'Breath ritual started. 60 seconds.' :
                  title === 'Short walk' ? 'Short walk reminder set for 3 minutes.' :
                  title === 'Micro-task' ? 'Micro-task queued. Keep it tiny.' :
                  title === 'Hydration reminder' ? 'Hydration reminder set.' :
                  title === 'Start a focus session' ? 'Focus session started.' :
                  'Action queued.';
                showToast(message);
              }}
              blockedByApp={blockedByApp}
              phonePickups={phonePickups}
              focusByDate={focusByDate}
              survey={userData.survey}
              totalReclaimed={totalReclaimed}
              regionalCopy={regionalCopy}
            />
          )}
          {activeTab === 'friends' && (
            <FriendsPage
              supabase={supabase}
              authUserId={authUser?.id ?? null}
              userName={userData.name}
              username={resolvedSocialUsername}
              accountEmail={authUser?.email ?? ''}
              totalReclaimed={totalReclaimed}
              phonePickups={phonePickups}
              streak={streak}
              totalSessions={totalSessions}
              blockedCount={blockedCount}
              friendsBackendReady={friendsBackendReady}
              onInvite={() => showToast(`Share @${resolvedSocialUsername || 'your-username'} with your friends.`)}
              onShowToast={showToast}
              languageRegion={resolvedPricingRegion}
            />
          )}
          {activeTab === 'achievements' && (
    <motion.div initial={false} animate={{ opacity: 1 }} style={{ padding: '24px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.04em' }}>{regionalCopy.milestonesTitle}</h1>

                <div className="glass-card" style={{ padding: '28px', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15))', position: 'relative', overflow: 'hidden' }}>
                   <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.05 }}><Trophy size={140} /></div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>CURRENT LEVEL</div>
                        <div style={{ fontSize: '2rem', fontWeight: 900 }}>LVL {currentLevel}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{currentXPProgress} <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>/ {xpToNextLevel} XP</span></div>
                      </div>
                   </div>
                   <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(currentXPProgress / xpToNextLevel) * 100}%` }} style={{ height: '100%', background: 'linear-gradient(to right, #8B5CF6, #06B6D4)', boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' }} />
                   </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                   <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Collection</h3>
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{unlockedAchievements.length} / {ACHIEVEMENTS.length} COLLECTED</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', paddingBottom: '40px' }}>
                   {ACHIEVEMENTS.map(ach => {
                      const current = achievementValues[ach.metric];
                      const isUnlocked = unlockedAchievements.includes(ach.id) || current >= ach.target;
                      const progress = Math.min(100, (current / ach.target) * 100);
                      
                      return (
                        <div key={ach.id} className={`glass-card achievement-card tier-${ach.tier} ${isUnlocked ? 'unlocked' : ''}`} style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: isUnlocked ? 1 : 0.4, transition: '0.3s', position: 'relative' }}>
                           {!isUnlocked && <div style={{ position: 'absolute', top: '12px', right: '12px' }}><Lock size={12} color="var(--text-tertiary)" /></div>}
                           <div style={{ fontSize: '2.5rem', marginBottom: '12px', filter: isUnlocked ? 'none' : 'grayscale(1)', transform: isUnlocked ? 'scale(1.1)' : 'scale(1)', transition: '0.5s' }}>{ach.icon}</div>
                           <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '4px', color: isUnlocked ? 'var(--text-main)' : 'var(--text-secondary)' }}>{ach.title}</div>
                           <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '12px' }}>{ach.desc}</div>
                           
                           {!isUnlocked && (
                             <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                               <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} style={{ height: '100%', background: 'var(--text-secondary)', opacity: 0.3 }} />
                             </div>
                           )}
                           
                           {isUnlocked && <div style={{ fontSize: '0.65rem', fontWeight: 800, color: ach.color, textTransform: 'uppercase' }}>Unlocked</div>}
                        </div>
                      );
                   })}
                </div>
            </motion.div>
          )}
        </main>

        <nav className="bottom-nav">
          <button className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Home size={22} /></button>
          <button className={`nav-item ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><BarChart3 size={22} /></button>
          <button className={`nav-item ${activeTab === 'forecast' ? 'active' : ''}`} onClick={() => setActiveTab('forecast')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Activity size={22} /></button>
          <button className={`nav-item ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Users size={22} /></button>
          <button className={`nav-item ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trophy size={22} /></button>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><UserIcon size={22} /></button>
        </nav>
      </div>
    </>
  );
}










