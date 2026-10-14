import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export interface OtaCheckResult {
  isAvailable: boolean;
  manifest?: any;
}

export type OtaProgressStatus = 'idle' | 'downloading' | 'restarting' | 'error' | 'success';

export const otaUpdateService = {
  /**
   * Checks whether OTA updates are supported in the current runtime.
   * Disabled in local development (__DEV__) and inside Expo Go app.
   */
  isOtaSupported(): boolean {
    if (typeof __DEV__ !== 'undefined' && __DEV__) return false;

    const isExpoGo =
      (Constants as any)?.appOwnership === 'expo' ||
      (Constants as any)?.executionEnvironment === 'storeClient';
    if (isExpoGo) return false;

    return Updates.isEnabled;
  },

  /**
   * Query the EAS Update server to see if a newer JS bundle has been published
   * for this app's matching runtimeVersion & release channel.
   */
  async checkForOtaUpdate(): Promise<OtaCheckResult> {
    if (!this.isOtaSupported()) {
      return { isAvailable: false };
    }

    try {
      const res = await Updates.checkForUpdateAsync();
      return {
        isAvailable: Boolean(res.isAvailable),
        manifest: res.manifest,
      };
    } catch (err: any) {
      console.warn('[otaUpdateService] Check update error:', err?.message || err);
      return { isAvailable: false };
    }
  },

  /**
   * Downloads the pending update bundle and immediately reloads the app.
   */
  async fetchAndReloadOtaUpdate(
    onStatusChange?: (status: OtaProgressStatus, message?: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isOtaSupported()) {
      return {
        success: false,
        error: 'OTA updates are only active in standalone release builds.',
      };
    }

    try {
      onStatusChange?.('downloading', 'Downloading update...');
      const fetchResult = await Updates.fetchUpdateAsync();

      if (fetchResult.isNew) {
        onStatusChange?.('restarting', 'Restarting StyleFleet...');
        // Brief pause to allow the UI to reflect the restart state
        await new Promise((resolve) => setTimeout(resolve, 600));
        await Updates.reloadAsync();
        return { success: true };
      }

      onStatusChange?.('success', 'You are already on the latest version.');
      return { success: true };
    } catch (err: any) {
      const errorMsg =
        err?.message || 'Unable to download update. Please check your internet connection.';
      console.warn('[otaUpdateService] Fetch & reload error:', errorMsg);
      onStatusChange?.('error', errorMsg);
      return { success: false, error: errorMsg };
    }
  },
};
