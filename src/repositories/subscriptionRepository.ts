import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { SubscriptionRecord } from '../types/domain';
import {
  TrialCalculationResult,
  SubscriptionCalculationResult,
  calculateTrialStatus,
  calculateSubscriptionStatus,
} from '../utils/subscriptionUtils';

const STORAGE_KEY_SUB_CACHE = '@salon_os_sub_cache_';
const STORAGE_KEY_REG_DATE = '@salon_os_reg_date_';

export interface SubscriptionInfo {
  type: 'trial' | 'subscription';
  trial?: TrialCalculationResult;
  subscription?: SubscriptionCalculationResult;
  rawRecord?: SubscriptionRecord | null;
  registrationDateIso: string;
}

export class SubscriptionRepository {
  /**
   * Fetch current subscription or trial status for a shop.
   */
  async getSubscriptionInfo(shopId: string, userId?: string): Promise<SubscriptionInfo> {
    const targetShopKey = shopId || 'default';
    try {
      // 1. Try querying Supabase subscriptions table for any active subscription
      let subRecord: SubscriptionRecord | null = null;
      if (shopId) {
        try {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            subRecord = data[0] as SubscriptionRecord;
          }
        } catch {
          // offline or table not present yet
        }
      }

      if (subRecord && subRecord.status === 'active') {
        const subCalc = calculateSubscriptionStatus(subRecord);
        const info: SubscriptionInfo = {
          type: 'subscription',
          subscription: subCalc,
          rawRecord: subRecord,
          registrationDateIso: subRecord.created_at,
        };
        await AsyncStorage.setItem(STORAGE_KEY_SUB_CACHE + targetShopKey, JSON.stringify(info));
        return info;
      }

      // 2. Resolve authoritative registration date for Free Trial
      let registrationDateIso = new Date().toISOString();
      if (shopId) {
        try {
          const { data: shopData } = await supabase
            .from('shop_profiles')
            .select('created_at')
            .eq('id', shopId)
            .single();

          if (shopData?.created_at) {
            registrationDateIso = shopData.created_at;
            await AsyncStorage.setItem(STORAGE_KEY_REG_DATE + targetShopKey, registrationDateIso);
          }
        } catch {
          // use cached reg date
        }
      }

      if (!registrationDateIso) {
        const cachedReg = await AsyncStorage.getItem(STORAGE_KEY_REG_DATE + targetShopKey);
        if (cachedReg) registrationDateIso = cachedReg;
      }

      const trialCalc = calculateTrialStatus(registrationDateIso);
      const info: SubscriptionInfo = {
        type: 'trial',
        trial: trialCalc,
        rawRecord: null,
        registrationDateIso,
      };

      await AsyncStorage.setItem(STORAGE_KEY_SUB_CACHE + targetShopKey, JSON.stringify(info));
      return info;
    } catch {
      // Local fallback
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY_SUB_CACHE + targetShopKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // ignore
      }

      const fallbackTrial = calculateTrialStatus(new Date().toISOString());
      return {
        type: 'trial',
        trial: fallbackTrial,
        registrationDateIso: new Date().toISOString(),
      };
    }
  }
}

export const subscriptionRepository = new SubscriptionRepository();
