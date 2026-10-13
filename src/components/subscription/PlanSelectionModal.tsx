import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, radii } from '../../theme/spacing';
import { useLanguage } from '../../i18n/LanguageContext';
import { fmt, localeFor } from '../../i18n/format';
import {
  PlanId,
  SubscriptionPlanConfig,
  calculateSavingsPercent,
  calculateSavingsRupees,
  formatPriceInRupees,
  getSubscriptionPlans,
} from '../../config/planConfig';
import {
  isWithinFirst30DaysOfRegistration,
  getRemainingLaunchOfferDays,
  getLaunchOfferEndDate,
} from '../../utils/subscriptionUtils';
import { shopRepository } from '../../repositories/shopRepository';
import { supportRepository } from '../../repositories/supportRepository';
import { SparklesIcon, WhatsAppIcon, PhoneCallIcon } from '../common/SvgIcons';

interface PlanSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  shopId: string;
  ownerName: string;
  phone: string;
  initialPlanId?: PlanId;
  onPlanActivated: (planId: PlanId) => void;
  registrationDateIso?: string | null;
}

export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({
  visible,
  onClose,
  shopId,
  ownerName,
  phone,
  initialPlanId,
  onPlanActivated,
  registrationDateIso,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();

  const [resolvedRegDate, setResolvedRegDate] = useState<string | null>(registrationDateIso || null);

  useEffect(() => {
    if (registrationDateIso) {
      setResolvedRegDate(registrationDateIso);
    } else {
      shopRepository.getCachedShop().then((shop) => {
        if (shop?.created_at) {
          setResolvedRegDate(shop.created_at);
        }
      }).catch(() => {});
    }
  }, [registrationDateIso, visible]);

  const isLaunchOfferActive = useMemo(() => {
    return isWithinFirst30DaysOfRegistration(resolvedRegDate);
  }, [resolvedRegDate]);

  const remainingLaunchDays = useMemo(() => {
    return getRemainingLaunchOfferDays(resolvedRegDate);
  }, [resolvedRegDate]);

  const activePlans = useMemo(() => {
    return getSubscriptionPlans(isLaunchOfferActive);
  }, [isLaunchOfferActive]);

  // Default to initialPlanId or the 6-Month plan
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(initialPlanId || '6_months');

  useEffect(() => {
    if (initialPlanId) {
      setSelectedPlanId(initialPlanId);
    }
  }, [initialPlanId, visible]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userNote, setUserNote] = useState('');

  const selectedPlan =
    activePlans.find((p) => p.id === selectedPlanId) || activePlans[0];

  const handleOpenWhatsAppSupport = () => {
    const supportPhone = '918903368006';
    const formattedPrice = formatPriceInRupees(selectedPlan.priceInRupees);
    const msg = `Hi StyleFleet Team, I would like to upgrade my salon to the ${selectedPlan.name} (${formattedPrice}). Shop ID: ${shopId}. Please guide me on activation.`;
    Linking.openURL(`https://wa.me/${supportPhone}?text=${encodeURIComponent(msg)}`).catch(() => {});
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:8903368006').catch(() => {});
  };

  const handleProceedUpgrade = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const formattedPrice = formatPriceInRupees(selectedPlan.priceInRupees);
      const upgradeMessage = [
        `Plan Upgrade Request: ${selectedPlan.name} (${formattedPrice} for ${selectedPlan.durationMonths} months).`,
        `Shop ID: ${shopId}`,
        `Salon / Owner: ${ownerName || 'Salon Owner'}`,
        `Contact Phone: ${phone || 'Not provided'}`,
        userNote.trim() ? `User Note / Request: "${userNote.trim()}"` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await supportRepository.submitSupportMessage({
        shop_id: shopId,
        message: upgradeMessage,
        contact_info: phone ? `${phone} (${ownerName || 'Owner'})` : ownerName || 'Salon Owner',
        status: 'open',
      });

      const cleanPhone = phone || 'your registered phone number';

      Alert.alert(
        'Upgrade Request Submitted',
        `Your request for ${selectedPlan.name} (${formattedPrice}) has been sent to StyleFleet Support.\n\nOur team will review your account and contact you at ${cleanPhone} shortly to activate your salon.`,
        [
          {
            text: 'Chat on WhatsApp',
            onPress: () => {
              onClose();
              const supportPhone = '918903368006';
              const msg = `Hi StyleFleet Team, I requested an upgrade to the ${selectedPlan.name} (${formattedPrice}). Shop ID: ${shopId}. Please assist with activation for my salon.`;
              Linking.openURL(`https://wa.me/${supportPhone}?text=${encodeURIComponent(msg)}`).catch(() => {});
            },
          },
          {
            text: 'OK',
            onPress: onClose,
            style: 'default',
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Request Notice',
        err.message || 'Unable to submit upgrade request. Please try again or contact support.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const offerEndDate = useMemo(() => getLaunchOfferEndDate(resolvedRegDate), [resolvedRegDate]);
  const offerEndText = offerEndDate
    ? offerEndDate.toLocaleDateString(localeFor(language), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';
  const daysLeftText =
    remainingLaunchDays <= 0
      ? t('plOfferEndsToday', 'Ends today')
      : remainingLaunchDays === 1
      ? fmt(t('plOfferDayLeft', '{n} day left'), { n: remainingLaunchDays })
      : fmt(t('plOfferDaysLeft', '{n} days left'), { n: remainingLaunchDays });

  const monthlyOf = (p: SubscriptionPlanConfig) => Math.round(p.price / p.durationMonths);
  const selectedSavings = calculateSavingsRupees(selectedPlan);

  return (
    <>
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
              <View style={{ flex: 1 }}>
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

            <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {/* Launch offer banner, or the plain "regular price" note once the offer is over */}
              {isLaunchOfferActive ? (
                <View
                  style={[
                    styles.offerBanner,
                    { backgroundColor: colors.surface, borderColor: colors.accent },
                  ]}
                >
                  <View style={styles.offerBannerTop}>
                    <View style={styles.offerBannerTitleRow}>
                      <SparklesIcon size={16} color={colors.accent} />
                      <Text style={[styles.offerBannerTitle, { color: colors.accent }]}>
                        {t('plLaunchTitle', 'Launch offer')}
                      </Text>
                    </View>
                    <View style={[styles.daysLeftPill, { backgroundColor: colors.accent }]}>
                      <Text style={styles.daysLeftText}>{daysLeftText}</Text>
                    </View>
                  </View>
                  {offerEndText ? (
                    <Text style={[styles.offerEndsOn, { color: colors.text }]}>
                      {fmt(t('plOfferEndsOn', 'Offer ends on {date}'), { date: offerEndText })}
                    </Text>
                  ) : null}
                  <Text style={[styles.offerNote, { color: colors.textMuted }]}>
                    {t('plOfferNote', 'This offer is only for the first 30 days after you registered.')}
                  </Text>
                </View>
              ) : (
                <View style={[styles.regularNote, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                  <Text style={[styles.offerNote, { color: colors.textMuted }]}>
                    {t('plRegularNote', 'The 30-day launch offer has ended for your salon. Regular prices apply.')}
                  </Text>
                </View>
              )}

              {/* Plan cards */}
              {activePlans.map((plan: SubscriptionPlanConfig) => {
                const isSelected = plan.id === selectedPlanId;
                const savings = calculateSavingsRupees(plan);
                const percent = calculateSavingsPercent(plan);
                const badgeText =
                  savings > 0
                    ? plan.isBestValue
                      ? `${t('plBestValue', 'BEST VALUE')} · ${fmt(t('plSavePercent', 'Save {n}%'), { n: percent })}`
                      : fmt(t('plSavePercent', 'Save {n}%'), { n: percent })
                    : null;

                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.9}
                    onPress={() => setSelectedPlanId(plan.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.planCard,
                      {
                        backgroundColor: isSelected ? colors.accent900 : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.divider,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    {badgeText && (
                      <View
                        style={[
                          styles.badgeTag,
                          { backgroundColor: plan.isBestValue ? colors.accent : '#22C55E' },
                        ]}
                      >
                        <Text style={styles.badgeText} numberOfLines={1}>
                          {badgeText}
                        </Text>
                      </View>
                    )}

                    <View style={styles.cardTop}>
                      <View
                        style={[styles.radioOuter, { borderColor: isSelected ? colors.accent : colors.divider }]}
                      >
                        {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
                      </View>

                      <View style={styles.planTitleContainer}>
                        <Text style={[styles.planName, { color: colors.text }]}>
                          {fmt(t('plMonths', '{n} Months'), { n: plan.durationMonths })}
                        </Text>
                        <Text style={[styles.planSubMuted, { color: colors.textMuted }]}>
                          {fmt(t('plAccessDays', '{n} days of access'), { n: plan.durationDays })}
                        </Text>
                      </View>

                      <View style={styles.priceContainer}>
                        <Text style={[styles.planPrice, { color: colors.text }]}>
                          {formatPriceInRupees(plan.priceInRupees)}
                        </Text>
                        {savings > 0 && (
                          <Text style={[styles.originalPrice, { color: colors.textDim }]}>
                            {formatPriceInRupees(plan.originalPrice)}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[styles.cardBottom, { borderTopColor: colors.divider }]}>
                      <Text style={[styles.perMonth, { color: colors.textMuted }]}>
                        {fmt(t('plPerMonth', '{amt} / month'), { amt: formatPriceInRupees(monthlyOf(plan)) })}
                      </Text>
                      {savings > 0 ? (
                        <View style={styles.savePill}>
                          <Text style={styles.savePillText}>
                            {fmt(t('plSaveAmount', 'You save {amt}'), { amt: formatPriceInRupees(savings) })}
                          </Text>
                        </View>
                      ) : isLaunchOfferActive ? (
                        <Text style={[styles.noOffer, { color: colors.textDim }]}>{t('plNoOffer', 'No offer')}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* What every plan includes, once, instead of repeating it on each card */}
              <View style={[styles.includesCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <Text style={[styles.includesTitle, { color: colors.textDim }]}>
                  {t('plIncludes', 'Every plan includes')}
                </Text>
                {[
                  t('unlimitedBillGen', 'Unlimited Bill Generation'),
                  t('unlimitedReports', 'Unlimited Report Downloads (PDF & Excel)'),
                  t('teamAndAccounts', 'Team Management & Stylist Commissions'),
                ].map((line) => (
                  <View key={line} style={styles.includeRow}>
                    <Text style={[styles.includeTick, { color: colors.accent }]}>✓</Text>
                    <Text style={[styles.includeText, { color: colors.text }]}>{line}</Text>
                  </View>
                ))}
              </View>

              {/* Message / Note for Support */}
              <View style={[styles.noteBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <Text style={[styles.noteLabel, { color: colors.textMuted }]}>
                  {t('upgradeNoteLabel', 'Message / Note for Support (Optional)')}
                </Text>
                <TextInput
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder={t('upgradeNotePlaceholder', "e.g., 'This was needed', 'Please call after 4 PM'")}
                  placeholderTextColor={colors.textDim}
                  value={userNote}
                  onChangeText={setUserNote}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* StyleFleet Salon Support Desk Direct Contacts */}
              <View style={[styles.supportContactCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.supportContactHeader}>
                  <Text style={[styles.supportContactTitle, { color: colors.text }]}>
                    StyleFleet Salon Support Desk
                  </Text>
                  <Text style={[styles.supportContactSub, { color: colors.textMuted }]}>
                    Need assistance or have questions about subscription plans?
                  </Text>
                </View>
                <View style={styles.supportActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleOpenWhatsAppSupport}
                    style={[styles.supportActionBtn, { backgroundColor: 'rgba(37, 211, 102, 0.12)', borderColor: '#25D366' }]}
                  >
                    <WhatsAppIcon size={16} color="#25D366" />
                    <Text style={[styles.supportActionBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCallSupport}
                    style={[styles.supportActionBtn, { backgroundColor: 'rgba(217, 164, 65, 0.12)', borderColor: colors.accent }]}
                  >
                    <PhoneCallIcon size={16} color={colors.accent} />
                    <Text style={[styles.supportActionBtnText, { color: colors.accent }]}>Call Team</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Footer: solid, always visible */}
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
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                    {t('plTotal', 'Total')} · {fmt(t('plMonths', '{n} Months'), { n: selectedPlan.durationMonths })}
                  </Text>
                  <Text style={[styles.summaryTotal, { color: colors.text }]}>
                    {formatPriceInRupees(selectedPlan.priceInRupees)}
                  </Text>
                  {selectedSavings > 0 && (
                    <Text style={styles.summarySave}>
                      {fmt(t('plYouSaveTotal', 'You save {amt} with this plan'), {
                        amt: formatPriceInRupees(selectedSavings),
                      })}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={isProcessing}
                  onPress={handleProceedUpgrade}
                  style={[
                    styles.payButton,
                    {
                      backgroundColor: colors.accent,
                      opacity: isProcessing ? 0.7 : 1,
                    },
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#0D0F14" size="small" />
                  ) : (
                    <Text style={styles.payButtonText}>{t('proceedToUpgrade', 'Proceed to Upgrade')} →</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Concierge Activation Badge */}
              <View style={styles.trustBadgeContainer}>
                <Text style={[styles.trustBadgeText, { color: colors.textDim }]}>
                  💬 StyleFleet Salon Concierge Support & Manual Activation
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    maxHeight: '92%',
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
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  pendingTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  verifyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  verifyButtonText: {
    color: '#0D0F14',
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  offerBanner: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: 6,
  },
  offerBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  offerBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  offerBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  daysLeftPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysLeftText: {
    color: '#0D0F14',
    fontSize: 12,
    fontWeight: '800',
  },
  offerEndsOn: {
    fontSize: 14,
    fontWeight: '700',
  },
  offerNote: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  regularNote: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  planCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  badgeTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    maxWidth: '70%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: radii.sm,
  },
  badgeText: {
    color: '#0D0F14',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  planTitleContainer: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '800',
  },
  planSubMuted: {
    fontSize: 12,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  originalPrice: {
    fontSize: 13,
    marginTop: 1,
    textDecorationLine: 'line-through',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  perMonth: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  savePill: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  savePillText: {
    color: '#22C55E',
    fontSize: 13.5,
    fontWeight: '800',
  },
  noOffer: {
    fontSize: 13,
    fontWeight: '600',
  },
  includesCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 8,
  },
  includesTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  includeTick: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  includeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12.5,
  },
  summaryTotal: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summarySave: {
    color: '#22C55E',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 1,
  },
  payButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#0D0F14',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  trustBadgeContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  noteBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 13,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  supportContactCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 10,
  },
  supportContactHeader: {
    gap: 2,
  },
  supportContactTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  supportContactSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  supportActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  supportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  supportActionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
