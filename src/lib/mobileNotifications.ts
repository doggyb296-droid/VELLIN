'use client';

import { Capacitor } from '@capacitor/core';
import type { PermissionState } from '@capacitor/core';
import type { ScheduleOptions } from '@capacitor/local-notifications';

export type AppNotificationPermission = NotificationPermission | PermissionState | 'unsupported';

const NUDGE_IDS = [7101, 7102, 7103];
const NUDGE_CHANNEL_ID = 'vellin-daily';
const BREAK_REMINDER_ID = 7201;

const canUseWebNotifications = () =>
  typeof window !== 'undefined' && 'Notification' in window;

const getLocalNotifications = async () => import('@capacitor/local-notifications');

export const isNativeNotificationsAvailable = () => Capacitor.isNativePlatform();

export const readNotificationPermission = async (): Promise<AppNotificationPermission> => {
  if (isNativeNotificationsAvailable()) {
    const { LocalNotifications } = await getLocalNotifications();
    const permissions = await LocalNotifications.checkPermissions();
    return permissions.display;
  }

  if (canUseWebNotifications()) {
    return Notification.permission;
  }

  return 'unsupported';
};

export const requestNotificationPermission = async (): Promise<AppNotificationPermission> => {
  if (isNativeNotificationsAvailable()) {
    const { LocalNotifications } = await getLocalNotifications();
    const permissions = await LocalNotifications.requestPermissions();
    return permissions.display;
  }

  if (canUseWebNotifications()) {
    return Notification.requestPermission();
  }

  return 'unsupported';
};

export const cancelDailyNativeNudges = async () => {
  if (!isNativeNotificationsAvailable()) return;
  const { LocalNotifications } = await getLocalNotifications();
  await LocalNotifications.cancel({
    notifications: NUDGE_IDS.map((id) => ({ id }))
  });
};

export const scheduleDailyNativeNudges = async (
  slots: { hour: number; minute: number }[],
  messages: { title: string; body: string }[],
) => {
  if (!isNativeNotificationsAvailable()) return;

  const { LocalNotifications } = await getLocalNotifications();

  await LocalNotifications.createChannel({
    id: NUDGE_CHANNEL_ID,
    name: 'Daily Motivation',
    description: 'VELLIN motivation and craving-prevention nudges',
    importance: 4,
    visibility: 1
  });

  const scheduleOptions: ScheduleOptions = {
    notifications: slots.map((slot, index) => ({
      id: NUDGE_IDS[index],
      title: messages[index]?.title ?? 'VELLIN nudge',
      body: messages[index]?.body ?? 'Protect your attention today.',
      channelId: NUDGE_CHANNEL_ID,
      schedule: {
        on: {
          hour: slot.hour,
          minute: slot.minute
        },
        repeats: true,
        allowWhileIdle: true
      }
    }))
  };

  await LocalNotifications.cancel({
    notifications: NUDGE_IDS.map((id) => ({ id }))
  });
  await LocalNotifications.schedule(scheduleOptions);
};

export const sendImmediateNotification = async (title: string, body: string) => {
  if (isNativeNotificationsAvailable()) {
    const { LocalNotifications } = await getLocalNotifications();

    await LocalNotifications.createChannel({
      id: NUDGE_CHANNEL_ID,
      name: 'Daily Motivation',
      description: 'VELLIN motivation and craving-prevention nudges',
      importance: 4,
      visibility: 1
    });

    await LocalNotifications.schedule({
      notifications: [
        {
          id: BREAK_REMINDER_ID,
          title,
          body,
          channelId: NUDGE_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }
        }
      ]
    });
    return;
  }

  if (canUseWebNotifications() && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      tag: `vellin-inline-${title}`,
      icon: '/vellin-mark.svg'
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};
