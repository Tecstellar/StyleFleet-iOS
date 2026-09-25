import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { CheckIcon } from '../../components/common/SvgIcons';
import { Bill } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { radii } from '../../theme/spacing';

interface SentScreenProps {
  bill: Bill;
  shopName: string;
  onNextBill: () => void;
  onDone: () => void;
}

export const SentScreen = ({
  bill,
  shopName,
  onNextBill,
  onDone,
}: SentScreenProps) => {
  const { colors } = useTheme();

  const previewText = `${shopName}: Thanks, ${bill.customer_name}! Invoice ${
    bill.invoice_number
  } for ${inrFromMinor(bill.total_minor)} is attached. Paid by ${
    bill.payment_method
  }. See you in 4 weeks — reply BOOK to hold your chair.`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        {/* Accent check circle */}
        <View
          style={[
            styles.checkCircle,
            { borderColor: colors.accent },
          ]}
        >
          <CheckIcon size={22} color={colors.accent} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Sent to {bill.customer_name}
        </Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          Invoice {bill.invoice_number} · {inrFromMinor(bill.total_minor)} · delivered
          on WhatsApp
        </Text>

        {/* WhatsApp chat bubble */}
        <View
          style={[
            styles.chatBubble,
            { backgroundColor: colors.accent900 },
          ]}
        >
          <Text style={[styles.chatText, { color: colors.accent100 }]}>
            {previewText}
          </Text>
        </View>
        <Text style={[styles.deliveryTimestamp, { color: colors.textSubtle }]}>
          delivered · 9:32
        </Text>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <Button
            label="Next bill"
            variant="secondary"
            onPress={onNextBill}
            style={{ flex: 1 }}
          />
          <Button
            label="Done"
            variant="primary"
            onPress={onDone}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  checkCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 23,
    fontWeight: '500',
    marginTop: 18,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  chatBubble: {
    alignSelf: 'flex-end',
    maxWidth: 270,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  deliveryTimestamp: {
    alignSelf: 'flex-end',
    fontSize: 10,
    marginTop: 5,
  },
  actionsRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 8,
  },
});
