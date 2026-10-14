import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { spacing, radii } from '../../theme/spacing';
import { SparklesIcon } from './SvgIcons';
import { otaUpdateService, OtaProgressStatus } from '../../services/otaUpdateService';

interface OtaUpdateModalProps {
  visible: boolean;
  onClose?: () => void;
}

export const OtaUpdateModal: React.FC<OtaUpdateModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [status, setStatus] = useState<OtaProgressStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!visible) return null;

  const isBusy = status === 'downloading' || status === 'restarting';

  const handleUpdatePress = async () => {
    if (isBusy) return;

    setErrorMessage(null);
    setStatus('downloading');

    const result = await otaUpdateService.fetchAndReloadOtaUpdate((newStatus, msg) => {
      setStatus(newStatus);
      if (newStatus === 'error' && msg) {
        setErrorMessage(msg);
      }
    });

    if (!result.success && result.error) {
      setStatus('error');
      setErrorMessage(result.error);
    }
  };

  const getButtonLabel = () => {
    if (status === 'downloading') {
      return t('downloadingUpdate', 'Downloading update...');
    }
    if (status === 'restarting') {
      return t('restartingApp', 'Restarting app...');
    }
    if (status === 'error') {
      return t('retryUpdate', 'Retry Update');
    }
    return t('updateNow', 'Update Now');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        // Prevent accidental dismiss while downloading, but allow closing if not busy
        if (!isBusy && onClose) {
          onClose();
        }
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.85)" />
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: `${colors.accent}1F`,
                borderColor: colors.accent,
              },
            ]}
          >
            <SparklesIcon size={30} color={colors.accent} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {t('otaUpdateTitle', 'Update Available')}
          </Text>

          {/* Subtitle / Description */}
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t(
              'otaUpdateSub',
              'A new update is available for StyleFleet. Please continue to update the app to ensure uninterrupted salon operations and the latest features.'
            )}
          </Text>

          {/* Error Notice (if any) */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                },
              ]}
            >
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.accent,
                opacity: isBusy ? 0.85 : 1,
              },
            ]}
            onPress={handleUpdatePress}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isBusy ? (
              <View style={styles.buttonLoadingRow}>
                <ActivityIndicator color="#0D0F14" size="small" />
                <Text style={styles.primaryButtonText}>{getButtonLabel()}</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>{getButtonLabel()} →</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Dismiss Button (Ensures the user is never stuck if network is down) */}
          {onClose && !isBusy ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textDim }]}>
                {t('remindLater', 'Remind Me Later')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  errorBox: {
    width: '100%',
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#0D0F14',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
