import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, CrossIcon } from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import { Expense, Period } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../repositories/expenseRepository';
import { radii } from '../../theme/spacing';

interface ExpensesScreenProps {
  expenses: Expense[];
  onBack: () => void;
  onAddExpense: (category: string, amountRupees: number, note: string) => void;
}

export const ExpensesScreen = ({
  expenses,
  onBack,
  onAddExpense,
}: ExpensesScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');
  const [sheetOpen, setSheetOpen] = useState(false);

  const [selectedCat, setSelectedCat] = useState<string>('Products & stock');
  const [amountStr, setAmountStr] = useState('');
  const [noteStr, setNoteStr] = useState('');

  const totalExpenseMinor = expenses.reduce((acc, e) => acc + e.amount_minor, 0);

  const handleSave = () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) return;

    onAddExpense(selectedCat, amt, noteStr.trim() || selectedCat);
    setAmountStr('');
    setNoteStr('');
    setSheetOpen(false);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <Text style={[styles.title, { color: colors.text }]}>{t('expenses')}</Text>
        </View>

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
        {/* Total & entries count */}
        <View style={styles.totalRow}>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {inrFromMinor(totalExpenseMinor)}
          </Text>
          <Text style={[styles.entriesCount, { color: colors.textDim }]}>
            {expenses.length} entries
          </Text>
        </View>

        {/* Expenses List */}
        <View style={styles.list}>
          {expenses.map((e) => (
            <View
              key={e.id}
              style={[
                styles.expenseItem,
                { backgroundColor: colors.surface },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.expenseNote, { color: colors.text }]}>
                  {e.note}
                </Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.catBadge,
                      { backgroundColor: colors.bg, borderColor: colors.divider },
                    ]}
                  >
                    <Text style={[styles.catBadgeText, { color: colors.textMuted }]}>
                      {e.category_name}
                    </Text>
                  </View>
                  <Text style={[styles.metaTime, { color: colors.textDim }]}>
                    {e.expense_date} · {e.payment_method}
                  </Text>
                </View>
              </View>
              <Text style={[styles.expenseAmt, { color: colors.text }]}>
                {inrFromMinor(e.amount_minor)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom bar with Add expense button */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button label={t('addExpense')} block onPress={() => setSheetOpen(true)} />
      </View>

      {/* Add Expense Bottom Sheet Modal */}
      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t('addExpense')}
              </Text>
              <TouchableOpacity
                onPress={() => setSheetOpen(false)}
                activeOpacity={0.7}
                style={{ padding: 4 }}
              >
                <CrossIcon size={18} color={colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Category Chips */}
            <View style={styles.sheetChipsRow}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  active={selectedCat === cat}
                  onPress={() => setSelectedCat(cat)}
                  size="sm"
                />
              ))}
            </View>

            {/* Amount & Note Inputs */}
            <View style={styles.sheetInputsRow}>
              <View style={{ width: 120 }}>
                <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                  {t('amount')} ₹
                </Text>
                <TextInput
                  style={[
                    styles.sheetTextInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={setAmountStr}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetInputLabel, { color: colors.textDim }]}>
                  {t('notes')}
                </Text>
                <TextInput
                  style={[
                    styles.sheetTextInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g. Products restock"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={noteStr}
                  onChangeText={setNoteStr}
                />
              </View>
            </View>

            <Button
              label={t('save')}
              block
              disabled={!amountStr.trim()}
              onPress={handleSave}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
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
    paddingTop: 10,
    paddingBottom: 24,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 14,
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  entriesCount: {
    fontSize: 12,
    paddingBottom: 3,
  },
  list: {
    gap: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  expenseNote: {
    fontSize: 13.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
  },
  metaTime: {
    fontSize: 11,
  },
  expenseAmt: {
    fontSize: 14,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: 16,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  sheetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  sheetInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  sheetInputLabel: {
    fontSize: 11.5,
    marginBottom: 6,
  },
  sheetTextInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
});
