import { Linking, Platform } from 'react-native';

let IntentLauncher: any = null;
if (Platform.OS === 'android') {
  try {
    IntentLauncher = require('expo-intent-launcher');
  } catch {}
}

export interface WhatsAppApp {
  id: 'whatsapp' | 'business';
  /** Brand names are not translated. */
  label: string;
  packageName: string;
}

export interface InstalledWhatsAppApp extends WhatsAppApp {
  /** Base64 PNG of the app's own icon, when Android gave one. */
  iconBase64: string | null;
}

export const WHATSAPP_APPS: WhatsAppApp[] = [
  { id: 'whatsapp', label: 'WhatsApp', packageName: 'com.whatsapp' },
  { id: 'business', label: 'WhatsApp Business', packageName: 'com.whatsapp.w4b' },
];

export type WhatsAppChoice = 'none' | 'single' | 'ask';

/** Only ask the user when there is a choice to make (2 apps installed, or detection was hidden on Android). */
export function whatsAppChoiceFor(installedCount: number): WhatsAppChoice {
  if (installedCount >= 2) return 'ask';
  if (installedCount === 1) return 'single';
  return 'none';
}

export function buildChatUrls(phone10: string, message: string) {
  const phone = `91${phone10.replace(/\D/g, '').slice(-10)}`;
  const text = encodeURIComponent(message);
  return {
    native: `whatsapp://send?phone=${phone}&text=${text}`,
    consumerNative: `whatsapp-consumer://send?phone=${phone}&text=${text}`,
    web: `https://api.whatsapp.com/send?phone=${phone}&text=${text}`,
  };
}

/**
 * Which WhatsApp apps are installed.
 * - On Android: Checks installed packages (com.whatsapp and com.whatsapp.w4b).
 * - On iOS: Checks custom URL schemes declared in Info.plist (whatsapp:// and whatsapp-consumer://).
 * When both are available, callers show the WhatsAppAppPickerModal to let the user select.
 */
export async function getInstalledWhatsAppApps(): Promise<InstalledWhatsAppApp[]> {
  if (Platform.OS === 'android') {
    if (!IntentLauncher) return [];
    const found = await Promise.all(
      WHATSAPP_APPS.map(async (app): Promise<InstalledWhatsAppApp | null> => {
        try {
          const icon = await IntentLauncher.getApplicationIconAsync(app.packageName);
          return { ...app, iconBase64: icon || null };
        } catch {
          return null;
        }
      })
    );
    return found.filter((a): a is InstalledWhatsAppApp => a !== null);
  }

  // iOS platform detection
  try {
    const [canConsumer, canStandard] = await Promise.all([
      Linking.canOpenURL('whatsapp-consumer://').catch(() => false),
      Linking.canOpenURL('whatsapp://').catch(() => false),
    ]);

    if (canConsumer || canStandard) {
      return [
        { ...WHATSAPP_APPS[0], iconBase64: null },
        { ...WHATSAPP_APPS[1], iconBase64: null },
      ];
    }
  } catch {}

  return [];
}

/** Open a chat with the prepared message, in the chosen app or the system default. */
export async function openWhatsAppChat(phone10: string, message: string, app?: WhatsAppApp): Promise<void> {
  const urls = buildChatUrls(phone10, message);

  if (app && Platform.OS === 'android' && IntentLauncher) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: urls.native,
        packageName: app.packageName,
      });
      return;
    } catch {
      // chosen app could not open the chat: fall through to the system default
    }
  }

  if (app && Platform.OS === 'ios') {
    if (app.id === 'whatsapp') {
      try {
        if (await Linking.canOpenURL(urls.consumerNative)) {
          await Linking.openURL(urls.consumerNative);
          return;
        }
      } catch {}
    }
    if (app.id === 'business') {
      try {
        if (await Linking.canOpenURL(urls.native)) {
          await Linking.openURL(urls.native);
          return;
        }
      } catch {}
    }
  }

  try {
    if (await Linking.canOpenURL(urls.native)) {
      await Linking.openURL(urls.native);
      return;
    }
  } catch {
    // fall through to the web link
  }
  await Linking.openURL(urls.web);
}
