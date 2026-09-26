import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, PlusIcon, ChatIcon } from '../../components/common/SvgIcons';
import { Appointment, AppointmentStatus } from '../../types/domain';
import { inrFromMinor } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';

interface AppointmentsScreenProps {
  appointments: Appointment[];
  shopName?: string;
  onBack: () => void;
  onBook: () => void;
  onAdvanceStatus: (appointmentId: string, currentStatus: AppointmentStatus) => void;
  onBillAndClose: (appointment: Appointment) => void;
}

function parseAppointmentDateTime(startsAt: string): Date | null {
  if (!startsAt) return null;
  if (startsAt.includes('T')) {
    const d = new Date(startsAt);
    if (!isNaN(d.getTime())) return d;
  }
  const parts = startsAt.trim().split(' ');
  let datePart = '';
  let timePart = '';
  let ampmPart = '';

  if (parts.length >= 2 && parts[0].includes('-')) {
    datePart = parts[0];
    timePart = parts[1];
    ampmPart = parts[2] || '';
  } else if (parts[0].includes('-')) {
    datePart = parts[0];
  } else {
    datePart = new Date().toISOString().split('T')[0];
    timePart = parts[0];
    ampmPart = parts[1] || '';
  }

  if (!timePart) return null;
  const [hStr, mStr] = timePart.split(':');
  let hour = parseInt(hStr, 10);
  const min = parseInt(mStr || '0', 10);
  if (isNaN(hour)) return null;

  if (ampmPart) {
    if (ampmPart.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (ampmPart.toUpperCase() === 'AM' && hour === 12) hour = 0;
  } else {
    if (hour >= 1 && hour <= 7) {
      hour += 12;
    }
  }

  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, min, 0, 0);
}

export const AppointmentsScreen = ({
  appointments,
  shopName = 'Our Salon',
  onBack,
  onBook,
  onAdvanceStatus,
  onBillAndClose,
}: AppointmentsScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Dynamic 7-day slider starting from Today
  const upcomingDays = useMemo(() => {
    const list: { dateStr: string; dow: string; dateNum: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dow = i === 0 ? t('today') : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = String(d.getDate());
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      list.push({ dateStr, dow, dateNum, label });
    }
    return list;
  }, []);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = upcomingDays[selectedDayIndex] || upcomingDays[0];

  // Filter appointments for selected day
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (a.starts_at && a.starts_at.includes(selectedDay.dateStr)) {
        return true;
      }
      // If date is today and appointment only has time slot (e.g. "10:00 AM"), show under Today
      if (selectedDayIndex === 0 && a.starts_at && !a.starts_at.includes('-')) {
        return true;
      }
      return false;
    });
  }, [appointments, selectedDay, selectedDayIndex]);

  const totalExpectedMinor = filteredAppointments.reduce((sum, a) => sum + (a.amount_minor || 0), 0);

  // Direct WhatsApp Reminder for this specific customer
  const handleDirectWhatsAppRemind = (a: Appointment) => {
    const phone = a.customer_phone?.replace(/\D/g, '').slice(-10);
    if (!phone) {
      Alert.alert(
        'Phone Missing',
        `No phone number recorded for ${a.customer_name}. Please update client profile to send WhatsApp.`
      );
      return;
    }

    const timeDisplay = a.starts_at.includes(' ') ? a.starts_at.split(' ').slice(1).join(' ') : a.starts_at;
    const targetDate = parseAppointmentDateTime(a.starts_at);
    let timeNote = `You have an appointment today at *${timeDisplay}*.`;

    if (targetDate) {
      const diffMs = targetDate.getTime() - Date.now();
      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours > 0 && mins > 0) {
          timeNote = `You only have ${hours} hour${hours > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''} left for your booking at *${timeDisplay}*.`;
        } else if (hours > 0) {
          timeNote = `You only have ${hours} hour${hours > 1 ? 's' : ''} left for your booking at *${timeDisplay}*.`;
        } else if (mins > 0) {
          timeNote = `You only have ${mins} minute${mins > 1 ? 's' : ''} left for your booking at *${timeDisplay}*.`;
        } else {
          timeNote = `Your booking at *${timeDisplay}* is starting right now!`;
        }
      }
    }

    const msg = `Hello ${a.customer_name}! 💈 Reminder from *${shopName}*: ${timeNote} Please come to the salon at that time. See you soon! ✨`;
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Notice', 'WhatsApp application is not installed on this device');
        }
      })
      .catch(() => {
        Alert.alert('Notice', 'Could not open WhatsApp');
      });
  };

  const getStatusBadgeStyle = (status: AppointmentStatus) => {
    switch (status) {
      case 'In chair':
        return {
          bg: colors.accent900,
          border: colors.accent,
          text: colors.accent200,
        };
      case 'Done':
        return {
          bg: 'rgba(52, 199, 89, 0.15)',
          border: 'rgba(52, 199, 89, 0.4)',
          text: '#34C759',
        };
      case 'Confirmed':
      default:
        return {
          bg: 'transparent',
          border: colors.divider,
          text: colors.textMuted,
        };
    }
  };

  const getRailColor = (status: AppointmentStatus) => {
    if (status === 'In chair') return colors.accent;
    if (status === 'Done') return '#34C759';
    return colors.accent800;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Button variant="icon" onPress={onBack}>
            <BackIcon size={18} color={colors.text} />
          </Button>
          <Text style={[styles.title, { color: colors.text }]}>{t('appointments')}</Text>
        </View>

        {/* Dynamic Day selection chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayScroll}
        >
          {upcomingDays.map((d, i) => {
            const isSelected = selectedDayIndex === i;
            const countForDay = appointments.filter((a) => {
              if (a.starts_at && a.starts_at.includes(d.dateStr)) return true;
              if (i === 0 && a.starts_at && !a.starts_at.includes('-')) return true;
              return false;
            }).length;

            return (
              <TouchableOpacity
                key={d.dateStr}
                activeOpacity={0.75}
                onPress={() => setSelectedDayIndex(i)}
                style={[
                  styles.dayChip,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dowText,
                    { color: isSelected ? colors.accent200 : colors.textDim },
                  ]}
                >
                  {d.dow}
                </Text>
                <Text
                  style={[
                    styles.dateNumText,
                    { color: isSelected ? colors.accent200 : colors.text },
                  ]}
                >
                  {d.dateNum}
                </Text>
                <Text
                  style={[
                    styles.countText,
                    { color: isSelected ? colors.accent200 : colors.textSubtle },
                  ]}
                >
                  {countForDay}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Agenda summary line */}
        <Text style={[styles.summaryText, { color: colors.textDim }]}>
          {filteredAppointments.length} {t('appointments')} · {inrFromMinor(totalExpectedMinor)}
        </Text>

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📅</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('noAppointments')}
            </Text>
          </View>
        ) : (
          /* Agenda list */
          <View style={styles.list}>
            {filteredAppointments.map((a) => {
              const badgeStyle = getStatusBadgeStyle(a.status);
              const railColor = getRailColor(a.status);
              const timeDisplay = a.starts_at.includes(' ')
                ? a.starts_at.split(' ').slice(1).join(' ')
                : a.starts_at;

              return (
                <View key={a.id} style={styles.appointmentRow}>
                  {/* Time Column */}
                  <View style={styles.timeColumn}>
                    <Text style={[styles.timeText, { color: colors.text }]}>
                      {timeDisplay}
                    </Text>
                    <Text style={[styles.durText, { color: colors.textDim }]}>
                      {a.duration_minutes || 45}m
                    </Text>
                  </View>

                  {/* Vertical Indicator Rail */}
                  <View style={[styles.rail, { backgroundColor: railColor }]} />

                  {/* Details Card */}
                  <View style={[styles.card, { backgroundColor: colors.surface }]}>
                    <View style={styles.cardHeader}>
                      <Text
                        numberOfLines={1}
                        style={[styles.customerName, { color: colors.text }]}
                      >
                        {a.customer_name}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: badgeStyle.bg,
                            borderColor: badgeStyle.border,
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
                          {a.status}
                        </Text>
                      </View>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[styles.serviceSub, { color: colors.textDim }]}
                    >
                      {a.service_name} · {a.staff_name || t('anyStylist')} · {inrFromMinor(a.amount_minor || 0)}
                    </Text>

                    {/* Actions buttons */}
                    <View style={styles.actionsRow}>
                      {/* Action 1: Status Progression or Bill */}
                      {a.status === 'Confirmed' && (
                        <TouchableOpacity
                          onPress={() => onAdvanceStatus(a.id, a.status)}
                          activeOpacity={0.7}
                          style={[
                            styles.advanceButton,
                            { backgroundColor: colors.accent900, borderColor: colors.accent },
                          ]}
                        >
                          <Text style={[styles.advanceButtonText, { color: colors.accent200 }]}>
                            {t('markArrived')}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {a.status === 'In chair' && (
                        <TouchableOpacity
                          onPress={() => onBillAndClose(a)}
                          activeOpacity={0.7}
                          style={[
                            styles.advanceButton,
                            { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                        >
                          <Text style={[styles.advanceButtonText, { color: '#000', fontWeight: '700' }]}>
                            {t('billAndClose')}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {a.status === 'Done' && (
                        <View
                          style={[
                            styles.advanceButton,
                            { backgroundColor: 'rgba(52, 199, 89, 0.1)', borderColor: 'rgba(52, 199, 89, 0.3)' },
                          ]}
                        >
                          <Text style={[styles.advanceButtonText, { color: '#34C759' }]}>
                            ✓ Billed
                          </Text>
                        </View>
                      )}

                      {/* Action 2: Direct WhatsApp Reminder (only before In chair) */}
                      {a.status === 'Confirmed' && (
                        <TouchableOpacity
                          onPress={() => handleDirectWhatsAppRemind(a)}
                          activeOpacity={0.7}
                          style={styles.remindButton}
                        >
                          <Text style={[styles.remindButtonText, { color: colors.accent }]}>
                            💬 {t('remind')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Booking */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onBook}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent800,
            borderColor: colors.accent,
          },
        ]}
      >
        <PlusIcon size={18} color={colors.accent100} />
        <Text style={[styles.fabText, { color: colors.accent100 }]}>{t('newAppointment')}</Text>
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
    paddingTop: 8,
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
  dayScroll: {
    marginTop: 12,
    marginBottom: 4,
  },
  dayChip: {
    width: 52,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dowText: {
    fontSize: 10,
  },
  dateNumText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  countText: {
    fontSize: 9,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  summaryText: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  appointmentRow: {
    flexDirection: 'row',
    gap: 11,
  },
  timeColumn: {
    width: 60,
    alignItems: 'flex-end',
    paddingTop: 11,
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  durText: {
    fontSize: 10,
    marginTop: 2,
  },
  rail: {
    width: 2,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  serviceSub: {
    fontSize: 11.5,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 9,
  },
  advanceButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  advanceButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  remindButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  remindButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
});
