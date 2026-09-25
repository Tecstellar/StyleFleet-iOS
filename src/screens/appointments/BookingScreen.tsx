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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, CheckIcon, SearchIcon, PlusIcon } from '../../components/common/SvgIcons';
import { Customer, StaffMember, Service } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii, shadows } from '../../theme/spacing';

interface BookingScreenProps {
  customers: Customer[];
  services: Service[];
  staff: StaffMember[];
  initialCustomerId?: string | null;
  onBack: () => void;
  onAddNewCustomer?: (name: string, phone: string) => Promise<Customer>;
  onConfirmBooking: (booking: {
    customerName: string;
    customerId?: string | null;
    customerPhone?: string | null;
    serviceName: string;
    serviceId?: string | null;
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

  // Service multi-selection & Expand state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    services[0]?.id ? [services[0].id] : []
  );
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);

  // Stylist selection: -1 means "Any Stylist / No Stylist"
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

  // Standard salon time slots
  const allTimeSlots = [
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
  ];

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

  // Selected services list & totals
  const selectedServices = useMemo(() => {
    return services.filter((s) => selectedServiceIds.includes(s.id));
  }, [services, selectedServiceIds]);

  const totalBookingRupees = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + Math.round(s.price_minor / 100), 0);
  }, [selectedServices]);

  const combinedServiceName = useMemo(() => {
    return selectedServices.map((s) => s.name).join(' + ') || services[0]?.name || 'Salon Service';
  }, [selectedServices, services]);

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
    if (cleanPhone.length > 0 && cleanPhone.length !== 10) {
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

  const bookIncomplete = selectedServices.length === 0 || !selectedSlot;

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
      stylistName: stylistName,
      stylistId: selectedStaffId,
      slot: selectedSlot!,
      dateStr: selectedDay.dateStr,
      amountRupees: totalBookingRupees,
      sendConfirm,
    });
  };

  const ctaText = selectedSlot
    ? `${t('confirmBooking')} · ${selectedDay.dayLabel} ${selectedSlot}`
    : t('selectServices');

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

          {/* + Add Client Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsAddClientModalOpen(true)}
            style={[
              styles.addClientBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            <PlusIcon size={13} color={colors.accent} />
            <Text style={[styles.addClientBtnText, { color: colors.accent }]}>{t('addClient')}</Text>
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
          <Text style={[styles.sectionLabel, { color: colors.textDim }]}>
            {t('services')} ({selectedServices.length} selected)
          </Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setIsServicesExpanded(!isServicesExpanded)}
            style={[styles.expandToggleBtn, { borderColor: colors.accent, backgroundColor: colors.accent900 }]}
          >
            <Text style={{ color: colors.accent100, fontSize: 12, fontWeight: '600' }}>
              {isServicesExpanded ? '▲ Collapse' : '▼ Expand all services'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selected Services Preview Bar */}
        {selectedServices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
            {selectedServices.map((s) => (
              <View
                key={`sel_${s.id}`}
                style={[styles.selectedServiceTag, { backgroundColor: colors.surface, borderColor: colors.accent }]}
              >
                <Text style={{ color: colors.accent100, fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
                <Text style={{ color: colors.accent200, fontSize: 11, marginLeft: 6 }}>
                  {inrFromMinor(s.price_minor)}
                </Text>
                <TouchableOpacity onPress={() => toggleService(s.id)} style={{ marginLeft: 6 }}>
                  <Text style={{ color: colors.textDim, fontSize: 11 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Collapsed View: Quick Top Services */}
        {!isServicesExpanded && (
          <View style={styles.serviceChipsGrid}>
            {popularServices.map((s) => {
              const isSelected = selectedServiceIds.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.75}
                  onPress={() => toggleService(s.id)}
                  style={[
                    styles.serviceChip,
                    {
                      borderColor: isSelected ? colors.accent : colors.divider,
                      backgroundColor: isSelected ? colors.accent900 : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.serviceChipName, { color: isSelected ? colors.accent100 : colors.text }]}>
                    {s.name}
                  </Text>
                  <Text
                    style={[
                      styles.serviceChipPrice,
                      { color: isSelected ? colors.accent200 : colors.textDim },
                    ]}
                  >
                    {inrFromMinor(s.price_minor)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Expanded View: Full Categorized Services with Checkboxes */}
        {isServicesExpanded && (
          <View style={styles.expandedServicesBlock}>
            {categoryGroups.map((group) => (
              <View key={group.category} style={styles.categoryBlock}>
                <Text style={[styles.categoryHeader, { color: colors.accent }]}>
                  {group.category.toUpperCase()}
                </Text>
                <View style={styles.expandedGrid}>
                  {group.services.map((s) => {
                    const isSelected = selectedServiceIds.includes(s.id);
                    return (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={0.75}
                        onPress={() => toggleService(s.id)}
                        style={[
                          styles.serviceRowItem,
                          {
                            borderColor: isSelected ? colors.accent : colors.divider,
                            backgroundColor: isSelected ? colors.accent900 : colors.surface,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.serviceChipName, { color: isSelected ? colors.accent100 : colors.text }]}>
                            {s.name}
                          </Text>
                          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                            {s.duration_minutes || 30} mins
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[styles.serviceChipPrice, { color: isSelected ? colors.accent200 : colors.textMuted }]}>
                            {inrFromMinor(s.price_minor)}
                          </Text>
                          <View
                            style={[
                              styles.checkCircle,
                              {
                                borderColor: isSelected ? colors.accent : colors.divider,
                                backgroundColor: isSelected ? colors.accent : 'transparent',
                              },
                            ]}
                          >
                            {isSelected && <Text style={{ color: '#000', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
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
        {/* 5. TIME SLOTS (Strictly past times disabled on Today)   */}
        {/* ======================================================== */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          SLOT · {selectedDay.dayLabel.toUpperCase()} {selectedDay.dateNum}
        </Text>
        <View style={styles.slotsGrid}>
          {allTimeSlots.map((sl) => {
            // Check if slot has already passed for today
            let isPast = false;
            if (isSelectedDateToday) {
              const currentHour = now.getHours();
              const currentMin = now.getMinutes();
              if (sl.hour < currentHour || (sl.hour === currentHour && sl.min <= currentMin)) {
                isPast = true;
              }
            }

            const isSelected = selectedSlot === sl.label;

            return (
              <TouchableOpacity
                key={sl.label}
                disabled={isPast}
                activeOpacity={isPast ? 1 : 0.75}
                onPress={() => setSelectedSlot(sl.label)}
                style={[
                  styles.slotBox,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected
                      ? colors.accent900
                      : isPast
                      ? 'rgba(255,255,255,0.02)'
                      : colors.surface,
                    opacity: isPast ? 0.3 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.slotText,
                    {
                      color: isSelected
                        ? colors.accent
                        : isPast
                        ? colors.textDim
                        : colors.text,
                      textDecorationLine: isPast ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {sl.label}
                </Text>
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
      <Modal visible={isAddClientModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
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
              onChangeText={setNewClientPhone}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleQuickAddClient}
              style={[styles.modalAddBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 14 }}>{t('save')}</Text>
            </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  addClientBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
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
