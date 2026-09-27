import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, CheckIcon, SearchIcon, PlusIcon, UserPlusIcon } from '../../components/common/SvgIcons';
import { Customer, StaffMember, Service, Appointment } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';

const ALL_TIME_SLOTS = [
  { label: '09:30 AM', hour: 9, min: 30 },
  { label: '10:00 AM', hour: 10, min: 0 },
  { label: '10:30 AM', hour: 10, min: 30 },
  { label: '11:00 AM', hour: 11, min: 0 },
  { label: '11:30 AM', hour: 11, min: 30 },
  { label: '12:00 PM', hour: 12, min: 0 },
  { label: '12:30 PM', hour: 12, min: 30 },
  { label: '01:00 PM', hour: 13, min: 0 },
  { label: '02:00 PM', hour: 14, min: 0 },
  { label: '02:30 PM', hour: 14, min: 30 },
  { label: '03:00 PM', hour: 15, min: 0 },
  { label: '03:30 PM', hour: 15, min: 30 },
  { label: '04:00 PM', hour: 16, min: 0 },
  { label: '04:30 PM', hour: 16, min: 30 },
  { label: '05:00 PM', hour: 17, min: 0 },
  { label: '05:30 PM', hour: 17, min: 30 },
  { label: '06:00 PM', hour: 18, min: 0 },
  { label: '06:30 PM', hour: 18, min: 30 },
  { label: '07:00 PM', hour: 19, min: 0 },
  { label: '07:30 PM', hour: 19, min: 30 },
  { label: '08:00 PM', hour: 20, min: 0 },
  { label: '08:30 PM', hour: 20, min: 30 },
] as const;

function getSlotHourMin(timeStr?: string): { hour: number; min: number } | null {
  if (!timeStr) return null;
  const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === 'PM' && h < 12) h += 12;
    if (meridian === 'AM' && h === 12) h = 0;
    return { hour: h, min: m };
  }
  const iso24Match = timeStr.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  if (iso24Match) {
    return { hour: parseInt(iso24Match[1], 10), min: parseInt(iso24Match[2], 10) };
  }
  const simpleMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1], 10);
    const m = parseInt(simpleMatch[2], 10);
    if (h >= 1 && h <= 7) h += 12;
    return { hour: h, min: m };
  }
  return null;
}

function getApptDateStr(appt: Appointment): string {
  if (appt.starts_at) {
    const m = appt.starts_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  if (appt.created_at) {
    const m = appt.created_at.match(/\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
  }
  return '';
}

interface BookingScreenProps {
  customers: Customer[];
  services: Service[];
  staff: StaffMember[];
  appointments?: Appointment[];
  initialCustomerId?: string | null;
  onBack: () => void;
  onAddNewCustomer?: (name: string, phone: string) => Promise<Customer>;
  onConfirmBooking: (booking: {
    customerName: string;
    customerId?: string | null;
    customerPhone?: string | null;
    serviceName: string;
    serviceId?: string | null;
    serviceIds?: string[];
    stylistName: string;
    stylistId?: string | null;
    slot: string;
    dateStr: string;
    amountRupees: number;
    sendConfirm: boolean;
  }) => void;
}

export const BookingScreen = ({
  customers,
  services,
  staff,
  appointments = [],
  initialCustomerId,
  onBack,
  onAddNewCustomer,
  onConfirmBooking,
}: BookingScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId || null
  );
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Service multi-selection & Expand state (no services pre-selected)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);

  // Stylist selection: null means "Any Stylist / No Stylist"
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Date selection - strictly Today and future days (no past dates)
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = Today
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [sendConfirm, setSendConfirm] = useState(true);

  // Generate next 14 days starting from Today
  const upcomingDays = useMemo(() => {
    const days: { offset: number; dateStr: string; dayLabel: string; dateNum: number; fullDate: Date }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dayLabel = i === 0 ? t('today') : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateNum = d.getDate();
      const dateStr = d.toISOString().split('T')[0];
      days.push({ offset: i, dateStr, dayLabel, dateNum, fullDate: d });
    }
    return days;
  }, [t]);

  const selectedDay = upcomingDays[selectedDayOffset] || upcomingDays[0];

  // Check if slot has already passed if today is selected
  const now = new Date();
  const isSelectedDateToday = selectedDayOffset === 0;

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 5);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
  const selectedStaffMember = staff.find((s) => s.id === selectedStaffId) || null;

  // Booked slots map for the selected stylist on the selected date (fast, zero lag)
  const bookedSlotsMap = useMemo(() => {
    const map = new Map<string, Appointment>();
    if (!selectedStaffId) return map;

    const targetDate = selectedDay.dateStr;

    for (const a of appointments) {
      if (a.status === 'Cancelled' || a.status === 'Done') continue;
      const matchesStaff =
        a.staff_id === selectedStaffId ||
        (selectedStaffMember &&
          a.staff_name &&
          a.staff_name.trim().toLowerCase() === selectedStaffMember.name.trim().toLowerCase());
      if (!matchesStaff) continue;

      const apptDate = getApptDateStr(a);
      if (apptDate) {
        if (apptDate !== targetDate) continue;
      } else {
        // If appointment does not have a date, check if created_at matches targetDate
        const createdDate = a.created_at ? a.created_at.slice(0, 10) : '';
        if (createdDate !== targetDate) continue;
      }

      const raw = (a.starts_at || '').toUpperCase();
      const hm = getSlotHourMin(a.starts_at);

      for (const sl of ALL_TIME_SLOTS) {
        const cleanSlot = sl.label.toUpperCase();
        const noLeadingZero = cleanSlot.replace(/^0/, '');
        if (raw.includes(cleanSlot) || raw.includes(noLeadingZero)) {
          map.set(sl.label, a);
          break;
        } else if (hm && hm.hour === sl.hour && hm.min === sl.min) {
          map.set(sl.label, a);
          break;
        }
      }
    }
    return map;
  }, [selectedStaffId, selectedStaffMember, selectedDay.dateStr, selectedDay.offset, appointments]);

  // Deselect slot if it conflicts with a booked slot
  React.useEffect(() => {
    if (selectedSlot && bookedSlotsMap.has(selectedSlot)) {
      setSelectedSlot(null);
    }
  }, [selectedSlot, bookedSlotsMap]);

  // Selected services list & totals
  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const totalBookingRupees = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + Math.round(s.price_minor / 100), 0);
  }, [selectedServices]);

  const combinedServiceName = useMemo(() => {
    return selectedServices.map((s) => s.name).join(' + ') || '';
  }, [selectedServices]);

  const toggleService = (svcId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  // Categorised service groups
  const categoryGroups = useMemo(() => {
    const categories = ['Hair', 'Beard', 'Colour', 'Care', 'Packages'] as const;
    const groups: { category: string; services: Service[] }[] = [];

    for (const cat of categories) {
      const catServices = services.filter((s) => s.category_name === cat);
      if (catServices.length > 0) {
        groups.push({ category: cat, services: catServices });
      }
    }

    const otherServices = services.filter(
      (s) => !categories.includes(s.category_name as any)
    );
    if (otherServices.length > 0) {
      groups.push({ category: 'Other Services', services: otherServices });
    }

    return groups;
  }, [services]);

  // Popular services sorted at top
  const popularServices = useMemo(() => {
    return services.slice(0, 6);
  }, [services]);

  const handleQuickAddClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Name Required', 'Please enter customer name');
      return;
    }
    const cleanPhone = newClientPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      if (onAddNewCustomer) {
        const created = await onAddNewCustomer(newClientName.trim(), cleanPhone);
        setSelectedCustomerId(created.id);
      }
      setIsAddClientModalOpen(false);
      setNewClientName('');
      setNewClientPhone('');
      setCustomerSearch('');
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Could not save customer');
    }
  };

  const isSelectedSlotLocked = Boolean(selectedSlot && bookedSlotsMap.has(selectedSlot));

  const bookIncomplete = selectedServices.length === 0 || !selectedSlot || isSelectedSlotLocked;

  const handleConfirm = () => {
    if (bookIncomplete) return;
    const custName = selectedCustomer ? selectedCustomer.name : 'Walk-in';
    const custPhone = selectedCustomer ? selectedCustomer.phone : null;
    const stylistName = selectedStaffMember ? selectedStaffMember.name : 'Any Stylist';

    onConfirmBooking({
      customerName: custName,
      customerId: selectedCustomerId,
      customerPhone: custPhone,
      serviceName: combinedServiceName,
      serviceId: selectedServiceIds[0] || null,
      serviceIds: selectedServiceIds,
      stylistName: stylistName,
      stylistId: selectedStaffId,
      slot: selectedSlot!,
      dateStr: selectedDay.dateStr,
      amountRupees: totalBookingRupees,
      sendConfirm,
    });
  };

  const ctaText = selectedServices.length === 0
    ? t('selectServices')
    : isSelectedSlotLocked
    ? 'Slot Locked · Pick Another Slot'
    : selectedSlot
    ? `${t('confirmBooking')} · ${selectedDay.dayLabel} ${selectedSlot}`
    : 'Select Time Slot';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('newAppointment')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* ======================================================== */}
        {/* 1. CUSTOMER SELECTION (Exact match to NewBillScreen UX) */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>{t('client')}</Text>
        <View style={styles.customerActionRow}>
          {/* Customer Search Box */}
          <View
            style={[
              styles.customerSearchBox,
              {
                backgroundColor: colors.surface,
                borderColor: isSearchFocused ? colors.accent : colors.divider,
              },
            ]}
          >
            <SearchIcon size={15} color={colors.textDim} />
            <TextInput
              style={[styles.customerSearchInput, { color: colors.text }]}
              placeholder="Search client name or phone..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={customerSearch}
              onChangeText={(txt) => {
                setCustomerSearch(txt);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
            />
            {customerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setCustomerSearch('')}>
                <Text style={{ color: colors.textDim, paddingHorizontal: 4 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Walk-in Chip */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setSelectedCustomerId(null);
              setCustomerSearch('');
              setIsSearchFocused(false);
            }}
            style={[
              styles.walkInBtn,
              {
                borderColor: selectedCustomerId === null ? colors.accent : colors.divider,
                backgroundColor: selectedCustomerId === null ? colors.accent900 : colors.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.walkInBtnText,
                { color: selectedCustomerId === null ? colors.accent200 : colors.textMuted },
              ]}
            >
              {t('walkIn')}
            </Text>
          </TouchableOpacity>

          {/* Add Client Button (Icon Only) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsAddClientModalOpen(true)}
            accessibilityLabel={t('addClient', 'Add Client')}
            style={[
              styles.addClientBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            <UserPlusIcon size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Selected Customer Highlight Card */}
        {selectedCustomer && (
          <View
            style={[
              styles.selectedCustomerCard,
              {
                backgroundColor: colors.accent900,
                borderColor: colors.accent,
              },
            ]}
          >
            <View
              style={[
                styles.smallAvatar,
                { backgroundColor: selectedCustomer.is_starred ? colors.accent : colors.accent800 },
              ]}
            >
              <Text style={{ color: colors.bg, fontSize: 11, fontWeight: '700' }}>
                {getInitials(selectedCustomer.name)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.selectedCustName, { color: colors.accent100 }]}>
                  {selectedCustomer.name}
                </Text>
                {selectedCustomer.is_starred && (
                  <Text style={{ color: colors.accent, fontSize: 11, fontWeight: 'bold' }}>★ MVP</Text>
                )}
              </View>
              <Text style={{ color: colors.accent200, fontSize: 11 }}>+91 {selectedCustomer.phone}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedCustomerId(null)}
              style={styles.removeSelectedCustBtn}
            >
              <Text style={{ color: colors.accent200, fontSize: 12 }}>✕ Deselect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer Search Dropdown */}
        {isSearchFocused && customerSearch.trim().length > 0 && (
          <View
            style={[
              styles.searchDropdown,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            {filteredCustomers.length === 0 ? (
              <View style={{ padding: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>
                  No customer matching "{customerSearch}"
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setNewClientName(customerSearch);
                    setIsAddClientModalOpen(true);
                    setIsSearchFocused(false);
                  }}
                  style={{ marginTop: 6 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                    + Create "{customerSearch}"
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredCustomers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedCustomerId(c.id);
                    setCustomerSearch('');
                    setIsSearchFocused(false);
                  }}
                  style={[styles.dropdownItem, { borderBottomColor: colors.divider }]}
                >
                  <Text style={[styles.dropdownName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.dropdownPhone, { color: colors.textDim }]}>+91 {c.phone}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* 2. SERVICES (Expandable Multi-Choice)                   */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* 2. CHOOSE SERVICES TRIGGER BOX                           */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {t('services')} ({selectedServices.length} {t('selected', 'selected')})
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsServicesExpanded((prev) => !prev)}
          style={[
            styles.chooseServicesBox,
            {
              backgroundColor: colors.surface,
              borderColor: isServicesExpanded || selectedServiceIds.length > 0 ? colors.accent : colors.divider,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
            <Text style={{ fontSize: 16 }}>✨</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.chooseServicesTitle, { color: colors.text }]}>
                {t('chooseServices', 'Choose Services')}
              </Text>
              <Text
                style={[
                  styles.chooseServicesSub,
                  { color: selectedServiceIds.length > 0 ? colors.accent : colors.textDim },
                ]}
              >
                {selectedServiceIds.length === 0
                  ? 'Tap to select salon services'
                  : `${selectedServiceIds.length} service${selectedServiceIds.length > 1 ? 's' : ''} selected`}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>
            {isServicesExpanded ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {/* Selected Services Preview Bar */}
        {selectedServices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            {selectedServices.map((s) => (
              <View
                key={`sel_${s.id}`}
                style={[styles.selectedServiceTag, { backgroundColor: colors.accent900, borderColor: colors.accent }]}
              >
                <Text style={{ color: colors.accent100, fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
                <Text style={{ color: colors.accent200, fontSize: 11, marginLeft: 6 }}>
                  {inrFromMinor(s.price_minor)}
                </Text>
                <TouchableOpacity onPress={() => toggleService(s.id)} style={{ marginLeft: 6, padding: 2 }}>
                  <Text style={{ color: colors.accent200, fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* 3-COLUMN SQUARE GRID CONTAINER (Shown when expanded) */}
        {isServicesExpanded && (
          <View style={[styles.servicesGridContainer, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            {services.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textDim, fontSize: 13 }}>No services found. Add services in Prices & Offers.</Text>
              </View>
            ) : (
              <View style={styles.threeColumnGrid}>
                {services.map((s) => {
                  const isSelected = selectedServiceIds.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.75}
                      onPress={() => toggleService(s.id)}
                      style={[
                        styles.squareServiceCard,
                        {
                          backgroundColor: isSelected ? colors.accent900 : colors.bg,
                          borderColor: isSelected ? colors.accent : colors.divider,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.cardCheckBadge,
                          {
                            backgroundColor: isSelected ? colors.accent : 'transparent',
                            borderColor: isSelected ? colors.accent : colors.divider,
                          },
                        ]}
                      >
                        {isSelected && <Text style={{ color: '#000', fontSize: 9, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                      <Text
                        style={[
                          styles.squareServiceName,
                          { color: isSelected ? colors.accent100 : colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {s.name}
                      </Text>
                      <Text
                        style={[
                          styles.squareServicePrice,
                          { color: isSelected ? colors.accent : colors.textDim },
                        ]}
                      >
                        {inrFromMinor(s.price_minor)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* 3. STYLIST (Includes "Any Stylist" / "No Stylist")       */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {t('staff')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {/* Any Stylist Option */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setSelectedStaffId(null)}
            style={[
              styles.chip,
              {
                borderColor: selectedStaffId === null ? colors.accent : colors.divider,
                backgroundColor: selectedStaffId === null ? colors.accent900 : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedStaffId === null ? colors.accent200 : colors.textMuted },
              ]}
            >
              {t('anyStylist')}
            </Text>
          </TouchableOpacity>

          {/* Named Stylists */}
          {staff.map((s) => {
            const isSelected = selectedStaffId === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.75}
                onPress={() => setSelectedStaffId(s.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.accent200 : colors.textMuted },
                  ]}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ======================================================== */}
        {/* 4. DATE SELECTION (No past dates! Starts from Today)     */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          DATE · STRICTLY TODAY & FUTURE
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {upcomingDays.map((d) => {
            const isSelected = selectedDayOffset === d.offset;
            return (
              <TouchableOpacity
                key={d.offset}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedDayOffset(d.offset);
                  setSelectedSlot(null); // Reset slot on date change
                }}
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
                  {d.dayLabel}
                </Text>
                <Text
                  style={[
                    styles.dateNumText,
                    { color: isSelected ? colors.accent100 : colors.text },
                  ]}
                >
                  {d.dateNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ======================================================== */}
        {/* 5. TIME SLOTS (Conflict detection and locked styling)   */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          SLOT · {selectedDay.dayLabel.toUpperCase()} {selectedDay.dateNum}
        </Text>

        {/* Stylist Active Booking Notice */}
        {bookedSlotsMap.size > 0 && selectedStaffMember && (
          <View
            style={{
              padding: 10,
              borderRadius: radii.md,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              marginTop: 6,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#F87171', fontSize: 12.5, fontWeight: '700' }}>
              🔒 {selectedStaffMember.name} is booked at: {Array.from(bookedSlotsMap.keys()).join(', ')}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>
              Booked slots are striked out. Please choose an open slot.
            </Text>
          </View>
        )}

        <View style={styles.slotsGrid}>
          {ALL_TIME_SLOTS.map((sl) => {
            const bookedAppt = bookedSlotsMap.get(sl.label);
            const isBooked = Boolean(bookedAppt);
            const isSelected = selectedSlot === sl.label;

            // Check if slot has already passed for today
            let isPast = false;
            if (isSelectedDateToday) {
              const currentHour = now.getHours();
              const currentMin = now.getMinutes();
              if (sl.hour < currentHour || (sl.hour === currentHour && sl.min <= currentMin)) {
                isPast = true;
              }
            }

            const isSlotDisabled = isPast || isBooked;

            const handleSlotPress = () => {
              if (isPast) return;
              if (isBooked) {
                Alert.alert(
                  'Stylist Already Booked',
                  `${selectedStaffMember?.name || 'Stylist'} is already booked at ${sl.label} on this date. Please choose another time slot or another stylist.`,
                  [{ text: 'OK' }]
                );
                return;
              }
              setSelectedSlot(sl.label);
            };

            return (
              <TouchableOpacity
                key={sl.label}
                disabled={isSlotDisabled}
                activeOpacity={isSlotDisabled ? 1 : 0.75}
                onPress={handleSlotPress}
                style={[
                  styles.slotBox,
                  {
                    borderColor: isSelected
                      ? colors.accent
                      : isBooked
                      ? 'rgba(239, 68, 68, 0.6)'
                      : colors.divider,
                    backgroundColor: isSelected
                      ? colors.accent900
                      : isBooked
                      ? 'rgba(239, 68, 68, 0.12)'
                      : isPast
                      ? 'rgba(255,255,255,0.02)'
                      : colors.surface,
                    opacity: isPast ? 0.35 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    {
                      color: isSelected
                        ? colors.accent
                        : isBooked
                        ? '#EF4444'
                        : isPast
                        ? colors.textDim
                        : colors.text,
                      textDecorationLine: isBooked || isPast ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {sl.label}
                </Text>
                {isBooked && (
                  <Text
                    style={{
                      fontSize: 9.5,
                      color: '#EF4444',
                      fontWeight: '700',
                      marginTop: 2,
                    }}
                  >
                    Booked
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* WhatsApp confirmation checkbox */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSendConfirm(!sendConfirm)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: sendConfirm ? colors.accent : colors.divider,
                backgroundColor: sendConfirm ? colors.accent : 'transparent',
              },
            ]}
          >
            {sendConfirm ? <CheckIcon size={12} color="#161826" strokeWidth={3} /> : null}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textMuted }]}>
            Send WhatsApp reminder to client with direct chat link
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button
          label={ctaText}
          block
          disabled={bookIncomplete}
          onPress={handleConfirm}
        />
      </View>

      {/* ======================================================== */}
      {/* QUICK ADD CLIENT MODAL                                   */}
      {/* ======================================================== */}
      <Modal
        visible={isAddClientModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddClientModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setIsAddClientModalOpen(false)}
            />
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addNewCustomer')}</Text>
                  <TouchableOpacity onPress={() => setIsAddClientModalOpen(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>{t('cancel')}</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text },
                  ]}
                  placeholder={t('fullName')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={newClientName}
                  onChangeText={setNewClientName}
                />

                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text, marginTop: 10 },
                  ]}
                  placeholder={t('mobileNumber')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newClientPhone}
                  onChangeText={(txt) => setNewClientPhone(txt.replace(/\D/g, '').slice(0, 10))}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleQuickAddClient}
                  style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>{t('save')}</Text>
                </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 140,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 7,
  },
  customerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 13,
  },
  walkInBtn: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkInBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  addClientBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 8,
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustName: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeSelectedCustBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  searchDropdown: {
    marginTop: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    maxHeight: 180,
    ...shadows.md,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: '500',
  },
  dropdownPhone: {
    fontSize: 12,
  },
  scrollRow: {
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayChip: {
    width: 50,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dowText: {
    fontSize: 11,
  },
  dateNumText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  serviceChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  serviceChipName: {
    fontSize: 12.5,
  },
  serviceChipPrice: {
    fontSize: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotBox: {
    width: '23.5%',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalInput: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalAddBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  chooseServicesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  chooseServicesTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  chooseServicesSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  servicesGridContainer: {
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  squareServiceCard: {
    width: '31.3%',
    aspectRatio: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  cardCheckBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareServiceName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
  },
  squareServicePrice: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedServiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  expandedServicesBlock: {
    gap: 12,
    marginTop: 8,
  },
  categoryBlock: {
    marginBottom: 10,
  },
  categoryHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  expandedGrid: {
    gap: 6,
  },
  serviceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
