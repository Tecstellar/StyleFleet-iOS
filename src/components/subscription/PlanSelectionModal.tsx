import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radii } from '../../theme/spacing';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  SUBSCRIPTION_PLANS,
  PlanId,
  SubscriptionPlanConfig,
  formatPriceInRupees,
} from '../../config/planConfig';

interface PlanSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  ownerName: string;
  phone: string;
  onProceedPlan: (plan: SubscriptionPlanConfig) => void;
}

export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({
  visible,
  onClose,
  onProceedPlan,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Default to the 6-Month Most Popular plan
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('6_months');

  const selectedPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId) || SUBSCRIPTION_PLANS[0];

  const handleProceed = () => {
    onProceedPlan(selectedPlan);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.bg,
              borderColor: colors.divider,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('choosePlan', 'Choose a Plan')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('selectSubscriptionPlan', 'Select a subscription plan for your salon')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeButton, { backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Plan Cards List */}
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {SUBSCRIPTION_PLANS.map((plan: SubscriptionPlanConfig) => {
              const isSelected = plan.id === selectedPlanId;
              const hasBadge = !!plan.badge;

              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedPlanId(plan.id)}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isSelected ? colors.accent : colors.divider,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  {/* Badge */}
                  {hasBadge && (
                    <View
                      style={[
                        styles.badgeTag,
                        {
                          backgroundColor:
                            plan.id === '12_months' ? '#22C55E' : colors.accent,
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>{plan.badge}</Text>
                    </View>
                  )}

                  <View style={styles.cardHeader}>
                    {/* Radio Indicator */}
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: isSelected ? colors.accent : colors.divider },
                      ]}
                    >
                      {isSelected && (
                        <View
                          style={[styles.radioInner, { backgroundColor: colors.accent }]}
                        />
                      )}
                    </View>

                    {/* Plan Duration, Per-Day Rate & Monthly Rate */}
                    <View style={styles.planTitleContainer}>
                      <Text style={[styles.planName, { color: colors.text }]}>
                        {plan.name}
                      </Text>
                      <Text style={[styles.planSub, { color: colors.accent, fontWeight: '700' }]}>
                        {plan.perDayDisplay}
                      </Text>
                      <Text style={[styles.planSubMuted, { color: colors.textMuted }]}>
                        ₹{Math.round(plan.effectiveMonthlyRateMinor / 100)} / {t('month', 'month')}
                      </Text>
                    </View>

                    {/* Total Price */}
                    <View style={styles.priceContainer}>
                      <Text style={[styles.planPrice, { color: colors.text }]}>
                        {formatPriceInRupees(plan.priceInRupees)}
                      </Text>
                      {plan.discountPercent > 0 && (
                        <View style={styles.savingsPill}>
                          <Text style={styles.savingsPillText}>
                            {t('savePercent', 'Save')} {plan.discountPercent}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Bullet features */}
                  <View style={[styles.featuresRow, { borderTopColor: colors.divider }]}>
                    <Text style={[styles.featureBullet, { color: colors.textMuted }]}>
                      ✓ {t('unlimitedBilling', 'Unlimited Invoices & WhatsApp PDF')}
                    </Text>
                    <Text style={[styles.featureBullet, { color: colors.textMuted }]}>
                      ✓ {t('teamAndAccounts', 'Team Management & Stylist Commissions')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer with Proceed CTA */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.divider,
              },
            ]}
          >
            <View style={styles.summaryRow}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  {selectedPlan.name} ({selectedPlan.durationDays} days)
                </Text>
                <Text style={[styles.summaryTotal, { color: colors.text }]}>
                  {formatPriceInRupees(selectedPlan.priceInRupees)}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleProceed}
                style={[
                  styles.payButton,
                  {
                    backgroundColor: colors.accent,
                  },
                ]}
              >
                <Text style={styles.payButtonText}>
                  {t('proceed', 'Proceed')} →
                </Text>
              </TouchableOpacity>
            </View>

            {/* Assistance note */}
            <View style={styles.trustBadgeContainer}>
              <Text style={[styles.trustBadgeText, { color: colors.textDim }]}>
                💬 {t('supportAssistedActivation', 'Direct inquiry sent to StyleFleet Desk for instant plan activation')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  planCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderBottomLeftRadius: radii.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D0F14',
    letterSpacing: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planTitleContainer: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  planSub: {
    fontSize: 13,
    marginTop: 2,
  },
  planSubMuted: {
    fontSize: 11,
    marginTop: 1,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  savingsPill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 3,
  },
  savingsPillText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '700',
  },
  featuresRow: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    gap: 4,
  },
  featureBullet: {
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: '800',
  },
  payButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#0D0F14',
    fontSize: 15,
    fontWeight: '700',
  },
  trustBadgeContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  trustBadgeText: {
    fontSize: 11,
    textAlign: 'center',
  },
});
