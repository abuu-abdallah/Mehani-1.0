import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import { safeStorage } from '../utils/safeStorage';
import type { NavigationTab } from '../context/AppContext';

export type NotificationCategory = 'urgent' | 'booking' | 'success';

export interface AppNotificationPayload {
  userId: string;
  eventKey: string;
  category: NotificationCategory;
  title: string;
  body: string;
  targetTab?: NavigationTab;
}

const CHANNEL_MAP: Record<NotificationCategory, { id: string; sound: string }> = {
  urgent: { id: 'mehani_urgent_v1', sound: 'mehani_alert.wav' },
  booking: { id: 'mehani_booking_v1', sound: 'mehani_chime.wav' },
  success: { id: 'mehani_success_v1', sound: 'mehani_success.wav' },
};

const NOTIFIED_KEYS_PREFIX = 'mehani_notified_keys_';
const MAX_STORED_KEYS = 150;

let channelsInitialized = false;
let permissionRequested = false;

type InAppToastListener = (payload: AppNotificationPayload) => void;
const toastListeners = new Set<InAppToastListener>();

export function subscribeInAppNotificationToast(listener: InAppToastListener): () => void {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

function hashToInt32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash) % 2147483000;
  return positive > 0 ? positive : 1;
}

function hasAlreadyNotified(userId: string, eventKey: string): boolean {
  const keys = safeStorage.getJSON<string[]>(`${NOTIFIED_KEYS_PREFIX}${userId}`, []);
  return keys.includes(eventKey);
}

function markAsNotified(userId: string, eventKey: string): void {
  const storageKey = `${NOTIFIED_KEYS_PREFIX}${userId}`;
  const keys = safeStorage.getJSON<string[]>(storageKey, []);
  if (keys.includes(eventKey)) return;
  const updated = [...keys.slice(-(MAX_STORED_KEYS - 1)), eventKey];
  safeStorage.setJSON(storageKey, updated);
}

function playWebFallbackChime(category: NotificationCategory): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const notes: Array<{ freq: number; start: number; dur: number }> =
      category === 'urgent'
        ? [
            { freq: 880, start: 0, dur: 0.14 },
            { freq: 659.25, start: 0.14, dur: 0.18 },
            { freq: 880, start: 0.32, dur: 0.2 },
          ]
        : category === 'success'
        ? [
            { freq: 783.99, start: 0, dur: 0.14 },
            { freq: 1174.66, start: 0.12, dur: 0.24 },
          ]
        : [
            { freq: 659.25, start: 0, dur: 0.14 },
            { freq: 830.61, start: 0.1, dur: 0.16 },
            { freq: 987.77, start: 0.2, dur: 0.24 },
          ];

    const now = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.start);
      gain.gain.setValueAtTime(0.001, now + n.start);
      gain.gain.exponentialRampToValueAtTime(0.08, now + n.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.start);
      osc.stop(now + n.start + n.dur + 0.02);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Audio playback may be blocked prior to user gesture in web browsers
  }
}

export async function initializeNativeNotifications(
  onNavigate?: (tab: NavigationTab) => void
): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  try {
    if (Capacitor.getPlatform() === 'android' && !channelsInitialized) {
      const channels: Channel[] = [
        {
          id: CHANNEL_MAP.urgent.id,
          name: 'تنبيهات عاجلة وإعادة الرفع | Urgent Alerts',
          description: 'إشعارات إعادة رفع الهوية أو إشعار بنكك وإلغاء الطلبات',
          sound: CHANNEL_MAP.urgent.sound,
          importance: 5,
          visibility: 1,
          lights: true,
          lightColor: '#ef4444',
          vibration: true,
        },
        {
          id: CHANNEL_MAP.booking.id,
          name: 'حالة الطلبات والخدمات | Service Updates',
          description: 'طلبات الخدمات الجديدة، بدء التنفيذ، وإنهاء الخدمة',
          sound: CHANNEL_MAP.booking.sound,
          importance: 5,
          visibility: 1,
          lights: true,
          lightColor: '#0f766e',
          vibration: true,
        },
        {
          id: CHANNEL_MAP.success.id,
          name: 'الاعتمادات والتقييمات | Approvals & Ratings',
          description: 'اعتماد الهوية، تأكيد توريد العمولة، وتقييمات العملاء',
          sound: CHANNEL_MAP.success.sound,
          importance: 4,
          visibility: 1,
          lights: true,
          lightColor: '#10b981',
          vibration: true,
        },
      ];

      for (const ch of channels) {
        await LocalNotifications.createChannel(ch).catch(() => {});
      }
      channelsInitialized = true;
    }

    if (!permissionRequested) {
      permissionRequested = true;
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions().catch(() => {});
      }
    }

    const tapListenerPromise = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const targetTab = action?.notification?.extra?.targetTab as NavigationTab | undefined;
        if (targetTab && onNavigate) {
          onNavigate(targetTab);
        }
      }
    );

    return () => {
      tapListenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  } catch {
    return () => {};
  }
}

export async function requestNativeNotificationPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    // Ignore permission check failures
  }
}

export async function dispatchAppNotification(payload: AppNotificationPayload): Promise<void> {
  const { userId, eventKey, category, title, body, targetTab } = payload;

  if (hasAlreadyNotified(userId, eventKey)) {
    return;
  }
  markAsNotified(userId, eventKey);

  // Notify any active in-app toast banner listeners
  toastListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // Ignore listener errors
    }
  });

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          return;
        }
      }

      const channelConfig = CHANNEL_MAP[category];
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashToInt32(`${userId}:${eventKey}`),
            title,
            body,
            largeBody: body,
            summaryText: 'Mehani | مهني',
            channelId: channelConfig.id,
            sound: channelConfig.sound,
            smallIcon: 'ic_stat_mehani',
            iconColor: category === 'urgent' ? '#dc2626' : category === 'success' ? '#059669' : '#0f766e',
            autoCancel: true,
            foreground: true,
            isExactNotification: false,
            extra: {
              targetTab: targetTab || 'home',
              eventKey,
            },
          },
        ],
      });
    } catch (err) {
      console.error('Failed to schedule native local notification', err);
    }
    return;
  }

  // Non-native web browser fallback: play subtle chime & trigger Web Notification if already permitted
  playWebFallbackChime(category);
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        tag: eventKey,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {
      // Some mobile browsers require ServiceWorkerRegistration.showNotification
    }
  }
}
