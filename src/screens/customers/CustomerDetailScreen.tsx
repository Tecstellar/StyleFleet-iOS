import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, StarIcon, ChatIcon } from '../../components/common/SvgIcons';
import { Customer, Bill } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';
import { CustomerManagerModal } from '../../components/customers/CustomerManagerModal';
import { SettleDueModal } from '../../components/customers/SettleDueModal';

interface CustomerDetailScreenProps {
  customer: Customer;
  bills?: Bill[];
  shopId?: string;
  onBack: () => void;
  onToggleStar: (customerId: string) => void;
  onStartBill: (customer: Customer) => void;
  onBookSlot: (customer: Customer) => void;
  onWhatsApp: (customer: Customer) => void;
  onSettleDue?: (customerId: string, method?: 'cash' | 'upi', amountMinor?: number) => void;
  onUpdateCustomer?: (customer: Customer) => void;
}

export const CustomerDetailScreen = ({
  customer,
  bills = [],
  shopId,
  onBack,
  onToggleStar,
  onStartBill,
  onBookSlot,
  onWhatsApp,
  onSettleDue,
  onUpdateCustomer,
}: CustomerDetailScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  const avgBill =
    customer.visits_count > 0
      ? Math.round(customer.lifetime_spend_minor / customer.visits_count)
      : 0;

  // Real visits from Supabase bills
  const customerBills = bills.filter((b) => b.customer_id === customer.id);
  const realVisits = customerBills.map((b) => {
    const d = new Date(b.issued_at || Date.now());
    const dateStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    const itemsSummary =
      b.items?.map((it) => it.service_name_snapshot).filter(Boolean).join(', ') ||
      'Salon Services';
    return {
      date: dateStr,
      what: itemsSummary,
      amtMinor: b.total_minor,
      status: b.status,
    };
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top bar with back, edit, and star */}
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={styles.editTopBtn}
            onPress={() => setIsEditModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>
              ✏️ {t('editProfile', 'Edit Profile')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.starButton}
            onPress={() => onToggleStar(customer.id)}
            activeOpacity={0.7}
          >
            <StarIcon
              size={20}
              color={customer.is_starred ? colors.accent : 'rgba(255,255,255,0.3)'}
              fill={customer.is_starred ? colors.accent : 'none'}
            />
          </TouchableOpacity>
        </View>

        {/* Customer Header Info */}
        <View style={styles.profileHeader}>
          <View
            style={[
              styles.avatarLarge,
              { backgroundColor: colors.accent800 },
            ]}
          >
            <Text style={[styles.avatarLargeText, { color: colors.accent100 }]}>
              {getInitials(customer.name)}
            </Text>
          </View>
          <View>
            <Text style={[styles.customerName, { color: colors.text }]}>
              {customer.name}
            </Text>
            <Text style={[styles.customerPhone, { color: colors.textDim }]}>
              +91 {customer.phone}
            </Text>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
          {customer.is_starred ? (
            <View
              style={[
                styles.tag,
                { backgroundColor: colors.accent900, borderColor: colors.accent },
              ]}
            >
              <Text style={{ color: colors.accent200, fontSize: 11, fontWeight: '500' }}>
                ★ MVP
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.tag,
                { backgroundColor: colors.surface, borderColor: colors.divider },
              ]}
            >
              <Text style={{ color: colors.textDim, fontSize: 11, fontWeight: '500' }}>
                Regular
              </Text>
            </View>
          )}

          <View
            style={[
              styles.tag,
              { backgroundColor: 'transparent', borderColor: colors.divider },
            ]}
          >
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
              {customer.visits_count > 15 ? 'Every 3 weeks' : 'Occasional'}
            </Text>
          </View>

          {customer.outstanding_due_minor > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsSettleModalOpen(true)}
              style={[
                styles.tag,
                { backgroundColor: colors.accent900, borderColor: colors.accent, paddingHorizontal: 10 },
              ]}
            >
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                Payment Due: {inrFromMinor(customer.outstanding_due_minor)}{customer.due_start_date ? ` (Since ${customer.due_start_date})` : ''} · Tap to Settle
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats 3-column grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>LIFETIME</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {inrFromMinor(customer.lifetime_spend_minor)}
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>VISITS</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {customer.visits_count}
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>AVG BILL</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {inrFromMinor(avgBill)}
            </Text>
          </View>
        </View>

        {/* Preferred Stylist & Note Card */}
        <View style={[styles.notesCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.stylistLabel, { color: colors.textDim }]}>
            Preferred stylist · {customer.preferred_stylist_name || 'Assigned Stylist'}
          </Text>
          <Text style={[styles.notesText, { color: colors.text }]}>
            {customer.notes || 'No special instructions recorded.'}
          </Text>
        </View>

        {/* Recent Visits (Real Data from Supabase) */}
        <Text style={[styles.sectionTitle, { color: colors.accent }]}>
          RECENT VISITS
        </Text>
        <View style={styles.visitsList}>
          {realVisits.length === 0 ? (
            <View style={{ paddingVertical: 14 }}>
              <Text style={{ color: colors.textDim, fontSize: 12.5 }}>
                No completed visits or bills on file yet.
              </Text>
            </View>
          ) : (
            realVisits.map((v, i) => (
              <View
                key={i}
                style={[styles.visitRow, { borderBottomColor: colors.divider }]}
              >
                <Text style={[styles.visitDate, { color: colors.textDim }]}>{v.date}</Text>
                <Text style={[styles.visitWhat, { color: colors.text }]}>{v.what}</Text>
                <Text style={[styles.visitAmt, { color: colors.text }]}>
                  {inrFromMinor(v.amtMinor)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <Button
            label={t('newBill', 'New bill')}
            onPress={() => onStartBill(customer)}
            style={{ flex: 1 }}
          />
          <Button
            label={t('bookSlot', 'Book slot')}
            variant="secondary"
            onPress={() => onBookSlot(customer)}
            style={{ flex: 1 }}
          />
          <Button
            variant="secondary"
            onPress={() => onWhatsApp(customer)}
            style={{ width: 44, height: 44, paddingHorizontal: 0 }}
          >
            <ChatIcon size={17} color={colors.text} />
          </Button>
        </View>
      </ScrollView>

      <CustomerManagerModal
        visible={isEditModalOpen}
        shopId={shopId || ''}
        customerToEdit={customer}
        onClose={() => setIsEditModalOpen(false)}
        onAddSuccess={() => {}}
        onBatchSuccess={() => {}}
        onEditSuccess={(updated) => {
          onUpdateCustomer?.(updated);
        }}
      />

      <SettleDueModal
        visible={isSettleModalOpen}
        customer={customer}
        onClose={() => setIsSettleModalOpen(false)}
        onConfirm={async (customerId, method, amountMinor) => {
          await onSettleDue?.(customerId, method, amountMinor);
          setIsSettleModalOpen(false);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  starButton: {
    padding: 6,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginTop: 16,
    marginBottom: 4,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 19,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 21,
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: 12.5,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: radii.md,
  },
  statLabel: {
    fontSize: 9.5,
    letterSpacing: 0.9,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '500',
    marginTop: 3,
  },
  notesCard: {
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  stylistLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  visitsList: {
    marginBottom: 18,
  },
  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 10,
  },
  visitDate: {
    width: 48,
    fontSize: 11,
  },
  visitWhat: {
    flex: 1,
    fontSize: 13,
  },
  visitAmt: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
