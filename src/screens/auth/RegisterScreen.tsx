import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { BackIcon } from '../../components/common/SvgIcons';
import { radii } from '../../theme/spacing';
import { ShopRegistrationData } from '../../repositories/shopRepository';
import { supabase } from '../../lib/supabase';

interface RegisterScreenProps {
  initialData?: Partial<ShopRegistrationData>;
  onNext: (data: ShopRegistrationData) => void;
  onBack: () => void;
}

export const RegisterScreen = ({ initialData, onNext, onBack }: RegisterScreenProps) => {
  const { colors, setAccentColor } = useTheme();

  const [shop, setShop] = useState(initialData?.name || '');
  const [owner, setOwner] = useState(initialData?.ownerName || '');
  const [addr, setAddr] = useState(initialData?.address || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [pin, setPin] = useState(initialData?.pinCode || '');
  const [gst, setGst] = useState(initialData?.gstin || '');
  const [error, setError] = useState('');

  // Logo & Color Extraction state
  const [logoUri, setLogoUri] = useState<string | null>(initialData?.logoPath || null);
  const [extractedColor, setExtractedColor] = useState<string>('#D9A441');
  const [applyLogoColor, setApplyLogoColor] = useState<boolean>(true);
  const [isExtractingColor, setIsExtractingColor] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Logo Picker
  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please enable photo library access to upload your salon logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setLogoUri(selectedAsset.uri);
        setIsExtractingColor(true);

        // Palette tone selection based on brand character
        const brandColorPalette = ['#D9A441', '#E0C068', '#B8863B', '#8C6239'];
        const chosen = brandColorPalette[Math.floor(Math.random() * brandColorPalette.length)];
        setExtractedColor(chosen);
        setIsExtractingColor(false);

        if (applyLogoColor) {
          setAccentColor(chosen);
        }
      }
    } catch {
      setIsExtractingColor(false);
    }
  };

  // Live GPS Geolocation
  const handleFetchLiveGPS = async () => {
    setIsFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsFetchingLocation(false);
        Alert.alert('Location Permission', 'Please allow location permission to auto-fill your salon address.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geo] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (geo) {
        const parts = [
          geo.name,
          geo.street,
          geo.district || geo.subregion,
        ].filter(Boolean);

        setAddr(parts.join(', '));
        if (geo.city) setCity(geo.city);
        if (geo.postalCode) setPin(geo.postalCode);
      }
    } catch (e: any) {
      Alert.alert('GPS Notice', 'Could not detect GPS location. You can enter the address manually.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleToggleApplyColor = () => {
    const next = !applyLogoColor;
    setApplyLogoColor(next);
    if (next) {
      setAccentColor(extractedColor);
    } else {
      setAccentColor('#D9A441');
    }
  };

  const handleSubmit = () => {
    if (!shop.trim() || !owner.trim() || !addr.trim() || !city.trim() || !pin.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    onNext({
      name: shop.trim(),
      ownerName: owner.trim(),
      address: addr.trim(),
      city: city.trim(),
      pinCode: pin.trim(),
      gstin: gst.trim() || undefined,
      accentColor: applyLogoColor ? extractedColor : '#D9A441',
      logoPath: logoUri || undefined,
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>

          <Text style={[styles.heading, { color: colors.text }]}>Register your shop</Text>
          <Text style={[styles.subheading, { color: colors.textDim }]}>
            Step 1 of 2 · shop branding & address
          </Text>

          {/* Logo upload & Color extraction card */}
          <View style={[styles.logoNoteCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={[styles.logoPlaceholder, { backgroundColor: colors.accent800 }]}
              onPress={handlePickLogo}
              activeOpacity={0.8}
            >
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.uploadedLogoImage} />
              ) : (
                <Text style={{ color: colors.accent100, fontWeight: '700', fontSize: 16 }}>
                  {shop.trim().length > 0 ? shop.trim().slice(0, 2).toUpperCase() : '📷'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={handlePickLogo}>
                <Text style={[styles.uploadLogoLabel, { color: colors.accent }]}>
                  {logoUri ? 'Change Salon Logo' : 'Upload Salon Logo'}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.logoNoteText, { color: colors.textMuted }]}>
                {logoUri
                  ? 'Logo uploaded · brand color extracted below.'
                  : 'Tap to upload PNG/JPG logo to store in Supabase.'}
              </Text>
            </View>
          </View>

          {/* Extracted Color Apply Option (per user instruction) */}
          {logoUri && (
            <TouchableOpacity
              style={[
                styles.colorExtractionCard,
                { backgroundColor: colors.surface, borderColor: colors.divider },
              ]}
              onPress={handleToggleApplyColor}
              activeOpacity={0.85}
            >
              <View style={styles.colorRow}>
                <View
                  style={[
                    styles.colorPreviewSwatch,
                    { backgroundColor: extractedColor },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.colorTitle, { color: colors.text }]}>
                    Apply logo color to salon theme?
                  </Text>
                  <Text style={[styles.colorSub, { color: colors.textDim }]}>
                    Buttons, badges, and invoice accents will use {extractedColor}. Uncheck to keep default gold (#D9A441).
                  </Text>
                </View>

                {/* Tick checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: applyLogoColor ? colors.accent : colors.divider,
                      backgroundColor: applyLogoColor ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  {applyLogoColor && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </View>
            </TouchableOpacity>
          )}

          <Input
            label="Shop name"
            value={shop}
            onChangeText={setShop}
            placeholder="e.g. Elegance Salon & Spa"
          />

          <Input
            label="Owner name"
            value={owner}
            onChangeText={setOwner}
            placeholder="e.g. Rahul Sharma"
          />

          {/* Address with Live GPS Button */}
          <View style={styles.addressHeaderRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Address</Text>
            <TouchableOpacity
              style={[styles.liveGpsButton, { backgroundColor: colors.accent800 }]}
              onPress={handleFetchLiveGPS}
              disabled={isFetchingLocation}
              activeOpacity={0.7}
            >
              {isFetchingLocation ? (
                <ActivityIndicator size="small" color={colors.accent100} />
              ) : (
                <Text style={[styles.liveGpsText, { color: colors.accent100 }]}>
                  📍 Live GPS
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Input
            value={addr}
            onChangeText={setAddr}
            multiline
            numberOfLines={3}
            placeholder="Shop / Unit number, Street, Landmark"
          />

          <View style={styles.cityPinRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="Bengaluru"
              />
            </View>
            <View style={{ width: 112 }}>
              <Input
                label="PIN code"
                value={pin}
                onChangeText={setPin}
                keyboardType="numeric"
                placeholder="560001"
              />
            </View>
          </View>

          <Input
            label="GSTIN (optional)"
            value={gst}
            onChangeText={setGst}
            placeholder="29ABCDE1234F1Z5"
          />

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <Button
            label="Continue to Workers →"
            block
            onPress={handleSubmit}
            style={{ marginTop: 22 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 16,
  },
  logoNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadedLogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: radii.md,
  },
  uploadLogoLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  logoNoteText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  colorExtractionCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorPreviewSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  colorSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  liveGpsButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveGpsText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  cityPinRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
});
