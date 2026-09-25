import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { BackIcon } from '../../components/common/SvgIcons';
import { radii } from '../../theme/spacing';

interface OtpScreenProps {
  phone: string;
  onVerify: (otp: string) => void;
  onBack: () => void;
}

export const OtpScreen = ({ phone, onVerify, onBack }: OtpScreenProps) => {
  const { colors } = useTheme();
  const [otp, setOtp] = useState('');

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      setOtp((prev) => prev.slice(0, -1));
    } else if (key !== '') {
      if (otp.length < 6) {
        const next = (otp + key).slice(0, 6);
        setOtp(next);
        if (next.length === 6) {
          onVerify(next);
        }
      }
    }
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  const otpHint =
    otp.length < 6
      ? 'Enter 6-digit verification code'
      : 'Code entered · ready to verify';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>

        <Text style={[styles.heading, { color: colors.text }]}>Enter the code</Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          6-digit OTP sent to +91 {phone}
        </Text>

        {/* 6 visible OTP boxes */}
        <View style={styles.boxesRow}>
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const digit = otp[idx] || '';
            const isActive = otp.length === idx;
            return (
              <View
                key={idx}
                style={[
                  styles.box,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isActive ? colors.accent : colors.divider,
                  },
                ]}
              >
                <Text style={[styles.boxText, { color: colors.text }]}>{digit}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[styles.hintText, { color: colors.textDim }]}>{otpHint}</Text>

        <Button
          label="Verify & continue"
          block
          disabled={otp.length < 6}
          onPress={() => onVerify(otp)}
          style={{ marginBottom: 20 }}
        />

        {/* Numeric keypad */}
        <View style={styles.keypadGrid}>
          {keypad.map((k, index) => {
            const isEmpty = k === '';
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={isEmpty ? 1 : 0.7}
                disabled={isEmpty}
                onPress={() => handleKeyPress(k)}
                style={[
                  styles.keyButton,
                  {
                    backgroundColor: isEmpty ? 'transparent' : colors.surface,
                    borderColor: isEmpty ? 'transparent' : colors.divider,
                  },
                ]}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{k}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 22,
  },
  boxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  box: {
    flex: 1,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: {
    fontSize: 22,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    marginBottom: 18,
  },
  keypadGrid: {
    marginTop: 'auto',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  keyButton: {
    width: '31%',
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 19,
    fontWeight: '500',
  },
});
