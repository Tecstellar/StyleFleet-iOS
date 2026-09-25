import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '../types/database';

export type ShopRow = Database['public']['Tables']['shops']['Row'];

const STORAGE_KEY_SHOP_CACHE = '@salon_os_shop_cache';
const STORAGE_KEY_LAST_PHONE = '@salon_os_last_phone';

export interface ShopRegistrationData {
  name: string;
  ownerName: string;
  address: string;
  city: string;
  pinCode: string;
  gstin?: string;
  phone?: string;
  accentColor?: string;
  logoPath?: string;
}

export class ShopRepository {
  async getShopById(shopId: string): Promise<ShopRow | null> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      if (!error && data) {
        await this.cacheShop(data as ShopRow);
        return data as ShopRow;
      }
    } catch {
      // Fallback to cache
    }

    return this.getCachedShop();
  }

  async getShopForUser(userId: string): Promise<ShopRow | null> {
    try {
      // 1. Direct query on shops by owner_profile_id
      const { data: directShops, error: directErr } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!directErr && directShops && directShops.length > 0) {
        await this.cacheShop(directShops[0] as ShopRow);
        return directShops[0] as ShopRow;
      }

      // 2. Query shop_members
      const { data: members, error: memErr } = await supabase
        .from('shop_members')
        .select('shop_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);

      if (!memErr && members && members.length > 0) {
        return this.getShopById(members[0].shop_id);
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Find registered shop by phone number in Supabase
   */
  async getShopByPhone(phone: string): Promise<ShopRow | null> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (!clean) return null;

    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .or(`phone.eq.${clean},phone.eq.+91${clean},phone.eq.91${clean}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        await this.cacheShop(data[0] as ShopRow);
        return data[0] as ShopRow;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async createShop(
    ownerUserId: string,
    data: ShopRegistrationData
  ): Promise<ShopRow> {
    // 1. Try calling the register_salon RPC function (bypasses RLS with SECURITY DEFINER)
    try {
      const { data: rpcShop, error: rpcError } = await supabase.rpc('register_salon', {
        p_name: data.name,
        p_phone: data.phone || null,
        p_owner_name: data.ownerName || data.name,
        p_address: data.address,
        p_city: data.city,
        p_pin_code: data.pinCode,
        p_gstin: data.gstin || null,
        p_logo_path: data.logoPath || null,
        p_accent_color: data.accentColor || '#D9A441',
      });

      if (!rpcError && rpcShop) {
        const row = rpcShop as ShopRow;
        await this.cacheShop(row);
        return row;
      }
    } catch {
      // Fall through to direct table insert
    }

    // 2. Resolve active Supabase Auth user ID (UUID)
    let validOwnerId: string | null = ownerUserId;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        validOwnerId = sessionData.session.user.id;
      }
    } catch {
      // ignore
    }

    const isRealUuid =
      validOwnerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validOwnerId);

    // 3. Ensure profile exists in public.profiles table
    if (isRealUuid && validOwnerId) {
      try {
        await supabase.from('profiles').upsert({
          id: validOwnerId,
          phone: data.phone || null,
          full_name: data.ownerName || null,
        } as any);
      } catch (profErr) {
        console.warn('Profiles upsert notice:', profErr);
      }
    }

    // 4. Insert salon row into Supabase public.shops
    const insertPayload: any = {
      name: data.name,
      logo_path: data.logoPath || null,
      address: data.address,
      city: data.city,
      pin_code: data.pinCode,
      gstin: data.gstin || null,
      phone: data.phone || null,
      accent_color: data.accentColor || '#D9A441',
      invoice_prefix: 'INV-',
      gst_rate: 18.00,
    };

    if (isRealUuid && validOwnerId) {
      insertPayload.owner_profile_id = validOwnerId;
    }

    const { data: created, error } = await supabase
      .from('shops')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Supabase shop creation error:', error);
      throw new Error(`Failed to save salon to database: ${error.message}`);
    }

    if (created) {
      const row = created as ShopRow;

      // 4. Create shop membership
      if (isRealUuid && validOwnerId) {
        try {
          await supabase.from('shop_members').insert({
            shop_id: row.id,
            profile_id: validOwnerId,
            role: 'owner',
            is_active: true,
          } as any);
        } catch (memErr) {
          console.warn('Shop member creation notice:', memErr);
        }
      }

      // 5. Initialize shop defaults via RPC
      try {
        await supabase.rpc('initialize_shop_defaults', { new_shop_id: row.id } as any);
      } catch (rpcErr) {
        console.warn('RPC initialize_shop_defaults notice:', rpcErr);
      }

      await this.cacheShop(row);
      return row;
    }

    throw new Error('Unexpected empty response from database when saving salon');
  }

  async updateShop(shopId: string, updates: Partial<ShopRow>): Promise<ShopRow | null> {
    try {
      const { data, error } = await supabase
        .from('shops')
        .update(updates as any)
        .eq('id', shopId)
        .select()
        .single();

      if (!error && data) {
        await this.cacheShop(data as ShopRow);
        return data as ShopRow;
      }
    } catch {
      // ignore
    }

    const cached = await this.getCachedShop();
    if (cached && cached.id === shopId) {
      const updated = { ...cached, ...updates };
      await this.cacheShop(updated);
      return updated;
    }
    return null;
  }

  async cacheShop(shop: ShopRow): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_SHOP_CACHE, JSON.stringify(shop));
  }

  async getCachedShop(): Promise<ShopRow | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY_SHOP_CACHE);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  }

  async clearCachedShop(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY_SHOP_CACHE);
  }

  async saveLastPhone(phone: string): Promise<void> {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean) {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_PHONE, clean);
    }
  }

  async getLastPhone(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEY_LAST_PHONE);
    } catch {
      return null;
    }
  }
}

export const shopRepository = new ShopRepository();
