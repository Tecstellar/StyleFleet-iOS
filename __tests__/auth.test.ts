import { authService } from '../src/services/authService';

describe('Auth Service Validation', () => {
  it('rejects invalid mobile numbers', async () => {
    const res1 = await authService.sendOtp('12345');
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('10-digit');

    const res2 = await authService.sendOtp('');
    expect(res2.success).toBe(false);
  });

  it('rejects incomplete OTPs', async () => {
    const res = await authService.verifyOtp('9845062110', '1234');
    expect(res.success).toBe(false);
    expect(res.error).toContain('6-digit');
  });

  it('validates shop registration fields', async () => {
    await expect(
      authService.registerShop('user_123', {
        name: '',
        ownerName: 'Arun Prakash',
        address: '14 Kasturba Road',
        city: 'Bengaluru',
        pinCode: '560001',
      })
    ).rejects.toThrow('Shop name is required');

    await expect(
      authService.registerShop('user_123', {
        name: 'Salon',
        ownerName: 'Arun Prakash',
        address: '14 Kasturba Road',
        city: 'Bengaluru',
        pinCode: '560',
      })
    ).rejects.toThrow('Valid 6-digit PIN code is required');
  });
});
