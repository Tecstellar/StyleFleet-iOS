import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Period, Bill } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inrFromMinor, shortInrFromMinor } from '../../utils/format';
import { PlusIcon } from '../../components/common/SvgIcons';
import { radii, shadows } from '../../theme/spacing';

interface SalesScreenProps {
  bills: Bill[];
  shopName?: string;
  onOpenInvoice: (bill: Bill) => void;
  onNewBill: () => void;
}

export const SalesScreen = ({
  bills,
  shopName = 'Salon',
  onOpenInvoice,
  onNewBill,
}: SalesScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');

  const metrics = financialService.getSalesMetrics(period, bills);
  const deltaPct =
    metrics.prev_minor > 0
      ? Math.round((Math.abs(metrics.total_minor - metrics.prev_minor) / metrics.prev_minor) * 100)
      : 0;
  const isUp = metrics.total_minor >= metrics.prev_minor;
  const deltaLabel = metrics.prev_minor > 0
    ? `${isUp ? '▲ ' : '▼ '}${deltaPct}% ${t('vsLast', 'vs last')} ${t(period.toLowerCase(), period)}`
    : '0% change';

  const todayHeaderStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('sales', 'Sales')}</Text>
          <Text style={[styles.todayLabel, { color: colors.textDim }]}>
            {todayHeaderStr}
          </Text>
        </View>

        {/* Period Selector Tabs */}
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
                  {t(p.toLowerCase(), p)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Total & Delta */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {inrFromMinor(metrics.total_minor)}
          </Text>
          <Text
            style={[
              styles.deltaText,
              { color: isUp ? colors.accent : colors.neutral400 },
            ]}
          >
            {deltaLabel}
          </Text>
        </View>
        <Text style={[styles.subLabel, { color: colors.textDim }]}>
          {metrics.sub_label}
        </Text>

        {/* Bar Chart */}
        <View style={styles.chartContainer}>
          {metrics.bars.map((bar, i) => {
            const isTodayOrNow = bar.label === 'Today' || bar.label.includes('Now');
            const hasSales = bar.amt_minor > 0;
            return (
              <View key={i} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.round((bar.height_pct / 100) * 72) + 4,
                      backgroundColor: hasSales
                        ? colors.accent
                        : isTodayOrNow
                        ? colors.accent800
                        : 'rgba(255,255,255,0.08)',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.barLabel,
                    {
                      color: isTodayOrNow ? colors.accent : colors.textDim,
                      fontWeight: isTodayOrNow ? '700' : '400',
                    },
                  ]}
                >
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 2-Column Info Grid */}
        <View style={styles.metricsGrid}>
          {/* Collected via */}
          <View style={[styles.metricCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
              COLLECTED VIA
            </Text>
            {metrics.modes.map((m, idx) => (
              <View key={idx} style={styles.modeRow}>
                <Text style={[styles.modeLabel, { color: colors.text }]}>{m.label}</Text>
                <View
                  style={[
                    styles.modeProgressBar,
                    { backgroundColor: 'rgba(255,255,255,0.12)' },
                  ]}
                >
                  <View
                    style={[
                      styles.modeProgressFill,
                      { width: `${m.pct}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[styles.modeAmount, { color: colors.textMuted }]}>
                  {shortInrFromMinor(m.amt_minor)}
                </Text>
              </View>
            ))}
          </View>

          {/* Bills count & Top service */}
          <View style={styles.metricCardColumn}>
            <View style={[styles.metricCardSmall, { backgroundColor: colors.surface }]}>
              <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
                BILLS
              </Text>
              <Text style={[styles.billsCountText, { color: colors.text }]}>
                {metrics.bills_count}
              </Text>
              <Text style={[styles.avgBillText, { color: colors.textDim }]}>
                avg {inrFromMinor(metrics.avg_bill_minor)}
              </Text>
            </View>

            <View style={[styles.metricCardSmall, { backgroundColor: colors.surface }]}>
              <Text style={[styles.metricCardLabel, { color: colors.textDim }]}>
                TOP SERVICE
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.topServiceText, { color: colors.text }]}
              >
                {metrics.top_service}
              </Text>
            </View>
          </View>
        </View>

        {/* Bills list */}
        <View style={styles.billsListHeader}>
          <Text style={[styles.billsListTitle, { color: colors.accent }]}>
            {t('recentBills', 'Recent Bills')}
          </Text>
          <Text style={[styles.billsListSub, { color: colors.textSubtle }]}>
            tap to view invoice
          </Text>
        </View>

        <View style={styles.billsList}>
          {bills.length === 0 ? (
            <View style={styles.emptyBillsBox}>
              <Text style={[styles.emptyBillsTitle, { color: colors.text }]}>
                {t('noBillsYet', 'No bills recorded yet')}
              </Text>
              <Text style={[styles.emptyBillsSub, { color: colors.textDim }]}>
                {t('tapNewBill', 'Tap "+ New bill" below to record your first client service and payment.')}
              </Text>
            </View>
          ) : (
            bills.map((b) => (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.7}
                onPress={() => onOpenInvoice(b)}
                style={[
                  styles.billRow,
                  { borderBottomColor: colors.divider },
                ]}
              >
                <Text style={[styles.billTime, { color: colors.textDim }]}>
                  {b.issued_at}
                </Text>
                <View style={styles.billMain}>
                  <Text style={[styles.billCust, { color: colors.text }]}>
                    {b.customer_name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.billWhat, { color: colors.textDim }]}
                  >
                    {b.items.map((it) => it.service_name_snapshot).join(', ')} ·{' '}
                    {b.staff_name}
                  </Text>
                </View>
                <View style={styles.billRight}>
                  <Text style={[styles.billAmt, { color: colors.text }]}>
                    {inrFromMinor(b.total_minor)}
                  </Text>
                  <Text style={[styles.billMode, { color: colors.textDim }]}>
                    {b.payment_method}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onNewBill}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent800,
            borderColor: colors.accent,
          },
        ]}
      >
        <PlusIcon size={18} color={colors.accent100} />
        <Text style={[styles.fabText, { color: colors.accent100 }]}>
          {t('newBill', 'New bill')}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.4,
  },
  todayLabel: {
    marginLeft: 'auto',
    fontSize: 12,
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
    fontSize: 12.5,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  totalAmount: {
    fontSize: 34,
    fontWeight: '500',
    letterSpacing: -0.6,
  },
  deltaText: {
    fontSize: 12,
    paddingBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 86,
    marginTop: 18,
    marginBottom: 4,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    borderRadius: 3,
  },
  barLabel: {
    fontSize: 9.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14,
  },
  metricCard: {
    flex: 1,
    padding: 11,
    borderRadius: radii.md,
  },
  metricCardColumn: {
    flex: 1,
    gap: 8,
  },
  metricCardSmall: {
    padding: 11,
    borderRadius: radii.md,
  },
  metricCardLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.9,
    marginBottom: 7,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 5,
  },
  modeLabel: {
    flex: 1,
    fontSize: 12,
  },
  modeProgressBar: {
    width: 48,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  modeProgressFill: {
    height: '100%',
  },
  modeAmount: {
    fontSize: 11.5,
    width: 44,
    textAlign: 'right',
  },
  billsCountText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 2,
  },
  avgBillText: {
    fontSize: 11,
  },
  topServiceText: {
    fontSize: 13.5,
    marginTop: 3,
  },
  billsListHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  billsListTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  billsListSub: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  billsList: {},
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  billTime: {
    width: 44,
    fontSize: 11,
  },
  billMain: {
    flex: 1,
    minWidth: 0,
  },
  billCust: {
    fontSize: 14,
  },
  billWhat: {
    fontSize: 11.5,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmt: {
    fontSize: 14,
  },
  billMode: {
    fontSize: 10,
    marginTop: 2,
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
  emptyBillsBox: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyBillsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyBillsSub: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
