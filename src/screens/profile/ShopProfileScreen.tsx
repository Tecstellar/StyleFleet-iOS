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
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../../i18n/translations';
import { ACCENT_SWATCHES } from '../../theme/colors';
import { Button } from '../../components/common/Button';
import { BackIcon, StoreIcon, EditIcon } from '../../components/common/SvgIcons';
import { radii, shadows } from '../../theme/spacing';
import { supportRepository } from '../../repositories/supportRepository';

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
  onUpdateShopDetails?: (details: {
    name: string;
    ownerName: string;
    address: string;
    city: string;
    pinCode: string;
  }) => Promise<void>;
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
  onUpdateShopDetails,
  onAccountDeleted,
  onSignOut,
}: ShopProfileScreenProps) => {
  const { colors, accent, setAccent } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [currentLogo, setCurrentLogo] = useState<string | null>(logoUrl || null);
  const [isUpdatingLogo, setIsUpdatingLogo] = useState(false);

  // Synchronize currentLogo when logoUrl prop updates from parent or database
  useEffect(() => {
    if (logoUrl) {
      setCurrentLogo(logoUrl);
    }
  }, [logoUrl]);

  // Edit Shop Profile State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(shopName);
  const [editOwnerName, setEditOwnerName] = useState(ownerName);
  const [editAddress, setEditAddress] = useState(address);
  const [editCity, setEditCity] = useState(city);
  const [editPinCode, setEditPinCode] = useState(pinCode);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  useEffect(() => {
    setEditName(shopName);
    setEditOwnerName(ownerName);
    setEditAddress(address);
    setEditCity(city);
    setEditPinCode(pinCode);
  }, [shopName, ownerName, address, city, pinCode]);

  const handleSaveShopDetails = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter salon name');
      return;
    }
    if (!editAddress.trim()) {
      Alert.alert('Required', 'Please enter address');
      return;
    }
    if (!editCity.trim()) {
      Alert.alert('Required', 'Please enter city');
      return;
    }
    const cleanPin = editPinCode.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit PIN code');
      return;
    }

    setIsSavingDetails(true);
    try {
      if (onUpdateShopDetails) {
        await onUpdateShopDetails({
          name: editName.trim(),
          ownerName: editOwnerName.trim() || editName.trim(),
          address: editAddress.trim(),
          city: editCity.trim(),
          pinCode: cleanPin,
        });
      }
      setIsSavingDetails(false);
      setShowEditProfileModal(false);
      Alert.alert('Profile Updated', 'Salon details saved successfully.');
    } catch (e: any) {
      setIsSavingDetails(false);
      Alert.alert('Notice', e.message || 'Could not update salon profile');
    }
  };

  // GST Settings
  const [isGstEnabled, setIsGstEnabled] = useState(currentGstRate > 0);
  const [gstRateInput, setGstRateInput] = useState(String(currentGstRate > 0 ? currentGstRate : 18));
  const [isUpdatingGst, setIsUpdatingGst] = useState(false);

  // Language Modal
  const [showLangModal, setShowLangModal] = useState(false);

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
        const pickedUri = result.assets[0].uri;
        setIsUpdatingLogo(true);

        // Store logo permanently in app documentDirectory so it survives cache purges and reboot
        let permanentUri = pickedUri;
        if (FileSystem.documentDirectory) {
          const extension = pickedUri.split('.').pop() || 'jpg';
          const destUri = `${FileSystem.documentDirectory}salon_logo_${Date.now()}.${extension}`;
          try {
            await FileSystem.copyAsync({
              from: pickedUri,
              to: destUri,
            });
            permanentUri = destUri;
          } catch (copyErr) {
            console.warn('Permanent logo copy fallback to raw URI:', copyErr);
          }
        }

        setCurrentLogo(permanentUri);
        if (onUpdateLogo) {
          await onUpdateLogo(permanentUri);
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <Text style={[styles.shopName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {editName}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEditProfileModal(true)}
                activeOpacity={0.75}
                style={[styles.editProfileBtn, { borderColor: colors.accent, backgroundColor: colors.accent900 }]}
              >
                <Text style={{ color: colors.accent100, fontSize: 11.5, fontWeight: '700' }}>
                  ✎ Edit Profile
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.shopAddress, { color: colors.textDim }]}>
              {editAddress}, {editCity} {editPinCode}
            </Text>
            <TouchableOpacity onPress={handlePickLogo} style={{ marginTop: 4 }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                📷 {t('changeLogo', 'Change Salon Logo')}
              </Text>
            </TouchableOpacity>
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
            <Text style={[styles.detailValue, { color: colors.text }]}>{editOwnerName}</Text>
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>

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

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditProfileModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('editProfile', 'Edit Salon Profile')}</Text>
              <TouchableOpacity onPress={() => setShowEditProfileModal(false)}>
                <Text style={{ color: colors.textDim, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Salon Name */}
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>{t('salonName', 'Salon Name')}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 12 }]}
                placeholder="e.g. Blade & Shears"
                placeholderTextColor={colors.textDim}
                value={editName}
                onChangeText={setEditName}
              />

              {/* Owner Name */}
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>{t('ownerName', 'Owner Name')}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 12 }]}
                placeholder="e.g. Vikram Sharma"
                placeholderTextColor={colors.textDim}
                value={editOwnerName}
                onChangeText={setEditOwnerName}
              />

              {/* Address */}
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>{t('address', 'Address')}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 12 }]}
                placeholder="Shop number, building, street"
                placeholderTextColor={colors.textDim}
                value={editAddress}
                onChangeText={setEditAddress}
              />

              {/* City */}
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>{t('city', 'City')}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 12 }]}
                placeholder="e.g. Mumbai, Bengaluru"
                placeholderTextColor={colors.textDim}
                value={editCity}
                onChangeText={setEditCity}
              />

              {/* PIN Code */}
              <Text style={[styles.fieldLabel, { color: colors.textDim }]}>{t('pinCode', '6-Digit PIN Code')}</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 16 }]}
                placeholder="e.g. 560001"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
                maxLength={6}
                value={editPinCode}
                onChangeText={setEditPinCode}
              />

              <TouchableOpacity
                onPress={handleSaveShopDetails}
                disabled={isSavingDetails}
                activeOpacity={0.8}
                style={[styles.modalAddBtn, { backgroundColor: colors.accent, marginTop: 4 }]}
              >
                {isSavingDetails ? (
                  <ActivityIndicator color="#0D0E11" size="small" />
                ) : (
                  <Text style={{ color: '#0D0E11', fontWeight: '700', fontSize: 14 }}>Save Salon Profile</Text>
                )}
              </TouchableOpacity>
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
  editProfileBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 5,
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
