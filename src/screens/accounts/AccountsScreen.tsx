import React, { useState, useEffect } from 'react';
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
import { SUPPORTED_LANGUAGES } from '../../i18n/translations';
import { Period, Bill, Expense } from '../../types/domain';
import { financialService } from '../../services/financialService';
import { inrFromMinor } from '../../utils/format';
import { supportRepository, SupportMessageAnswer } from '../../repositories/supportRepository';
import {
  WalletIcon,
  CalendarIcon,
  BellIcon,
  ChatIcon,
  UsersIcon,
  TagIcon,
  StoreIcon,
} from '../../components/common/SvgIcons';
import { radii } from '../../theme/spacing';

interface AccountsScreenProps {
  openRemindersCount: number;
  bills?: Bill[];
  expenses?: Expense[];
  shopId?: string;
  shopName?: string;
  userPhone?: string;
  onNavigate: (
    screen:
      | 'expenses'
      | 'appointments'
      | 'reminders'
      | 'bulk'
      | 'staff'
      | 'pricing'
      | 'profile'
  ) => void;
  onAccountDeleted?: () => void;
  onSignOut?: () => void;
}

export const AccountsScreen = ({
  openRemindersCount,
  bills = [],
  expenses = [],
  shopId = '',
  shopName = 'My Salon',
  userPhone = '',
  onNavigate,
  onAccountDeleted,
  onSignOut,
}: AccountsScreenProps) => {
  const { colors } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [period, setPeriod] = useState<Period>('Day');

  // Modals state
  const [showLangModal, setShowLangModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteReason, setSelectedDeleteReason] = useState('Closing or Pausing Salon Business');
  const [deleteCustomNote, setDeleteCustomNote] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Support ticket form
  const [supportMessage, setSupportMessage] = useState('');
  const [supportContact, setSupportContact] = useState(userPhone);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [supportAnswers, setSupportAnswers] = useState<SupportMessageAnswer[]>([]);

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    try {
      const fullReason = deleteCustomNote.trim()
        ? `${selectedDeleteReason} - ${deleteCustomNote.trim()}`
        : selectedDeleteReason;

      await supportRepository.permanentlyDeleteAccount({
        shopId,
        shopName,
        phone: userPhone,
        reason: fullReason,
      });
      setIsDeleting(false);
      setShowDeleteModal(false);
      Alert.alert(
        'Account Permanently Deleted',
        'All your salon data and business records have been completely wiped from the database. You will need to register again if you wish to use StyleFleet.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onAccountDeleted) onAccountDeleted();
            },
          },
        ]
      );
    } catch (e: any) {
      setIsDeleting(false);
      Alert.alert('Error', e.message || 'Failed to delete account');
    }
  };

  useEffect(() => {
    if (showSupportModal && shopId) {
      supportRepository.getSupportMessageAnswers(shopId).then((ans) => {
        setSupportAnswers(ans);
      });
    }
  }, [showSupportModal, shopId]);

  const pnl = financialService.getPnLMetrics(period, bills, expenses);

  const deleteWarningText = t(
    'deleteAccountWarning',
    'Deleting your account will permanently wipe all bills, clients, staff records, service catalogs, and history for "{shopName}" from the Supabase database.'
  ).replace('{shopName}', shopName);

  const tools = [
    {
      id: 'expenses' as const,
      label: t('expenses'),
      sub: t('expensesSub', 'Log & categorise'),
      icon: <WalletIcon size={19} color={colors.accent} />,
      badge: '',
    },
    {
      id: 'appointments' as const,
      label: t('appointments'),
      sub: t('appointmentsSub', 'Day agenda'),
      icon: <CalendarIcon size={19} color={colors.accent} />,
      badge: '',
    },
    {
      id: 'reminders' as const,
      label: t('reminders'),
      sub: t('remindersSub', 'Auto & manual'),
      icon: <BellIcon size={19} color={colors.accent} />,
      badge: openRemindersCount > 0 ? String(openRemindersCount) : '',
    },
    {
      id: 'bulk' as const,
      label: t('whatsApp', 'WhatsApp'),
      sub: t('whatsAppSub', 'Offers & nudges'),
      icon: <ChatIcon size={19} color={colors.accent} />,
      badge: '',
    },
    {
      id: 'staff' as const,
      label: t('team'),
      sub: t('staffSub', 'Who delivers what'),
      icon: <UsersIcon size={19} color={colors.accent} />,
      badge: '',
    },
    {
      id: 'pricing' as const,
      label: t('priceAndOffers'),
      sub: t('pricingSub', 'Add, delete, discount'),
      icon: <TagIcon size={19} color={colors.accent} />,
      badge: '',
    },
    {
      id: 'profile' as const,
      label: t('shopProfile'),
      sub: t('profileSub', 'Logo, theme, GST'),
      icon: <StoreIcon size={19} color={colors.accent} />,
      badge: '',
    },
  ];

  const handleSendSupportTicket = async () => {
    if (!supportMessage.trim()) {
      Alert.alert('Required', 'Please enter your message or question.');
      return;
    }
    setIsSubmittingTicket(true);
    try {
      await supportRepository.submitSupportMessage({
        shop_id: shopId,
        message: supportMessage.trim(),
        contact_info: supportContact.trim(),
      });
      setIsSubmittingTicket(false);
      setSupportMessage('');
      setShowSupportModal(false);
      Alert.alert(
        'Ticket Submitted',
        'Your support request has been logged in Supabase. Our team will review it shortly.'
      );
    } catch (err: any) {
      setIsSubmittingTicket(false);
      Alert.alert('Error', err.message || 'Failed to submit support ticket.');
    }
  };



  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('accounts')}</Text>
          <Text style={[styles.todayLabel, { color: colors.textDim }]}>{todayStr}</Text>
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
                    backgroundColor: isSelected ? colors.surface : 'transparent',
                    borderRightWidth: p !== 'Month' ? 1 : 0,
                    borderRightColor: colors.divider,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    {
                      color: isSelected ? colors.text : colors.textDim,
                      fontWeight: isSelected ? '600' : '400',
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Net Profit Summary */}
        <View style={styles.pnlHeaderRow}>
          <View>
            <Text style={[styles.pnlSubLabel, { color: colors.textDim }]}>
              {period === 'Day' ? `${t('today')} · ${t('netProfit')}` : `${period === 'Week' ? t('week') : t('month')} · ${t('netProfit')}`}
            </Text>
            <Text
              style={[
                styles.pnlMainAmt,
                { color: pnl.net_minor >= 0 ? colors.accent : colors.error },
              ]}
            >
              {inrFromMinor(pnl.net_minor)}
            </Text>
          </View>
          <View style={styles.pnlMarginBadge}>
            <Text style={[styles.pnlMarginText, { color: colors.accent200 }]}>
              {pnl.margin_pct}% {t('marginLabel', 'margin')}
            </Text>
          </View>
        </View>

        {/* Income vs Expenses Cards */}
        <View style={styles.twoColCards}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>{t('totalIncome')}</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {inrFromMinor(pnl.income_minor)}
            </Text>
            <Text style={[styles.statSub, { color: colors.textMuted }]}>
              {bills.length} bills
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textDim }]}>{t('totalExpenses')}</Text>
            <Text style={[styles.statValue, { color: colors.error }]}>
              {inrFromMinor(pnl.expense_minor)}
            </Text>
            <Text style={[styles.statSub, { color: colors.textMuted }]}>
              {expenses.length} entries
            </Text>
          </View>
        </View>

        {/* Where the money went (Expenses breakdown) */}
        {pnl.categories.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardHeader, { color: colors.textDim }]}>
              {t('whereMoneyWent', 'WHERE THE MONEY WENT')}
            </Text>
            {pnl.categories.map((c, i) => (
              <View key={i} style={styles.expenseCatItem}>
                <View style={styles.expenseCatLabelRow}>
                  <Text style={[styles.expenseCatName, { color: colors.text }]}>{c.label}</Text>
                  <Text style={[styles.expenseCatAmt, { color: colors.textMuted }]}>
                    {inrFromMinor(c.amt_minor)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.expenseCatProgressTrack,
                    { backgroundColor: 'rgba(255,255,255,0.1)' },
                  ]}
                >
                  <View
                    style={[
                      styles.expenseCatProgressFill,
                      {
                        width: `${c.pct}%`,
                        backgroundColor: i === 0 ? colors.accent : colors.accent700,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Outstanding Dues Card */}
        {pnl.dues_minor > 0 ? (
          <View style={[styles.duesCard, { backgroundColor: colors.accent900 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.duesLabel, { color: colors.accent200 }]}>
                {t('outstandingDues')}
              </Text>
              <Text style={[styles.duesAmount, { color: colors.accent100 }]}>
                {inrFromMinor(pnl.dues_minor)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.chaseButton, { backgroundColor: colors.accent800 }]}
              onPress={() => onNavigate('reminders')}
              activeOpacity={0.8}
            >
              <Text style={[styles.chaseButtonText, { color: colors.accent100 }]}>Chase</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Manage Tools Header */}
        <Text style={[styles.manageTitle, { color: colors.textDim }]}>
          {t('operationsAndTools', 'OPERATIONS & TOOLS')}
        </Text>

        {/* 2-Column Tools Grid */}
        <View style={styles.toolsGrid}>
          {tools.map((t) => (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.75}
              onPress={() => onNavigate(t.id)}
              style={[
                styles.toolCard,
                { backgroundColor: colors.surface, borderColor: colors.divider },
              ]}
            >
              <View style={styles.toolIconRow}>
                {t.icon}
                {t.badge ? (
                  <View style={[styles.toolBadge, { backgroundColor: colors.accent900 }]}>
                    <Text style={[styles.toolBadgeText, { color: colors.accent200 }]}>
                      {t.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ marginTop: 7, flex: 1 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  style={[styles.toolTitle, { color: colors.text }]}
                >
                  {t.label}
                </Text>
                <Text numberOfLines={1} style={[styles.toolSub, { color: colors.textDim }]}>{t.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ======================================================== */}
        {/* NEW SETTINGS & SUPPORT BOX (Per user explicit request)     */}
        {/* ======================================================== */}
        <Text style={[styles.manageTitle, { color: colors.textDim, marginTop: 24 }]}>
          {t('settingsAndHelp')}
        </Text>

        <View style={[styles.settingsBox, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          {/* App Language */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
            onPress={() => setShowLangModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.text }]}>{t('appLanguage')}</Text>
              <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.accent }]}>
                {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeLabel || 'English'}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
            onPress={() => setShowPrivacyModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.text }]}>{t('privacyPolicy')}</Text>
              <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.textDim }]}>
                {t('privacyPolicySub', 'Customer data privacy and security terms')}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {/* FAQ */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
            onPress={() => setShowFaqModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.text }]}>
                {t('faq')}
              </Text>
              <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.textDim }]}>
                {t('faqSub', 'Billing, backups, GST and staff queries')}
              </Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
          </TouchableOpacity>

          {/* Help Desk Support */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
            onPress={() => setShowSupportModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.text }]}>
                {t('helpDesk')}
              </Text>
              <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.textDim }]}>
                {t('helpDeskSub', 'Submit an inquiry or view answers from support')}
              </Text>
            </View>
            <View style={[styles.supportBadge, { backgroundColor: colors.accent800 }]}>
              <Text style={[styles.supportBadgeText, { color: colors.accent100 }]}>Support</Text>
            </View>
          </TouchableOpacity>

          {/* Sign Out (Moved here from Shop Profile as instructed) */}
          {onSignOut && (
            <TouchableOpacity
              style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
              onPress={() => {
                Alert.alert(
                  t('signOut', 'Sign out'),
                  'Are you sure you want to sign out from your salon account?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: t('signOut', 'Sign out'),
                      style: 'destructive',
                      onPress: onSignOut,
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.text }]}>
                  🚪 {t('signOut', 'Sign out')}
                </Text>
                <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.textDim }]}>
                  {t('signOutSub', 'Exit session on this device')}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          )}

          {/* Permanently Delete Account */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0, backgroundColor: 'rgba(255, 59, 48, 0.05)' }]}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} style={[styles.settingsRowTitle, { color: colors.error }]}>
                🗑 {t('deleteAccount', 'Permanently Delete Account')}
              </Text>
              <Text numberOfLines={1} style={[styles.settingsRowSub, { color: colors.textDim }]}>
                {t('deleteAccountSub', 'Wipe salon database records and close account')}
              </Text>
            </View>
            <Text style={{ color: colors.error, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ---------------------------------------------------- */}
      {/* 1. PRIVACY POLICY MODAL                              */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, marginTop: 12 }}>
              <Text style={[styles.policyText, { color: colors.textMuted }]}>
                Salon OS is committed to protecting the confidentiality and privacy of salon owners and
                their clients. All customer records, phone numbers, visit histories, and financial transactions
                are stored exclusively in dedicated, Row-Level-Security (RLS) protected Supabase PostgreSQL databases.
                {'\n\n'}
                1. Data Ownership: You retain 100% ownership of your business and customer data. We never sell,
                rent, or share customer contact lists with third parties.
                {'\n\n'}
                2. Security & Encryption: Data in transit is protected using TLS 1.3 encryption. Passwords and
                session tokens are managed via secure Supabase authentication.
                {'\n\n'}
                3. Permanent Erasure: At any time, salon owners may exercise their right to be forgotten and
                permanently delete their account and associated data.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. FAQ MODAL                                         */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showFaqModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
              <TouchableOpacity onPress={() => setShowFaqModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400, marginTop: 12 }}>
              <View style={styles.faqItem}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>
                  Q: Where is my salon data saved?
                </Text>
                <Text style={[styles.faqAnswer, { color: colors.textMuted }]}>
                  All records including bills, customers, team members, and expenses are saved directly to your
                  secure cloud Supabase database, with offline-first synchronization.
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>
                  Q: How do WhatsApp receipts work?
                </Text>
                <Text style={[styles.faqAnswer, { color: colors.textMuted }]}>
                  Upon generating an invoice, tap 'Share via WhatsApp' to open a pre-formatted itemized receipt
                  ready to be dispatched directly to your client.
                </Text>
              </View>
              <View style={styles.faqItem}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>
                  Q: How do I adjust staff commissions?
                </Text>
                <Text style={[styles.faqAnswer, { color: colors.textMuted }]}>
                  Go to Accounts &gt; Team to manage individual roles, active statuses, and service delivery metrics.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. HELP DESK SUPPORT MODAL (Stores in support_messages)*/}
      {/* ---------------------------------------------------- */}
      <Modal visible={showSupportModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowSupportModal(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Help Desk Support</Text>
                  <TouchableOpacity onPress={() => setShowSupportModal(false)}>
                    <Text style={{ color: colors.accent, fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalSub, { color: colors.textDim }]}>
                  Enter your query or technical issue below. It will be recorded into our Supabase support desk.
                </Text>

                {supportAnswers.length > 0 && (
                  <View style={{ marginVertical: 10 }}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                      💬 Replies from Support ({supportAnswers.length})
                    </Text>
                    {supportAnswers.slice(0, 3).map((a) => (
                      <View
                        key={a.id}
                        style={{
                          backgroundColor: colors.bg,
                          borderRadius: radii.sm,
                          borderWidth: 1,
                          borderColor: a.is_read ? colors.divider : colors.accent,
                          padding: 10,
                          marginBottom: 6,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700' }}>
                            {a.admin_name || 'StyleFleet Support'}
                          </Text>
                          {!a.is_read && (
                            <TouchableOpacity
                              onPress={async () => {
                                await supportRepository.markAnswerAsRead(shopId, a.id);
                                setSupportAnswers((prev) =>
                                  prev.map((item) => (item.id === a.id ? { ...item, is_read: true } : item))
                                );
                              }}
                            >
                              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '600' }}>
                                Mark Read ✓
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={{ color: colors.text, fontSize: 12 }}>{a.answer}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <TextInput
                  style={[
                    styles.ticketInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  multiline
                  numberOfLines={4}
                  placeholder="Describe your issue or question in detail..."
                  placeholderTextColor={colors.textDim}
                  value={supportMessage}
                  onChangeText={setSupportMessage}
                />

                <TextInput
                  style={[
                    styles.contactInput,
                    {
                      backgroundColor: colors.bg,
                      borderColor: colors.divider,
                      color: colors.text,
                    },
                  ]}
                  placeholder="Your contact phone or email (optional)"
                  placeholderTextColor={colors.textDim}
                  value={supportContact}
                  onChangeText={setSupportContact}
                />

                <TouchableOpacity
                  style={[styles.primaryModalButton, { backgroundColor: colors.accent }]}
                  onPress={handleSendSupportTicket}
                  disabled={isSubmittingTicket}
                  activeOpacity={0.8}
                >
                  {isSubmittingTicket ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.primaryModalButtonText}>Submit Support Ticket</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>



      {/* ---------------------------------------------------- */}
      {/* 5. APP LANGUAGE MODAL                                */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showLangModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select App Language</Text>
              <TouchableOpacity onPress={() => setShowLangModal(false)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 12 }}>
              {SUPPORTED_LANGUAGES.map((l) => {
                const isSelected = language === l.code;
                return (
                  <TouchableOpacity
                    key={l.code}
                    onPress={async () => {
                      await setLanguage(l.code);
                      setShowLangModal(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accent : colors.divider,
                      backgroundColor: isSelected ? colors.accent900 : 'transparent',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: isSelected ? '600' : '400' }}>
                      {l.nativeLabel}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 13, marginLeft: 8 }}>
                      ({l.label})
                    </Text>
                    {isSelected && (
                      <Text style={{ color: colors.accent, marginLeft: 'auto', fontWeight: 'bold' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 6. PERMANENT DELETE MODAL                            */}
      {/* ---------------------------------------------------- */}
      <Modal visible={showDeleteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => {
                if (!isDeleting) {
                  setShowDeleteModal(false);
                }
              }}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.error, maxHeight: '90%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.error }]}>{t('deleteAccountTitle', 'Delete Salon Account')}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isDeleting) {
                        setShowDeleteModal(false);
                      }
                    }}
                  >
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>{t('cancel', 'Cancel')}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled">
                  <Text style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
                    ⚠️ <Text style={{ fontWeight: '700', color: colors.error }}>{t('irreversibleAction', 'Irreversible Action')}:</Text>{' '}
                    {deleteWarningText}
                  </Text>

                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.textDim, marginBottom: 8 }}>
                    Reason for leaving:
                  </Text>

                  {[
                    'Closing or Pausing Salon Business',
                    'Switching to Another Software',
                    'Encountered Bugs / Technical Difficulties',
                    'Temporary Test Account',
                    'Other Reason',
                  ].map((reason) => {
                    const isSelected = selectedDeleteReason === reason;
                    return (
                      <TouchableOpacity
                        key={reason}
                        activeOpacity={0.8}
                        onPress={() => setSelectedDeleteReason(reason)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: radii.sm,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.error : colors.divider,
                          backgroundColor: isSelected ? 'rgba(255, 59, 48, 0.1)' : 'transparent',
                          marginBottom: 6,
                        }}
                      >
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            borderWidth: 1.5,
                            borderColor: isSelected ? colors.error : colors.textDim,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && (
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.error }} />
                          )}
                        </View>
                        <Text style={{ fontSize: 12.5, color: colors.text }}>{reason}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TextInput
                    style={[
                      styles.ticketInput,
                      { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginTop: 8, height: 42, paddingVertical: 8 },
                    ]}
                    placeholder="Additional feedback (optional)"
                    placeholderTextColor={colors.textDim}
                    value={deleteCustomNote}
                    onChangeText={setDeleteCustomNote}
                  />

                  <TouchableOpacity
                    onPress={handlePermanentDelete}
                    disabled={isDeleting}
                    style={[styles.primaryModalButton, { backgroundColor: colors.error, marginTop: 14 }]}
                  >
                    {isDeleting ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                        {t('deleteAccountConfirm', 'Confirm Permanent Deletion')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 24,
  },
  pnlHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  pnlSubLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  pnlMainAmt: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  pnlMarginBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(217,164,65,0.15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pnlMarginText: {
    fontSize: 12,
    fontWeight: '600',
  },
  twoColCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: radii.md,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  statSub: {
    fontSize: 11,
    marginTop: 2,
  },
  card: {
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 14,
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  expenseCatItem: {
    marginBottom: 10,
  },
  expenseCatLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expenseCatName: {
    fontSize: 13,
  },
  expenseCatAmt: {
    fontSize: 13,
  },
  expenseCatProgressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  expenseCatProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  duesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radii.md,
    marginBottom: 16,
  },
  duesLabel: {
    fontSize: 12,
  },
  duesAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  chaseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  chaseButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  manageTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
  },
  toolIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  toolTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  toolSub: {
    fontSize: 11,
    marginTop: 2,
  },
  settingsBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  settingsRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsRowSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  supportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  supportBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 18,
  },
  policyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  faqItem: {
    marginBottom: 14,
  },
  faqQuestion: {
    fontSize: 13.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  faqAnswer: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  ticketInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    height: 100,
    marginBottom: 10,
  },
  contactInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  primaryModalButton: {
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryModalButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
