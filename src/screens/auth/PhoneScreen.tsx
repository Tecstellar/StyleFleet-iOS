import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { radii, spacing } from '../../theme/spacing';

interface PhoneScreenProps {
  onSendOtp: (phone: string) => void;
  onRegisterShop: () => void;
}

export const PhoneScreen = ({ onSendOtp, onRegisterShop }: PhoneScreenProps) => {
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');

  const handleSend = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      setError('Please enter a 10-digit mobile number');
      return;
    }
    if (!agreeToTerms) {
      setError('Please agree to the terms and policy of StyleFleet');
      return;
    }
    setError('');
    onSendOtp(phone);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={[styles.heading, { color: colors.text }]}>Sign in</Text>
          <Text style={[styles.subheading, { color: colors.textDim }]}>
            A 6-digit code goes to your shop's registered number.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Mobile number</Text>
            <View style={styles.phoneInputRow}>
              <View
                style={[
                  styles.countryCodeBadge,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>+91</Text>
              </View>
              <TextInput
                style={[
                  styles.phoneInput,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.surface,
                    color: colors.text,
                  },
                ]}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (error) setError('');
                }}
                keyboardType="numeric"
                placeholder="98450 62110"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
              />
            </View>

            {/* Terms and Policy Checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              activeOpacity={0.75}
              onPress={() => {
                setAgreeToTerms(!agreeToTerms);
                if (error) setError('');
              }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: agreeToTerms ? colors.accent : colors.divider,
                    backgroundColor: agreeToTerms ? colors.accent : colors.surface,
                  },
                ]}
              >
                {agreeToTerms && (
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>✓</Text>
                )}
              </View>
              <Text style={[styles.termsText, { color: colors.textMuted }]}>
                I agree to the <Text style={{ color: colors.accent, fontWeight: '600' }}>Terms and Policy</Text> of StyleFleet
              </Text>
            </TouchableOpacity>

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
          </View>

          <Button
            label="Send OTP"
            block
            onPress={handleSend}
            disabled={!agreeToTerms || phone.replace(/\D/g, '').length < 10}
            style={{ marginTop: 6 }}
          />

          <View style={styles.footer}>
            <View style={[styles.dividerLine, { backgroundColor: colors.divider }]} />
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.textDim }]}>New salon? </Text>
              <TouchableOpacity onPress={onRegisterShop}>
                <Text style={[styles.registerLink, { color: colors.accent }]}>
                  Register your shop
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 27,
    fontWeight: '500',
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 26,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBadge: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 11,
    marginTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    height: 1,
    width: '100%',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 12.5,
  },
  registerLink: {
    fontSize: 12.5,
    fontWeight: '500',
  },
});
