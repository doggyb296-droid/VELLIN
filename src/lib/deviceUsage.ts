'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type DeviceUsageStatus = 'unknown' | 'requested' | 'granted' | 'skipped' | 'unsupported';

export interface WeeklyUsageEntry {
  packageName: string;
  totalMs: number;
}

export interface InstalledAppEntry {
  label: string;
  packageName: string;
  iconDataUrl?: string;
}

interface DeviceUsagePlugin {
  getStatus(): Promise<{ status: DeviceUsageStatus }>;
  requestAccess(): Promise<{ status: DeviceUsageStatus }>;
  getWeeklyUsage(options: { packages: string[] }): Promise<{ status: DeviceUsageStatus; usage: WeeklyUsageEntry[] }>;
  getInstalledApps(): Promise<{ apps: InstalledAppEntry[] }>;
  getFocusBlockerStatus(): Promise<{ enabled: boolean }>;
  openFocusBlockerSettings(): Promise<void>;
  setFocusBlockConfig(options: { active: boolean; blockedPackages: string[] }): Promise<{ enabled: boolean }>;
  consumeLastBlockedApp(): Promise<{ packageName: string | null; blockedAt: number | null }>;
}

const DeviceUsage = registerPlugin<DeviceUsagePlugin>('DeviceUsage');

export const DEVICE_USAGE_PACKAGES: Record<string, string[]> = {
  Instagram: ['com.instagram.android'],
  TikTok: ['com.zhiliaoapp.musically'],
  X: ['com.twitter.android'],
  YouTube: ['com.google.android.youtube'],
  Facebook: ['com.facebook.katana'],
  Netflix: ['com.netflix.mediaclient'],
  WhatsApp: ['com.whatsapp'],
  Snapchat: ['com.snapchat.android'],
  Reddit: ['com.reddit.frontpage'],
  Pinterest: ['com.pinterest'],
};

export const canUseNativeDeviceUsage = () => Capacitor.getPlatform() === 'android';

const normalizeAppLabel = (label: string) => label.trim().toLowerCase();

export const readDeviceUsageStatus = async (): Promise<DeviceUsageStatus> => {
  if (!canUseNativeDeviceUsage()) return 'unsupported';
  try {
    const result = await DeviceUsage.getStatus();
    return result.status;
  } catch {
    return 'unsupported';
  }
};

export const requestDeviceUsagePermission = async (): Promise<DeviceUsageStatus> => {
  if (!canUseNativeDeviceUsage()) return 'unsupported';
  try {
    const result = await DeviceUsage.requestAccess();
    return result.status;
  } catch {
    return 'unsupported';
  }
};

export const getInstalledApps = async (): Promise<InstalledAppEntry[]> => {
  if (!canUseNativeDeviceUsage()) return [];

  try {
    const result = await DeviceUsage.getInstalledApps();
    return Array.isArray(result.apps)
      ? result.apps.filter((app) => Boolean(app?.label) && Boolean(app?.packageName))
      : [];
  } catch {
    return [];
  }
};

export const readFocusBlockerStatus = async (): Promise<boolean> => {
  if (!canUseNativeDeviceUsage()) return false;

  try {
    const result = await DeviceUsage.getFocusBlockerStatus();
    return Boolean(result.enabled);
  } catch {
    return false;
  }
};

export const openFocusBlockerSettings = async (): Promise<void> => {
  if (!canUseNativeDeviceUsage()) return;

  try {
    await DeviceUsage.openFocusBlockerSettings();
  } catch {
    // Ignore native settings failures and keep the app responsive.
  }
};

export const syncFocusBlockConfig = async (options: { active: boolean; blockedPackages: string[] }): Promise<boolean> => {
  if (!canUseNativeDeviceUsage()) return false;

  try {
    const result = await DeviceUsage.setFocusBlockConfig(options);
    return Boolean(result.enabled);
  } catch {
    return false;
  }
};

export const consumeLastBlockedApp = async (): Promise<{ packageName: string | null; blockedAt: number | null }> => {
  if (!canUseNativeDeviceUsage()) {
    return { packageName: null, blockedAt: null };
  }

  try {
    const result = await DeviceUsage.consumeLastBlockedApp();
    return {
      packageName: result.packageName ?? null,
      blockedAt: result.blockedAt ?? null,
    };
  } catch {
    return { packageName: null, blockedAt: null };
  }
};

export const getWeeklyUsageForLabels = async (labels: string[], installedApps: InstalledAppEntry[] = []) => {
  if (!canUseNativeDeviceUsage()) {
    return { status: 'unsupported' as DeviceUsageStatus, usageByLabel: {} as Record<string, number> };
  }

  const installedLabelLookup = installedApps.reduce<Record<string, string[]>>((acc, app) => {
    const normalized = normalizeAppLabel(app.label);
    acc[normalized] = acc[normalized] || [];
    if (!acc[normalized].includes(app.packageName)) {
      acc[normalized].push(app.packageName);
    }
    return acc;
  }, {});

  const labelPackagePairs = labels.flatMap((label) => {
    const normalized = normalizeAppLabel(label);
    const dynamicPackages = installedLabelLookup[normalized] || [];
    const staticPackages = DEVICE_USAGE_PACKAGES[label] || [];
    const packages = Array.from(new Set([...dynamicPackages, ...staticPackages]));
    return packages.map((pkg) => ({ label, pkg }));
  });
  const uniquePackages = Array.from(new Set(labelPackagePairs.map((pair) => pair.pkg)));

  try {
    const result = await DeviceUsage.getWeeklyUsage({ packages: uniquePackages });
    const usageByLabel = labels.reduce<Record<string, number>>((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    result.usage.forEach((entry) => {
      labelPackagePairs.forEach((pair) => {
        if (pair.pkg === entry.packageName) {
          usageByLabel[pair.label] = (usageByLabel[pair.label] || 0) + entry.totalMs;
        }
      });
    });

    return { status: result.status, usageByLabel };
  } catch {
    return { status: 'unsupported' as DeviceUsageStatus, usageByLabel: {} as Record<string, number> };
  }
};
