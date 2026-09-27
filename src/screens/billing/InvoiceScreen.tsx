import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  Image,
  Platform,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, ChatIcon } from '../../components/common/SvgIcons';
import { Bill } from '../../types/domain';
import { inrFromMinor, getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';
import { generateInvoiceHtml } from '../../utils/invoicePdf';

interface InvoiceScreenProps {
  bill: Bill;
  shopName: string;
  shopAddress?: string;
  shopGstin?: string;
  shopLogoUrl?: string | null;
  customerPhone?: string | null;
  onBack: () => void;
  onSendWhatsApp?: (bill: Bill) => void;
}

export const InvoiceScreen = ({
  bill,
  shopName,
  shopAddress = 'Premium Salon & Spa',
  shopGstin,
  shopLogoUrl,
  customerPhone,
  onBack,
  onSendWhatsApp,
}: InvoiceScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Phone state and modal
  const [activeCustomerPhone, setActiveCustomerPhone] = useState(
    customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : ''
  );
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [inputPhone, setInputPhone] = useState('');

  // Determine financial breakdown
  const isPartiallyPaid = bill.status === 'partially_paid';
  const isPending = bill.status === 'pending';

  let paidMinor = bill.paid_amount_minor;
  let dueMinor = bill.due_amount_minor;

  if (paidMinor === undefined || dueMinor === undefined) {
    if (bill.notes && bill.notes.includes('due:')) {
      const dueMatch = bill.notes.match(/due:(\d+)/);
      const paidMatch = bill.notes.match(/paid:(\d+)/);
      if (dueMatch) dueMinor = parseInt(dueMatch[1], 10);
      if (paidMatch) paidMinor = parseInt(paidMatch[1], 10);
    }
  }

  if (isPending) {
    paidMinor = 0;
    dueMinor = dueMinor ?? bill.total_minor;
  } else if (isPartiallyPaid) {
    dueMinor = dueMinor ?? 0;
    paidMinor = paidMinor ?? Math.max(0, bill.total_minor - dueMinor);
  } else {
    paidMinor = paidMinor ?? bill.total_minor;
    dueMinor = 0;
  }

  // Helper to generate the PDF file with base64 logo support
  const getSafeLogoForPdf = async (): Promise<string | null> => {
    if (!shopLogoUrl) return null;
    if (shopLogoUrl.startsWith('http') || shopLogoUrl.startsWith('data:')) {
      return shopLogoUrl;
    }
    if (shopLogoUrl.startsWith('file:') || shopLogoUrl.startsWith('content:')) {
      try {
        const b64 = await FileSystem.readAsStringAsync(shopLogoUrl, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mime = shopLogoUrl.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${b64}`;
      } catch (e) {
        console.warn('Could not convert logo to base64 for PDF:', e);
      }
    }
    return null;
  };

  const generatePdfFile = async () => {
    const safeLogo = await getSafeLogoForPdf();

    const html = generateInvoiceHtml({
      bill,
      shopName,
      shopAddress,
      shopGstin,
      shopLogoUrl: safeLogo,
      customerPhone: activeCustomerPhone || undefined,
    });

    return await Print.printToFileAsync({ html, base64: true });
  };

  // Share PDF
  const handleSharePdf = async () => {
    try {
      setIsExportingPdf(true);
      const { uri, base64 } = await generatePdfFile();
      const cleanNumber = bill.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Invoice_${cleanNumber}.pdf`;
      const targetUri = `${FileSystem.cacheDirectory}${filename}`;

      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }

      if (base64) {
        await FileSystem.writeAsStringAsync(targetUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.copyAsync({ from: uri, to: targetUri });
      }

      const isShareAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isShareAvailable) {
        await Sharing.shareAsync(targetUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice PDF - ${bill.customer_name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'File sharing is not available on this device.');
      }
    } catch (err: any) {
      console.warn('Share PDF error:', err);
      Alert.alert('Share Error', err.message || 'Could not share PDF invoice.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Direct Native Print
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const safeLogo = await getSafeLogoForPdf();
      const html = generateInvoiceHtml({
        bill,
        shopName,
        shopAddress,
        shopGstin,
        shopLogoUrl: safeLogo,
        customerPhone: activeCustomerPhone || undefined,
      });
      await Print.printAsync({ html });
    } catch (err: any) {
      console.warn('Print error:', err);
      Alert.alert('Print Error', err.message || 'Could not send invoice to printer.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Send WhatsApp directly to a specific 10-digit number
  const sendWhatsAppToPhone = async (phone10: string) => {
    const cleanPhone = phone10.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      setInputPhone(cleanPhone);
      setPhoneModalVisible(true);
      return;
    }

    const itemsSummary = bill.items
      .map(
        (it) =>
          `• ${it.service_name_snapshot}: ₹${Math.round(it.unit_price_minor / 100).toLocaleString('en-IN')}`
      )
      .join('\n');

    let paymentBreakdownText = '';
    if (isPartiallyPaid) {
      paymentBreakdownText =
        `Total Amount: ₹${Math.round(bill.total_minor / 100).toLocaleString('en-IN')}\n` +
        `Amount Paid: ₹${Math.round(paidMinor / 100).toLocaleString('en-IN')} (${bill.payment_method.toUpperCase()})\n` +
        `⚠️ *Amount Due: ₹${Math.round(dueMinor / 100).toLocaleString('en-IN')}*\n` +
        `Payment Status: PARTIALLY PAID\n`;
    } else if (isPending) {
      paymentBreakdownText =
        `Total Amount: ₹${Math.round(bill.total_minor / 100).toLocaleString('en-IN')}\n` +
        `Amount Paid: ₹0\n` +
        `⚠️ *Amount Due: ₹${Math.round(dueMinor / 100).toLocaleString('en-IN')}*\n` +
        `Payment Status: PENDING / UNPAID\n`;
    } else {
      paymentBreakdownText =
        `Total Amount: ₹${Math.round(bill.total_minor / 100).toLocaleString('en-IN')}\n` +
        `Amount Paid: ₹${Math.round(bill.total_minor / 100).toLocaleString('en-IN')} (${bill.payment_method.toUpperCase()})\n` +
        `Amount Due: ₹0\n` +
        `Payment Status: PAID ✅\n`;
    }

    const message =
      `💈 *${shopName}*\n` +
      `*Invoice # ${bill.invoice_number}*\n` +
      `Date: ${bill.issued_at}\n` +
      `Customer: ${bill.customer_name}\n` +
      `Stylist: ${bill.staff_name}\n` +
      `--------------------------------\n` +
      `*Services:*\n${itemsSummary}\n` +
      `--------------------------------\n` +
      `Subtotal: ₹${Math.round(bill.subtotal_minor / 100).toLocaleString('en-IN')}\n` +
      (bill.discount_minor > 0
        ? `Discount: - ₹${Math.round(bill.discount_minor / 100).toLocaleString('en-IN')}\n`
        : '') +
      paymentBreakdownText +
      `\nThank you for choosing ${shopName}! ✨`;

    const nativeUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
    const webUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;

    try {
      const supported = await Linking.canOpenURL(nativeUrl);
      if (supported) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }

    onSendWhatsApp?.(bill);
  };

  // WhatsApp Trigger
  const handleWhatsApp = () => {
    if (activeCustomerPhone.length === 10) {
      sendWhatsAppToPhone(activeCustomerPhone);
    } else {
      setInputPhone('');
      setPhoneModalVisible(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('invoice')}</Text>
        <View
          style={[
            styles.invoiceBadge,
            { backgroundColor: colors.accent900, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.invoiceBadgeText, { color: colors.accent200 }]}>
            {bill.invoice_number}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Receipt Card */}
        <View
          style={[
            styles.receiptCard,
            { backgroundColor: colors.surface },
          ]}
        >
          {/* Shop Header & Logo */}
          <View style={styles.receiptHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shopName, { color: colors.text }]}>{shopName}</Text>
              <Text style={[styles.shopMeta, { color: colors.textDim }]}>
                {shopAddress}
                {shopGstin ? `\nGSTIN ${shopGstin}` : ''}
              </Text>
            </View>
            {shopLogoUrl ? (
              <Image source={{ uri: shopLogoUrl }} style={styles.logoImage} resizeMode="cover" />
            ) : (
              <View style={[styles.logoThumb, { backgroundColor: colors.accent800 }]}>
                <Text style={{ color: colors.accent100, fontWeight: '700', fontSize: 13 }}>
                  {getInitials(shopName)}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Billed To / Date */}
          <View style={styles.billedToRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.metaLabel, { color: colors.textDim }]}>{t('billedTo')}</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {bill.customer_name}
              </Text>
              {activeCustomerPhone ? (
                <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2 }}>
                  📱 +91 {activeCustomerPhone}
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setInputPhone('');
                    setPhoneModalVisible(true);
                  }}
                  style={{ marginTop: 2 }}
                >
                  <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '600' }}>
                    + Add Phone Number
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metaLabel, { color: colors.textDim }]}>
                {bill.issued_at}
              </Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {bill.staff_name}
              </Text>
            </View>
          </View>

          {/* Line Items */}
          <View style={styles.itemsList}>
            {bill.items.map((item, idx) => (
              <View
                key={idx}
                style={[
                  styles.itemRow,
                  { borderBottomColor: colors.divider },
                ]}
              >
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.service_name_snapshot}
                </Text>
                <Text style={[styles.itemPrice, { color: colors.text }]}>
                  {inrFromMinor(item.unit_price_minor)}
                </Text>
              </View>
            ))}
          </View>

          {/* Financial Totals */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalLine}>
              <Text style={[styles.totalLineLabel, { color: colors.textMuted }]}>
                {t('subtotal')}
              </Text>
              <Text style={[styles.totalLineValue, { color: colors.textMuted }]}>
                {inrFromMinor(bill.subtotal_minor)}
              </Text>
            </View>

            {bill.discount_minor > 0 ? (
              <View style={styles.totalLine}>
                <Text style={[styles.totalLineLabel, { color: colors.accent }]}>
                  {t('discount')}
                </Text>
                <Text style={[styles.totalLineValue, { color: colors.accent }]}>
                  − {inrFromMinor(bill.discount_minor)}
                </Text>
              </View>
            ) : null}

            {bill.tax_minor > 0 ? (
              <View style={styles.totalLine}>
                <Text style={[styles.totalLineLabel, { color: colors.textMuted }]}>
                  {t('tax')}
                </Text>
                <Text style={[styles.totalLineValue, { color: colors.textMuted }]}>
                  {inrFromMinor(bill.tax_minor)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Financial Breakdown: 4 required values */}
          <View style={{ gap: 6 }}>
            <View style={styles.totalLine}>
              <Text style={[styles.totalLineLabel, { color: colors.textDim }]}>Total Amount</Text>
              <Text style={[styles.totalLineValue, { color: colors.text, fontWeight: '700' }]}>
                {inrFromMinor(bill.total_minor)}
              </Text>
            </View>

            <View style={styles.totalLine}>
              <Text style={[styles.totalLineLabel, { color: paidMinor > 0 ? '#16a34a' : colors.textDim, fontWeight: '500' }]}>
                Amount Paid{paidMinor > 0 ? ` (${bill.payment_method})` : ''}
              </Text>
              <Text style={[styles.totalLineValue, { color: paidMinor > 0 ? '#16a34a' : colors.textDim, fontWeight: '700' }]}>
                {inrFromMinor(paidMinor)}
              </Text>
            </View>

            <View
              style={[
                styles.totalLine,
                dueMinor > 0
                  ? {
                      borderTopWidth: 1,
                      borderTopColor: '#fca5a5',
                      borderStyle: 'dashed',
                      paddingTop: 8,
                      marginTop: 4,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.totalLineLabel,
                  { color: dueMinor > 0 ? '#dc2626' : colors.textDim, fontWeight: dueMinor > 0 ? '700' : '500', fontSize: dueMinor > 0 ? 14 : 13 },
                ]}
              >
                Amount Due
              </Text>
              <Text
                style={[
                  styles.totalLineValue,
                  { color: dueMinor > 0 ? '#dc2626' : colors.textDim, fontWeight: dueMinor > 0 ? '800' : '700', fontSize: dueMinor > 0 ? 18 : 14 },
                ]}
              >
                {inrFromMinor(dueMinor)}
              </Text>
            </View>

            <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
              {isPartiallyPaid ? (
                <View
                  style={{
                    backgroundColor: '#fef3c7',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#fde68a',
                  }}
                >
                  <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 11 }}>
                    PARTIALLY PAID · DUE {inrFromMinor(dueMinor)}
                  </Text>
                </View>
              ) : isPending ? (
                <View
                  style={{
                    backgroundColor: '#fee2e2',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#fecaca',
                  }}
                >
                  <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 11 }}>
                    PENDING / UNPAID
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: '#dcfce7',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#bbf7d0',
                  }}
                >
                  <Text style={{ color: '#166534', fontWeight: '700', fontSize: 11 }}>
                    PAID · {bill.payment_method.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            label="WhatsApp"
            icon={<ChatIcon size={16} color={colors.accent100} />}
            onPress={handleWhatsApp}
            style={{ flex: 1.2 }}
          />
          <Button
            label={isExportingPdf ? 'Sharing...' : 'Share PDF'}
            variant="secondary"
            disabled={isExportingPdf}
            onPress={handleSharePdf}
            style={{ flex: 1.2 }}
          />
          <Button
            label={isPrinting ? '...' : 'Print'}
            variant="secondary"
            disabled={isPrinting}
            onPress={handlePrint}
            style={{ paddingHorizontal: 16 }}
          />
        </View>

        <Text style={[styles.footnote, { color: colors.textSubtle }]}>
          Official invoice generated with StyleFleet.
        </Text>
      </ScrollView>

      {/* Phone prompt modal to redirect directly to customer WhatsApp */}
      <Modal
        visible={phoneModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Customer Mobile Number
            </Text>
            <Text style={[styles.modalSub, { color: colors.textDim }]}>
              Enter 10-digit mobile number to open WhatsApp directly with {bill.customer_name}.
            </Text>
            <View
              style={[
                styles.phoneInputContainer,
                { backgroundColor: colors.bg, borderColor: colors.divider },
              ]}
            >
              <Text style={{ color: colors.textDim, fontWeight: '600' }}>+91 </Text>
              <TextInput
                style={[styles.phoneTextInput, { color: colors.text }]}
                placeholder="Enter 10-digit number"
                placeholderTextColor={colors.textDim}
                keyboardType="phone-pad"
                maxLength={10}
                value={inputPhone}
                onChangeText={setInputPhone}
                autoFocus
              />
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.divider }]}
                onPress={() => setPhoneModalVisible(false)}
              >
                <Text style={{ color: colors.textDim, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#10b981' }]}
                onPress={() => {
                  const cleaned = inputPhone.replace(/\D/g, '').slice(-10);
                  if (cleaned.length !== 10) {
                    Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
                    return;
                  }
                  setActiveCustomerPhone(cleaned);
                  setPhoneModalVisible(false);
                  sendWhatsAppToPhone(cleaned);
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>Open WhatsApp Chat</Text>
              </TouchableOpacity>
            </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  invoiceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  invoiceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  receiptCard: {
    borderRadius: radii.lg,
    padding: 20,
    marginBottom: 20,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  shopName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  shopMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  logoThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 13,
  },
  billedToRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 11.5,
  },
  metaValue: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  itemName: {
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 13,
  },
  totalsBlock: {
    marginTop: 12,
    gap: 5,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLineLabel: {
    fontSize: 12.5,
  },
  totalLineValue: {
    fontSize: 12.5,
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  paidLabel: {
    flex: 1,
    fontSize: 12,
  },
  grandTotal: {
    fontSize: 22,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  footnote: {
    marginTop: 12,
    fontSize: 11.5,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 18,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
});
