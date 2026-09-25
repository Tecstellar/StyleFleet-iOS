import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../components/common/Button';
import { BackIcon } from '../../components/common/SvgIcons';
import { Chip } from '../../components/common/Chip';
import {
  WHATSAPP_TEMPLATES,
  WhatsAppAudience,
  whatsappRepository,
} from '../../repositories/whatsappRepository';
import { Customer } from '../../types/domain';
import { radii } from '../../theme/spacing';

interface BulkWhatsAppScreenProps {
  shopName: string;
  customers?: Customer[];
  onBack: () => void;
  onSendBulk: (params: { audience: WhatsAppAudience; message: string }) => void;
}

export const BulkWhatsAppScreen = ({
  shopName,
  customers = [],
  onBack,
  onSendBulk,
}: BulkWhatsAppScreenProps) => {
  const { colors } = useTheme();

  const audiences: WhatsAppAudience[] = useMemo(() => {
    const list = customers || [];
    const totalCount = list.length;
    const mvpCount = list.filter((c) => c.is_starred).length;
    const duesCount = list.filter((c) => (c.outstanding_due_minor || 0) > 0).length;
    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const inactiveCount = list.filter((c) => {
      if (!c.last_visit_date) return false;
      const v = new Date(c.last_visit_date).getTime();
      return !isNaN(v) && nowMs - v > thirtyDaysMs;
    }).length;

    return [
      { id: 0, label: 'All customers', count: totalCount },
      { id: 1, label: 'MVP · starred', count: mvpCount },
      { id: 2, label: 'Pending dues', count: duesCount },
      { id: 3, label: 'Not seen in 30 days', count: inactiveCount },
    ];
  }, [customers]);

  const [selectedAudienceId, setSelectedAudienceId] = useState(0);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('Monthly offer');
  const [message, setMessage] = useState(WHATSAPP_TEMPLATES['Monthly offer']);

  const currentAudience =
    audiences.find((a) => a.id === selectedAudienceId) ||
    audiences[0];

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    setMessage(WHATSAPP_TEMPLATES[key]);
  };

  const sampleCustomerName = customers.length > 0 ? customers[0].name : 'Customer';

  const previewText = whatsappRepository.renderPreview(
    message,
    sampleCustomerName,
    shopName,
    '20% off'
  );

  const sendMinutes = Math.max(1, Math.round(currentAudience.count / 40));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>Bulk WhatsApp</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Audience Selection */}
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>WHO GETS IT</Text>
        <View style={styles.audienceList}>
          {audiences.map((aud) => {
            const isSelected = selectedAudienceId === aud.id;
            return (
              <TouchableOpacity
                key={aud.id}
                activeOpacity={0.75}
                onPress={() => setSelectedAudienceId(aud.id)}
                style={[
                  styles.audienceCard,
                  {
                    backgroundColor: isSelected ? colors.accent900 : colors.surface,
                    borderColor: isSelected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.radioDot,
                    {
                      borderColor: isSelected ? colors.accent : colors.textSubtle,
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                    },
                  ]}
                />
                <Text style={[styles.audienceLabel, { color: colors.text }]}>
                  {aud.label}
                </Text>
                <Text style={[styles.audienceCount, { color: colors.textDim }]}>
                  {aud.count} people
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Message Templates & Input */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 16 }]}>
          MESSAGE
        </Text>
        <View style={styles.templatesRow}>
          {Object.keys(WHATSAPP_TEMPLATES).map((key) => (
            <Chip
              key={key}
              label={key}
              active={selectedTemplateKey === key}
              onPress={() => handleSelectTemplate(key)}
              size="sm"
            />
          ))}
        </View>

        <TextInput
          style={[
            styles.messageInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.divider,
              color: colors.text,
            },
          ]}
          multiline
          numberOfLines={4}
          value={message}
          onChangeText={setMessage}
        />
        <Text style={[styles.inputHint, { color: colors.textSubtle }]}>
          Tap to insert · [name] [shop] [offer] — filled per customer when sending.
        </Text>

        {/* Preview */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 16 }]}>
          PREVIEW
        </Text>
        <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.chatBubble,
              { backgroundColor: colors.accent900 },
            ]}
          >
            <Text style={[styles.chatBubbleText, { color: colors.accent100 }]}>
              {previewText}
            </Text>
          </View>
          <Text style={[styles.previewSub, { color: colors.textSubtle }]}>
            as {sampleCustomerName} will see it
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Text style={[styles.batchNote, { color: colors.textDim }]}>
          Sends in batches of 40 · about {sendMinutes} minutes
        </Text>
        <Button
          label={`Send to ${currentAudience.count} customers`}
          block
          onPress={() =>
            onSendBulk({
              audience: currentAudience,
              message,
            })
          }
        />
      </View>
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
    paddingVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  audienceList: {
    gap: 7,
  },
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  audienceLabel: {
    flex: 1,
    fontSize: 13.5,
  },
  audienceCount: {
    fontSize: 12,
  },
  templatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 9,
  },
  messageInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 11,
    marginTop: 6,
  },
  previewCard: {
    padding: 12,
    borderRadius: radii.md,
  },
  chatBubble: {
    maxWidth: 260,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  previewSub: {
    fontSize: 10,
    marginTop: 6,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  batchNote: {
    fontSize: 11.5,
    marginBottom: 8,
  },
});
