import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radii } from '../../theme/spacing';
import { useLanguage } from '../../i18n/LanguageContext';
import { subscriptionRepository, SubscriptionInfo } from '../../repositories/subscriptionRepository';
import { PlanSelectionModal } from './PlanSelectionModal';
import { SubscriptionPlanConfig } from '../../config/planConfig';

interface ManagePlansCardProps {
  shopId: string;
  ownerName: string;
  phone: string;
  userId?: string;
  onProceedPlan: (plan: SubscriptionPlanConfig) => void;
}

export const ManagePlansCard: React.FC<ManagePlansCardProps> = ({
  shopId,
  ownerName,
  phone,
  userId,
  onProceedPlan,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await subscriptionRepository.getSubscriptionInfo(shopId, userId);
      setSubInfo(info);
    } catch {
      // Handled inside repository
    } finally {
      setLoading(false);
    }
  }, [shopId, userId]);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [loadSubscriptionInfo]);

  if (loading && !subInfo) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: colors.divider,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: spacing.xl,
          },
        ]}
      >
        <ActivityIndicator color={colors.accent} size="small" />
      </View>
    );
  }

  // Derive display values based on active subscription vs trial
  const isPaid = subInfo?.type === 'subscription' && subInfo.subscription;
  const trial = subInfo?.trial;
  const sub = subInfo?.subscription;

  // Card theme styling
  let badgeText = t('freeTrialBadge', '30-Day Free Trial');
  let badgeBg = 'rgba(217, 164, 65, 0.15)';
  let badgeColor = colors.accent;
  let cardBorderColor = colors.divider;
  let progressBarColor = colors.accent;
  let title = t('freeTrial', 'Free Trial');
  let subtitle = trial?.displaySubtitle || '';
  let buttonLabel = t('viewPlans', 'View Plans');

  if (isPaid && sub) {
    badgeText = t('activePlan', 'Premium Active');
    badgeBg = 'rgba(34, 197, 94, 0.15)';
    badgeColor = '#22C55E';
    title = sub.planName;
    subtitle = `${t('validTill', 'Valid till')} ${sub.endDateFormatted} · ${sub.remainingDays} ${t('daysRemaining', 'days remaining')}`;
    progressBarColor = '#22C55E';
    buttonLabel = t('managePlan', 'Change Plan');
  } else if (trial) {
    if (trial.isExpired) {
      badgeText = t('expired', 'Trial Ended');
      badgeBg = 'rgba(239, 68, 68, 0.15)';
      badgeColor = '#EF4444';
      cardBorderColor = '#EF4444';
      progressBarColor = '#EF4444';
      title = t('trialExpiredTitle', 'Free Trial Expired');
      subtitle = t('subscribeToUnlock', 'Subscribe to unlock unlimited bills & features');
      buttonLabel = t('upgradeNow', 'Upgrade Now');
    } else if (trial.isExpiringSoon) {
      badgeText = `${trial.remainingDays} ${t('daysLeft', 'Days Left')}`;
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      badgeColor = '#F59E0B';
      cardBorderColor = '#F59E0B';
      progressBarColor = '#F59E0B';
      title = t('trialEndingSoon', 'Trial Ending Soon');
      buttonLabel = t('upgradeNow', 'Upgrade Now');
    }
  }

  const progressVal = isPaid ? sub?.progress || 0.1 : trial?.progress || 0.05;

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: cardBorderColor,
          },
        ]}
      >
        <View style={styles.topRow}>
          {/* Status Badge */}
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
          </View>

          {/* Upgrade / Manage Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowModal(true)}
            style={[styles.actionBtn, { borderColor: colors.accent }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.accent }]}>
              {buttonLabel} →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title & Description */}
        <View style={styles.infoContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.bg }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(100, Math.max(5, progressVal * 100))}%`,
                backgroundColor: progressBarColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Plan Selection Modal */}
      {showModal && (
        <PlanSelectionModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          shopId={shopId}
          ownerName={ownerName}
          phone={phone}
          onProceedPlan={(plan) => {
            setShowModal(false);
            onProceedPlan(plan);
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionBtn: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoContainer: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
});
