import React, { useState } from 'react';
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
import { BackIcon, CrossIcon } from '../../components/common/SvgIcons';
import { getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';

interface WorkersScreenProps {
  initialStaff?: { name: string; role: string }[];
  onFinish: (staff: { name: string; role: string }[]) => void;
  onBack: () => void;
}

export const WorkersScreen = ({
  initialStaff,
  onFinish,
  onBack,
}: WorkersScreenProps) => {
  const { colors } = useTheme();

  const [staffDraft, setStaffDraft] = useState<{ name: string; role: string }[]>(
    initialStaff || []
  );

  const [newStaffName, setNewStaffName] = useState('');

  const handleAddStaff = () => {
    if (newStaffName.trim()) {
      setStaffDraft((prev) => [
        ...prev,
        { name: newStaffName.trim(), role: 'Stylist' },
      ]);
      setNewStaffName('');
    }
  };

  const handleRemove = (index: number) => {
    setStaffDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>

        <Text style={[styles.heading, { color: colors.text }]}>Who works here?</Text>
        <Text style={[styles.subheading, { color: colors.textDim }]}>
          Step 2 of 2 · every bill gets tagged to a stylist, so Accounts can show what each
          one delivers.
        </Text>

        <View style={styles.list}>
          {staffDraft.length === 0 ? (
            <View style={[styles.emptyPrompt, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
              <Text style={[styles.emptyPromptTitle, { color: colors.text }]}>No team members added yet</Text>
              <Text style={[styles.emptyPromptSub, { color: colors.textDim }]}>
                Type a stylist or worker name below and tap Add, or continue to add them later.
              </Text>
            </View>
          ) : (
            staffDraft.map((s, idx) => (
              <View
                key={idx}
                style={[styles.memberCard, { backgroundColor: colors.surface }]}
              >
                <View
                  style={[
                    styles.avatar,
                    {
                      backgroundColor: colors.accent800,
                    },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: colors.accent100 }]}>
                    {getInitials(s.name)}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[styles.memberRole, { color: colors.textDim }]}>{s.role}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemove(idx)}
                  style={styles.removeButton}
                  activeOpacity={0.7}
                >
                  <CrossIcon size={16} color={colors.textDim} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.addMemberRow}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
            placeholder="Worker or stylist name"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            value={newStaffName}
            onChangeText={setNewStaffName}
          />
          <Button
            label="Add"
            variant="secondary"
            onPress={handleAddStaff}
            style={{ paddingHorizontal: 16 }}
          />
        </View>

        <Button
          label={
            staffDraft.length > 0
              ? `Finish setup · ${staffDraft.length} on the team`
              : 'Continue to Setup'
          }
          block
          onPress={() => onFinish(staffDraft)}
          style={{ marginTop: 20 }}
        />

        <Button
          label="Skip for now"
          variant="secondary"
          block
          onPress={() => onFinish([])}
          style={{ marginTop: 10 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
  },
  heading: {
    fontSize: 24,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 12.5,
    marginBottom: 18,
    lineHeight: 18,
  },
  list: {
    gap: 8,
    marginBottom: 14,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
  },
  memberRole: {
    fontSize: 11.5,
  },
  removeButton: {
    padding: 4,
  },
  addMemberRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  emptyPrompt: {
    padding: 16,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyPromptTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyPromptSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
