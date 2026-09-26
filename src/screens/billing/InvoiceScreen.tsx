import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Platform,
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
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';
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

  // Helper to ensure logo is correctly base64-encoded for PDF and Print
  const getSafeLogoUri = async (): Promise<string | null> => {
    if (!shopLogoUrl) return null;
    if (shopLogoUrl.startsWith('http') || shopLogoUrl.startsWith('data:')) {
      return shopLogoUrl;
    }
    try {
      const fileUri = shopLogoUrl.startsWith('file://') ? shopLogoUrl : `file://${shopLogoUrl}`;
      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = shopLogoUrl.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      return `data:image/${ext};base64,${b64}`;
    } catch (e) {
      console.warn('[InvoiceScreen] Failed to read logo as base64:', e);
      return shopLogoUrl;
    }
  };

  // Helper to generate the PDF file
  const generatePdfFile = async () => {
    const safeLogo = await getSafeLogoUri();

    const html = generateInvoiceHtml({
      bill,
      shopName,
      shopAddress,
      shopGstin,
      shopLogoUrl: safeLogo,
    });

    return await Print.printToFileAsync({ html, base64: true });
  };

  // Directly save PDF into Android Downloads/Device folder via SAF or iOS Documents
  const savePdfToStorage = async () => {
    try {
      setIsExportingPdf(true);
      const { uri, base64 } = await generatePdfFile();
      const cleanNumber = bill.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Invoice_${cleanNumber}`;

      if (Platform.OS === 'android') {
        let permissions = null;
        try {
          permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        } catch {
          permissions = null;
        }

        if (permissions && permissions.granted) {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            filename,
            'application/pdf'
          );

          if (base64) {
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } else {
            const data = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            }).catch(() => null);
            if (data) {
              await FileSystem.writeAsStringAsync(fileUri, data, {
                encoding: FileSystem.EncodingType.Base64,
              });
            } else {
              await FileSystem.copyAsync({ from: uri, to: fileUri });
            }
          }

          Alert.alert(
            'PDF Saved Successfully',
            `Invoice ${bill.invoice_number}.pdf has been saved to your selected folder.`
          );
        } else {
          // If user cancelled folder picker, gracefully save to documents folder
          const fallbackDest = `${FileSystem.documentDirectory}${filename}.pdf`;
          const exists = await FileSystem.getInfoAsync(fallbackDest);
          if (exists.exists) {
            await FileSystem.deleteAsync(fallbackDest, { idempotent: true });
          }
          if (base64) {
            await FileSystem.writeAsStringAsync(fallbackDest, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } else {
            await FileSystem.copyAsync({ from: uri, to: fallbackDest });
          }
          Alert.alert(
            'PDF Saved',
            `Invoice ${bill.invoice_number}.pdf has been saved to device storage.`
          );
        }
      } else {
        const dest = `${FileSystem.documentDirectory}${filename}.pdf`;
        const exists = await FileSystem.getInfoAsync(dest);
        if (exists.exists) {
          await FileSystem.deleteAsync(dest, { idempotent: true });
        }
        if (base64) {
          await FileSystem.writeAsStringAsync(dest, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else {
          await FileSystem.copyAsync({ from: uri, to: dest });
        }
        Alert.alert(
          'PDF Saved Successfully',
          `Invoice ${bill.invoice_number}.pdf has been saved to your documents.`
        );
      }
    } catch (err: any) {
      console.warn('Save PDF error:', err);
      Alert.alert('Storage Notice', err.message || 'Could not save PDF to selected folder.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Safe share handler with graceful fallback and no raw expo-sharing errors
  const sharePdf = async () => {
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
          dialogTitle: `Invoice ${bill.invoice_number}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        await savePdfToStorage();
      }
    } catch (err: any) {
      console.warn('Share error:', err);
      // Fallback directly to storage save without throwing raw expo errors
      await savePdfToStorage();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Generate & Download/Share PDF
  const handlePdf = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        `Invoice ${bill.invoice_number}`,
        'Choose how you want to access the invoice PDF:',
        [
          {
            text: '📥 Save to Phone (Downloads)',
            onPress: () => savePdfToStorage(),
          },
          {
            text: '📤 Share PDF',
            onPress: () => sharePdf(),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      sharePdf();
    }
  };

  // Direct Native Print
  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const safeLogo = await getSafeLogoUri();
      const html = generateInvoiceHtml({
        bill,
        shopName,
        shopAddress,
        shopGstin,
        shopLogoUrl: safeLogo,
      });
      await Print.printAsync({ html });
    } catch (err: any) {
      console.warn('Print error:', err);
      Alert.alert('Print Error', err.message || 'Could not send invoice to printer.');
    } finally {
      setIsPrinting(false);
    }
  };

  // Direct WhatsApp Chat with Customer
  const handleWhatsApp = async () => {
    const rawPhone = customerPhone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

    const itemsSummary = bill.items
      .map(
        (it) =>
          `• ${it.service_name_snapshot}: ₹${Math.round(it.unit_price_minor / 100).toLocaleString('en-IN')}`
      )
      .join('\n');

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
      `*Total Paid: ₹${Math.round(bill.total_minor / 100).toLocaleString('en-IN')}* (${bill.payment_method.toUpperCase()})\n\n` +
      `Thank you for visiting ${shopName}! ✨`;

    if (cleanPhone.length === 10) {
      const nativeUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
      const webUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

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
    } else {
      Alert.alert(
        'WhatsApp Invoice',
        'Customer does not have a 10-digit mobile number saved. Would you like to share the PDF invoice instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share PDF', onPress: handlePdf },
        ]
      );
    }

    onSendWhatsApp?.(bill);
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
            <View>
              <Text style={[styles.metaLabel, { color: colors.textDim }]}>{t('billedTo')}</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {bill.customer_name}
              </Text>
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

          {/* Paid Row */}
          <View style={styles.paidRow}>
            <Text style={[styles.paidLabel, { color: colors.textDim }]}>
              {t('paidVia')} · {bill.payment_method}
            </Text>
            <Text style={[styles.grandTotal, { color: colors.text }]}>
              {inrFromMinor(bill.total_minor)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            label="Send on WhatsApp"
            icon={<ChatIcon size={16} color={colors.accent100} />}
            onPress={handleWhatsApp}
            style={{ flex: 1 }}
          />
          <Button
            label={isExportingPdf ? 'Saving...' : 'PDF'}
            variant="secondary"
            disabled={isExportingPdf}
            onPress={handlePdf}
            style={{ paddingHorizontal: 16 }}
          />
          <Button
            label={isPrinting ? 'Printing...' : 'Print'}
            variant="secondary"
            disabled={isPrinting}
            onPress={handlePrint}
            style={{ paddingHorizontal: 16 }}
          />
        </View>

        <Text style={[styles.footnote, { color: colors.textSubtle }]}>
          Official invoice generated with Salon OS.
        </Text>
      </ScrollView>
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
    letterSpacing: -0.3,
  },
  shopMeta: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  logoThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
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
});
