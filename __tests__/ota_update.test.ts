import { otaUpdateService } from '../src/services/otaUpdateService';
import * as Updates from 'expo-updates';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

describe('OTA Update Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('safely disables OTA in __DEV__ mode', () => {
    (global as any).__DEV__ = true;
    expect(otaUpdateService.isOtaSupported()).toBe(false);
  });

  it('enables OTA when in production build with Updates.isEnabled', () => {
    (global as any).__DEV__ = false;
    expect(otaUpdateService.isOtaSupported()).toBe(true);
  });

  it('returns isAvailable: false when OTA is not supported', async () => {
    (global as any).__DEV__ = true;
    const res = await otaUpdateService.checkForOtaUpdate();
    expect(res.isAvailable).toBe(false);
    expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('checks for update and returns available true when supported and update exists', async () => {
    // Temporarily mock isOtaSupported to return true
    const isSupportedSpy = jest.spyOn(otaUpdateService, 'isOtaSupported').mockReturnValue(true);
    (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({
      isAvailable: true,
      manifest: { id: 'update-123' },
    });

    const res = await otaUpdateService.checkForOtaUpdate();
    expect(res.isAvailable).toBe(true);
    expect(res.manifest).toEqual({ id: 'update-123' });
    expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

    isSupportedSpy.mockRestore();
  });

  it('handles check update errors gracefully without throwing', async () => {
    const isSupportedSpy = jest.spyOn(otaUpdateService, 'isOtaSupported').mockReturnValue(true);
    (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('Network offline'));

    const res = await otaUpdateService.checkForOtaUpdate();
    expect(res.isAvailable).toBe(false);

    isSupportedSpy.mockRestore();
  });

  it('fetches and reloads when a new update is found', async () => {
    const isSupportedSpy = jest.spyOn(otaUpdateService, 'isOtaSupported').mockReturnValue(true);
    (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValueOnce({ isNew: true });
    (Updates.reloadAsync as jest.Mock).mockResolvedValueOnce(undefined);

    const statusUpdates: string[] = [];
    const result = await otaUpdateService.fetchAndReloadOtaUpdate((status) => {
      statusUpdates.push(status);
    });

    expect(result.success).toBe(true);
    expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(statusUpdates).toContain('downloading');
    expect(statusUpdates).toContain('restarting');

    isSupportedSpy.mockRestore();
  });

  it('handles download failures gracefully and calls error callback', async () => {
    const isSupportedSpy = jest.spyOn(otaUpdateService, 'isOtaSupported').mockReturnValue(true);
    (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error('Failed to download update bundle'));

    const statusUpdates: string[] = [];
    const result = await otaUpdateService.fetchAndReloadOtaUpdate((status) => {
      statusUpdates.push(status);
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to download update bundle');
    expect(statusUpdates).toContain('error');
    expect(Updates.reloadAsync).not.toHaveBeenCalled();

    isSupportedSpy.mockRestore();
  });
});
