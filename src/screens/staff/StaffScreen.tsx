import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, PlusIcon } from '../../components/common/SvgIcons';
import { StaffMember, Period, Bill } from '../../types/domain';
import { inrFromMinor, shortInrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';

interface StaffScreenProps {
  staff: StaffMember[];
  bills?: Bill[];
  shopId?: string;
  onBack: () => void;
  onAddStaff?: (name: string, role: string, phone: string) => Promise<void>;
  onManage?: () => void;
}

export const StaffScreen = ({
  staff,
  bills = [],
  shopId,
  onBack,
  onAddStaff,
  onManage,
}: StaffScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');

  // Add Stylist Modal - Only name needed
  const [showAddModal, setShowAddModal] = useState(false);
  const [stylistName, setStylistName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Compute staff metrics for selected period (Day, Week, Month including Today)
  const staffWithPeriodMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const getTime = (created_at?: string): number => {
      if (created_at) {
        const t = new Date(created_at).getTime();
        if (!isNaN(t)) return t;
      }
      return now.getTime();
    };

    let startLimit = todayStart;
    if (period === 'Day') {
      startLimit = todayStart;
    } else if (period === 'Week') {
      startLimit = todayStart - 6 * 24 * 60 * 60 * 1000;
    } else {
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    const periodBills = bills.filter((b) => {
      const t = getTime(b.created_at);
      return t >= startLimit && t <= todayEnd;
    });

    return staff.map((s) => {
      const matchedBills = periodBills.filter(
        (b) => b.staff_id === s.id || (b.staff_name && b.staff_name.toLowerCase() === s.name.toLowerCase())
      );

      let revMinor = 0;
      let count = 0;
      for (const b of matchedBills) {
        revMinor += b.total_minor || 0;
        count += b.items ? b.items.length : 1;
      }

      // If no matched bills for this period, show 0 or default stats
      return {
        ...s,
        period_rev_minor: revMinor,
        period_service_count: count,
      };
    });
  }, [staff, bills, period]);

  const totalServices = staffWithPeriodMetrics.reduce((acc, s) => acc + s.period_service_count, 0);
  const totalRevenueMinor = staffWithPeriodMetrics.reduce((acc, s) => acc + s.period_rev_minor, 0);

  const handleSaveStylist = async () => {
    if (!stylistName.trim()) {
      Alert.alert('Name Required', 'Please enter stylist name');
      return;
    }

    setIsSaving(true);
    try {
      if (onAddStaff) {
        await onAddStaff(stylistName.trim(), 'Stylist', '');
      }
      setIsSaving(false);
      setShowAddModal(false);
      setStylistName('');
      Alert.alert('Stylist Added', `${stylistName.trim()} has been added to your salon team.`);
    } catch (e: any) {
      setIsSaving(false);
      Alert.alert('Notice', e.message || 'Could not save stylist');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <Text style={[styles.title, { color: colors.text }]}>{t('team')}</Text>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={{ marginLeft: 'auto' }}>
            <Text style={[styles.manageText, { color: colors.accent }]}>{t('addStylist')}</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector Tabs (Day, Week, Month including Today) */}
        <View style={[styles.periodTabsRow, { borderColor: colors.divider }]}>
          {(['Day', 'Week', 'Month'] as const).map((p) => {
            const isSelected = period === p;
            return (
              <TouchableOpacity
                key={p}
                activeOpacity={0.8}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodTab,
                  {
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    {
                      color: isSelected ? colors.accent : colors.textMuted,
                    },
                  ]}
                >
                  {p === 'Day' ? t('day') : p === 'Week' ? t('week') : t('month')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.summaryText, { color: colors.textDim }]}>
          {totalServices} services delivered · {inrFromMinor(totalRevenueMinor)} billed by team
        </Text>

        <View style={styles.list}>
          {staffWithPeriodMetrics.map((s, idx) => {
            const pct =
              s.target_amount_minor > 0
                ? Math.round((s.period_rev_minor / s.target_amount_minor) * 100)
                : 0;
            const pctClamped = Math.min(pct, 100);
            const isTop = idx === 0 && s.period_rev_minor > 0;

            const barFillColor =
              pct >= 100
                ? colors.accent
                : pct >= 70
                ? colors.accent600
                : colors.neutral600;

            return (
              <View
                key={s.id}
                style={[styles.staffCard, { backgroundColor: colors.surface }]}
              >
                {/* Header row */}
                <View style={styles.cardHeaderRow}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: colors.accent800 },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.accent100 }]}>
                      {getInitials(s.name)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.staffName, { color: colors.text }]}>
                        {s.name}
                      </Text>
                      {isTop ? (
                        <View
                          style={[
                            styles.topBadge,
                            { backgroundColor: colors.accent900 },
                          ]}
                        >
                          <Text style={[styles.topBadgeText, { color: colors.accent200 }]}>
                            Top
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.staffRole, { color: colors.textDim }]}>
                      {s.role} {s.phone ? `· +91 ${s.phone}` : ''}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.revenueText, { color: colors.text }]}>
                      {inrFromMinor(s.period_rev_minor)}
                    </Text>
                    <Text style={[styles.jobsText, { color: colors.textDim }]}>
                      {s.period_service_count} services
                    </Text>
                  </View>
                </View>

                {/* Target Progress Bar */}
                <View style={styles.targetSection}>
                  <View style={styles.targetLabelsRow}>
                    <Text style={[styles.targetLabel, { color: colors.textDim }]}>
                      Target {shortInrFromMinor(s.target_amount_minor)}
                    </Text>
                    <Text style={[styles.targetPct, { color: colors.textDim }]}>
                      {pct}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: 'rgba(255,255,255,0.1)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pctClamped}%`, backgroundColor: barFillColor },
                      ]}
                    />
                  </View>
                </View>

                {/* Metrics Row */}
                <View style={styles.metricsRow}>
                  <Text style={[styles.metricItem, { color: colors.textMuted }]}>
                    Rebook {s.rebook_rate}
                  </Text>
                  <Text style={[styles.metricItem, { color: colors.textMuted }]}>
                    Rating {s.rating}
                  </Text>
                  <Text style={[styles.metricItem, { color: colors.textMuted }]}>
                    Active
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Action Button for Add Stylist */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShowAddModal(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent800,
            borderColor: colors.accent,
          },
        ]}
      >
        <PlusIcon size={18} color={colors.accent100} />
        <Text style={[styles.fabText, { color: colors.accent100 }]}>{t('addStylist')}</Text>
      </TouchableOpacity>

      {/* Add Stylist Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowAddModal(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addStylist')}</Text>
                  <TouchableOpacity onPress={() => setShowAddModal(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginBottom: 16 },
                  ]}
                  placeholder={t('fullName')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={stylistName}
                  onChangeText={setStylistName}
                  autoFocus
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSaveStylist}
                  disabled={isSaving}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>
                      {t('save')}
                    </Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  manageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  periodTabsRow: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTabText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 90,
  },
  summaryText: {
    fontSize: 12,
    marginBottom: 12,
  },
  list: {
    gap: 9,
  },
  staffCard: {
    padding: 12,
    borderRadius: radii.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffName: {
    fontSize: 14.5,
  },
  topBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  topBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  staffRole: {
    fontSize: 11.5,
    marginTop: 2,
  },
  revenueText: {
    fontSize: 15,
    fontWeight: '500',
  },
  jobsText: {
    fontSize: 10.5,
    marginTop: 2,
  },
  targetSection: {
    marginTop: 11,
  },
  targetLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  targetLabel: {
    fontSize: 11,
  },
  targetPct: {
    fontSize: 11,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 10,
  },
  metricItem: {
    fontSize: 11.5,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadows.md,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '500',
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
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalAddBtn: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
