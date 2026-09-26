import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Chip } from '../../components/common/Chip';
import { StarIcon } from '../../components/common/SvgIcons';
import { Customer } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { CustomerManagerModal } from '../../components/customers/CustomerManagerModal';

interface CustomersScreenProps {
  customers: Customer[];
  shopId?: string;
  onSelectCustomer: (customer: Customer) => void;
  onToggleStar: (customerId: string) => void;
  onAddCustomer?: (customer: Customer) => void;
  onBatchAddCustomers?: (customers: Customer[]) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onSettleDue?: (customerId: string, method?: 'cash' | 'upi') => void;
}

export const CustomersScreen = ({
  customers,
  shopId,
  onSelectCustomer,
  onToggleStar,
  onAddCustomer,
  onBatchAddCustomers,
  onUpdateCustomer,
  onSettleDue,
}: CustomersScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'MVP ★' | 'Dues'>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [displayLimit, setDisplayLimit] = useState(20);

  // Frequent customers sorted by visits count
  const sortedCustomers = React.useMemo(() => {
    return [...customers].sort((a, b) => (b.visits_count || 0) - (a.visits_count || 0));
  }, [customers]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const sourceList = q ? customers : sortedCustomers;

    return sourceList.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) {
        return false;
      }
      if (activeFilter === 'MVP ★') return c.is_starred;
      if (activeFilter === 'Dues') return c.outstanding_due_minor > 0;
      return true;
    });
  }, [customers, sortedCustomers, query, activeFilter]);

  const isSearching = query.trim().length > 0;
  const displayedCustomers = isSearching ? filtered : filtered.slice(0, displayLimit);
  const hasMore = !isSearching && filtered.length > displayLimit;

  const handleOpenAddModal = () => {
    setCustomerToEdit(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setCustomerToEdit(c);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('customers', 'Customers')}</Text>
          <Text style={[styles.countText, { color: colors.textDim }]}>
            {customers.length} {t('onFile', 'on file')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenAddModal}
            activeOpacity={0.7}
          >
            <Text style={[styles.addButtonText, { color: colors.accent }]}>{t('add', '+ Add')}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              color: colors.text,
            },
          ]}
          placeholder={t('searchNameOrNumber', 'Search name or number')}
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          value={query}
          onChangeText={(txt) => {
            setQuery(txt);
            setDisplayLimit(20);
          }}
        />

        <View style={styles.filtersRow}>
          {(['All', 'MVP ★', 'Dues'] as const).map((filter) => (
            <Chip
              key={filter}
              label={
                filter === 'All'
                  ? t('all', 'All')
                  : filter === 'MVP ★'
                  ? t('mvp', 'MVP ★')
                  : t('dues', 'Dues')
              }
              active={activeFilter === filter}
              onPress={() => {
                setActiveFilter(filter);
                setDisplayLimit(25);
              }}
            />
          ))}
        </View>

        {!isSearching && customers.length > 25 && (
          <View style={styles.topNoticeRow}>
            <Text style={[styles.topNoticeText, { color: colors.accent }]}>
              ⚡ Showing top {displayedCustomers.length} active clients by visits
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {displayedCustomers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query ? t('noCustomersFound', 'No customers matching search') : t('noCustomersOnFile', 'No customers on file')}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textDim }]}>
              {query
                ? 'Try searching with a different name or phone number.'
                : t('tapAddHint', "Tap '+ Add' in the top right to register your salon clients.")}
            </Text>
          </View>
        ) : (
          displayedCustomers.map((c) => {
            const hasDue = c.outstanding_due_minor > 0;
            const dueLabel = hasDue
              ? `${t('due', 'due')} ${inrFromMinor(c.outstanding_due_minor)}`
              : t('settled', 'settled');

            return (
              <View
                key={c.id}
                style={[
                  styles.customerRow,
                  { borderBottomColor: colors.divider },
                ]}
              >
              <TouchableOpacity
                style={styles.customerRowMain}
                activeOpacity={0.7}
                onPress={() => onSelectCustomer(c)}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: c.is_starred
                        ? colors.accent800
                        : colors.neutral800,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      {
                        color: c.is_starred
                          ? colors.accent100
                          : colors.neutral200,
                      },
                    ]}
                  >
                    {getInitials(c.name)}
                  </Text>
                </View>

                <View style={styles.customerDetails}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.customerName, { color: colors.text }]}>
                      {c.name}
                    </Text>
                    {c.is_starred ? (
                      <Text style={[styles.badge, { color: colors.accent }]}>
                        ★ MVP
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.metaText, { color: colors.textDim }]}
                  >
                    {`${c.visits_count} visits · last ${c.last_visit_date || 'recently'} · ${
                      c.preferred_stylist_name || 'Stylist'
                    }`}
                  </Text>
                </View>

                <View style={styles.spendColumn}>
                  <Text style={[styles.spendText, { color: colors.text }]}>
                    {inrFromMinor(c.lifetime_spend_minor)}
                  </Text>
                  {hasDue ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Alert.alert(
                          'Settle Outstanding Due',
                          `Settle ${inrFromMinor(c.outstanding_due_minor)} for ${c.name}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Cash', onPress: () => onSettleDue?.(c.id, 'cash') },
                            { text: 'UPI', onPress: () => onSettleDue?.(c.id, 'upi') },
                          ]
                        );
                      }}
                      style={[
                        styles.settlePill,
                        { backgroundColor: colors.accent900, borderColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.settlePillText, { color: colors.accent }]}>
                        Settle {inrFromMinor(c.outstanding_due_minor)}{c.due_start_date ? ` (${c.due_start_date})` : ''}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[styles.dueText, { color: colors.textSubtle }]}
                    >
                      {dueLabel}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  onPress={() => onToggleStar(c.id)}
                  style={styles.starButton}
                  activeOpacity={0.7}
                >
                  <StarIcon
                    size={18}
                    color={c.is_starred ? colors.accent : 'rgba(255,255,255,0.3)'}
                    fill={c.is_starred ? colors.accent : 'none'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenEditModal(c)}
                  style={styles.editButton}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, color: colors.textDim }}>✏️</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }))}

        {hasMore && (
          <TouchableOpacity
            style={[
              styles.loadMoreBtn,
              { borderColor: colors.accent, backgroundColor: colors.surface },
            ]}
            onPress={() => setDisplayLimit((prev) => prev + 20)}
            activeOpacity={0.7}
          >
            <Text style={[styles.loadMoreText, { color: colors.accent }]}>
              + Load 20 More Clients ({filtered.length - displayLimit} remaining)
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.bottomHint, { color: colors.textSubtle }]}>
          {t('starredHint', 'Starred customers are your MVPs — they feed the WhatsApp segment of the same name.')}
        </Text>
      </ScrollView>

      <CustomerManagerModal
        visible={modalVisible}
        shopId={shopId || ''}
        customerToEdit={customerToEdit}
        onClose={() => setModalVisible(false)}
        onAddSuccess={(newCust) => onAddCustomer?.(newCust)}
        onBatchSuccess={(newCusts) => onBatchAddCustomers?.(newCusts)}
        onEditSuccess={(updated) => onUpdateCustomer?.(updated)}
      />
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
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  countText: {
    fontSize: 13,
  },
  addButton: {
    marginLeft: 'auto',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchInput: {
    marginTop: 12,
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14.5,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  topNoticeRow: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(217, 164, 65, 0.1)',
    alignSelf: 'flex-start',
  },
  topNoticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  loadMoreBtn: {
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  customerRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  customerDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12.5,
    marginTop: 2,
  },
  spendColumn: {
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  spendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dueText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  starButton: {
    padding: 6,
  },
  actionsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  editButton: {
    padding: 6,
  },
  settlePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  settlePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomHint: {
    paddingTop: 18,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
});
