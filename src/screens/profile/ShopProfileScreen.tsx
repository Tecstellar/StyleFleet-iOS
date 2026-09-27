import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../../i18n/translations';
import { ACCENT_SWATCHES } from '../../theme/colors';
import { Button } from '../../components/common/Button';
import { BackIcon, StoreIcon, EditIcon } from '../../components/common/SvgIcons';
import { radii, shadows } from '../../theme/spacing';
import { supportRepository } from '../../repositories/supportRepository';
import { shopRepository } from '../../repositories/shopRepository';
import { supabase } from '../../lib/supabase';

interface ShopProfileScreenProps {
  shopId?: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  pinCode: string;
  gstin?: string;
  logoUrl?: string | null;
  currentGstRate?: number;
  teamCount: number;
  onBack: () => void;
  onUpdateLogo?: (logoPath: string) => Promise<void>;
  onUpdateGstRate?: (rate: number) => Promise<void>;
  onUpdateShop?: (updated: any) => void;
  onAccountDeleted?: () => void;
  onSignOut?: () => void;
}

export const ShopProfileScreen = ({
  shopId = '',
  shopName,
  ownerName,
  phone,
  address,
  city,
  pinCode,
  gstin = 'Not specified',
  logoUrl,
  currentGstRate = 0,
  teamCount,
  onBack,
  onUpdateLogo,
  onUpdateGstRate,
  onUpdateShop,
  onAccountDeleted,
  onSignOut,
}: ShopProfileScreenProps) => {
  const { colors, accent, setAccent } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [currentLogo, setCurrentLogo] = useState<string | null>(logoUrl || null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);

  // GST Settings
  const [isGstEnabled, setIsGstEnabled] = useState(currentGstRate > 0);
  const [gstRateInput, setGstRateInput] = useState(String(currentGstRate > 0 ? currentGstRate : 18));
  const [isUpdatingGst, setIsUpdatingGst] = useState(false);

  // Language Modal
  const [showLangModal, setShowLangModal] = useState(false);

  // Edit Salon Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(shopName);
  const [editOwner, setEditOwner] = useState(ownerName);
  const [editAddress, setEditAddress] = useState(address);
  const [editCity, setEditCity] = useState(city);
  const [editPin, setEditPin] = useState(pinCode);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setEditName(shopName);
    setEditOwner(ownerName);
    setEditAddress(address);
    setEditCity(city);
    setEditPin(pinCode);
  }, [shopName, ownerName, address, city, pinCode]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter salon name');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await shopRepository.updateShop(shopId, {
        name: editName.trim(),
        address: editAddress.trim(),
        city: editCity.trim(),
        pin_code: editPin.trim(),
        owner_name: editOwner.trim() || undefined,
      });

      if (!updated) {
        Alert.alert('Error', 'Could not update salon profile.');
        return;
      }

      if (editOwner.trim()) {
        const cached = await shopRepository.getShopById(shopId);
        const ownerProfileId = cached?.owner_profile_id || null;
        if (ownerProfileId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ full_name: editOwner.trim() } as any)
            .eq('id', ownerProfileId);

          if (profileError) {
            Alert.alert('Error', profileError.message || 'Could not update owner profile');
            return;
          }
        }
        await shopRepository.saveOwnerName(editOwner.trim(), ownerProfileId);
      }

      if (onUpdateShop) {
        onUpdateShop({ ...updated, name: editName.trim(), owner_name: editOwner.trim() });
      }
      setShowEditModal(false);
      Alert.alert('Profile Saved', 'Salon profile details updated in database successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to change logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setIsUpdatingLogo(true);
        setCurrentLogo(newUri);
        if (onUpdateLogo) {
          await onUpdateLogo(newUri);
        }
        setIsUpdatingLogo(false);
        Alert.alert('Logo Updated', 'Your salon logo has been saved.');
      }
    } catch (e: any) {
      setIsUpdatingLogo(false);
      Alert.alert('Notice', e.message || 'Could not change logo');
    }
  };

  const handleToggleGst = async () => {
    const nextState = !isGstEnabled;
    setIsGstEnabled(nextState);
    const rateToSave = nextState ? parseFloat(gstRateInput) || 18 : 0;
    if (onUpdateGstRate) {
      await onUpdateGstRate(rateToSave);
    }
  };

  const handleSaveGstRate = async () => {
    const rate = parseFloat(gstRateInput);
    if (isNaN(rate) || rate < 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid GST percentage (e.g. 5, 12, 18)');
      return;
    }

    setIsUpdatingGst(true);
    if (onUpdateGstRate) {
      await onUpdateGstRate(isGstEnabled ? rate : 0);
    }
    setIsUpdatingGst(false);
    Alert.alert('GST Updated', `GST on services set to ${isGstEnabled ? rate : 0}%.`);
  };

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeLabel || 'English';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('shopProfile', 'Shop Profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Shop Info Card with Change Logo */}
        <View style={[styles.shopCard, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickLogo}
            style={[
              styles.logoBox,
              {
                backgroundColor: colors.accent800,
                borderColor: 'rgba(217, 164, 65, 0.35)',
              },
            ]}
          >
            {currentLogo ? (
              <Image source={{ uri: currentLogo }} style={styles.logoImage} />
            ) : (
              <Text style={{ color: colors.accent100, fontSize: 16, fontWeight: '700' }}>
                {shopName ? shopName.slice(0, 2).toUpperCase() : 'SO'}
              </Text>
            )}
            <View style={[styles.logoEditBadge, { backgroundColor: colors.accent }]}>
              <EditIcon size={10} color="#000" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.shopName, { color: colors.text }]}>{shopName}</Text>
            <Text style={[styles.shopAddress, { color: colors.textDim }]}>
              {address}, {city} {pinCode}
            </Text>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity onPress={handlePickLogo}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                  📷 {t('changeLogo', 'Change Logo')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEditModal(true)}>
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                  ✏️ {t('editProfile', 'Edit Profile')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* GST ON SERVICES SECTION */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('gstOnServices', 'GST ON SERVICES')}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.gstRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Apply GST on Invoices</Text>
              <Text style={[styles.rowSub, { color: colors.textDim }]}>
                {isGstEnabled
                  ? `Active at ${gstRateInput}% GST rate`
                  : 'Turned off (0% GST on all bills)'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleGst}
              style={[
                styles.toggleTrack,
                {
                  backgroundColor: isGstEnabled ? colors.accent800 : 'transparent',
                  borderColor: isGstEnabled ? colors.accent : colors.divider,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  {
                    left: isGstEnabled ? 18 : 2,
                    backgroundColor: isGstEnabled ? colors.accent200 : colors.textDim,
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          {isGstEnabled && (
            <View style={styles.gstInputRow}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>Custom Rate %:</Text>
              <TextInput
                style={[
                  styles.gstTextInput,
                  { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                ]}
                keyboardType="numeric"
                value={gstRateInput}
                onChangeText={setGstRateInput}
                placeholder="18"
                placeholderTextColor={colors.textDim}
              />
              <TouchableOpacity
                onPress={handleSaveGstRate}
                style={[styles.saveGstBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#000', fontWeight: '600', fontSize: 12 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* LANGUAGE SELECTION */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          {t('language', 'APP LANGUAGE')}
        </Text>
        <TouchableOpacity
          onPress={() => setShowLangModal(true)}
          style={[styles.card, { backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center' }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{t('selectLanguage', 'Select Language')}</Text>
            <Text style={[styles.rowSub, { color: colors.accent }]}>{currentLangLabel}</Text>
          </View>
          <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
        </TouchableOpacity>

        {/* Theme Swatches */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          THEME FROM LOGO
        </Text>
        <View style={[styles.themeCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.themeDescription, { color: colors.textMuted }]}>
            Pick the signature colour that carries buttons, charts and highlights:
          </Text>
          <View style={styles.swatchesRow}>
            {ACCENT_SWATCHES.map((swatch) => {
              const isSelected = accent.toLowerCase() === swatch.toLowerCase();
              return (
                <TouchableOpacity
                  key={swatch}
                  activeOpacity={0.8}
                  onPress={() => setAccent(swatch)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: swatch,
                      borderColor: isSelected ? colors.text : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* Details Rows */}
        <View style={styles.detailsList}>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Owner</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{ownerName}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Login number</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>+91 {phone}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>GSTIN</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{gstin}</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Team</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{teamCount} stylists</Text>
          </View>
          <View style={[styles.detailRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Invoice prefix</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>INV-</Text>
          </View>
        </View>

        {/* EDIT PROFILE */}
        <View style={{ marginTop: 12, marginBottom: 24 }}>
          <Button
            label={`✏️ ${t('editProfile', 'Edit Salon Profile')}`}
            variant="primary"
            block
            onPress={() => setShowEditModal(true)}
          />
        </View>
      </ScrollView>

      {/* LANGUAGE SELECT MODAL */}
      <Modal visible={showLangModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select App Language</Text>
              <TouchableOpacity onPress={() => setShowLangModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
            {SUPPORTED_LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={async () => {
                  await setLanguage(l.code);
                  setShowLangModal(false);
                }}
                style={[
                  styles.langOptionRow,
                  {
                    backgroundColor: language === l.code ? colors.accent900 : 'transparent',
                    borderColor: language === l.code ? colors.accent : colors.divider,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 15 }}>{l.nativeLabel}</Text>
                <Text style={{ color: colors.textDim, fontSize: 13 }}>({l.label})</Text>
                {language === l.code && <Text style={{ color: colors.accent, marginLeft: 'auto' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* EDIT SALON PROFILE MODAL (Saves directly to Supabase) */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Salon Profile</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Salon Name *</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Salon Name"
                  placeholderTextColor={colors.textDim}
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Owner Name</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Owner Name"
                  placeholderTextColor={colors.textDim}
                  value={editOwner}
                  onChangeText={setEditOwner}
                />

                <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Address</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 10 }]}
                  placeholder="Street / Area Address"
                  placeholderTextColor={colors.textDim}
                  value={editAddress}
                  onChangeText={setEditAddress}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>City</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                      placeholder="City"
                      placeholderTextColor={colors.textDim}
                      value={editCity}
                      onChangeText={setEditCity}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>Pincode</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                      placeholder="6-digit PIN"
                      placeholderTextColor={colors.textDim}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={editPin}
                      onChangeText={(txt) => setEditPin(txt.replace(/\D/g, '').slice(0, 6))}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Save Changes to Database</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
  },
  shopAddress: {
    fontSize: 11.5,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  rowTitle: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  gstTextInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  saveGstBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  themeCard: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  themeDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  swatchesRow: {
    flexDirection: 'row',
    gap: 9,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 2,
  },
  detailsList: {
    gap: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
  },
  outlineBtn: {
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  modalAddBtn: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 8,
  },
});
