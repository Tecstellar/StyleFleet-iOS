import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Button } from '../../components/common/Button';
import { BackIcon, UserPlusIcon } from '../../components/common/SvgIcons';
import { Customer, StaffMember, Service, Bill } from '../../types/domain';
import { inr, inrFromMinor, getInitials } from '../../utils/format';
import { radii } from '../../theme/spacing';

interface NewBillScreenProps {
  customers: Customer[];
  services: Service[];
  staff: StaffMember[];
  bills?: Bill[];
  initialCustomerId?: string | null;
  initialServiceId?: string | null;
  initialServiceIds?: string[] | null;
  initialStaffId?: string | null;
  onBack: () => void;
  onAddNewCustomer?: (name: string, phone: string) => Promise<Customer>;
  onProceedToInvoice: (billData: {
    customerName: string;
    customerId: string | null;
    staffName: string;
    staffId: string | null;
    items: { name: string; priceMinor: number; isColour?: boolean }[];
    paymentMethod: string;
    discountMinor: number;
    paidAmountMinor?: number;
    dueAmountMinor?: number;
  }) => void;
}

export const NewBillScreen = ({
  customers,
  services,
  staff,
  bills = [],
  initialCustomerId = null,
  initialServiceId = null,
  initialServiceIds = null,
  initialStaffId = null,
  onBack,
  onAddNewCustomer,
  onProceedToInvoice,
}: NewBillScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Quick Add Client Modal State
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Services, Staff & Discount State
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    if (initialServiceIds && initialServiceIds.length > 0) {
      return initialServiceIds;
    }
    if (initialServiceId) {
      return [initialServiceId];
    }
    return [];
  });

  useEffect(() => {
    if (initialServiceIds && initialServiceIds.length > 0) {
      setSelectedServiceIds(initialServiceIds);
    } else if (initialServiceId) {
      setSelectedServiceIds([initialServiceId]);
    }
  }, [initialServiceIds, initialServiceId]);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  useEffect(() => {
    if (initialStaffId) {
      const idx = staff.findIndex((s) => s.id === initialStaffId);
      if (idx >= 0) setSelectedStaffIndex(idx);
    }
  }, [initialStaffId, staff]);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const initialStaffIdx = initialStaffId
    ? staff.findIndex((s) => s.id === initialStaffId)
    : -1;
  const [selectedStaffIndex, setSelectedStaffIndex] = useState<number>(initialStaffIdx);
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [partialPaymentMode, setPartialPaymentMode] = useState<'UPI' | 'Cash' | 'Card'>('UPI');
  const [partialPaidInput, setPartialPaidInput] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('0');

  // Filter matching customers based on search
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)
    : null;
  const customerName = selectedCustomer ? selectedCustomer.name : 'Walk-in';

  // Compute top used / popular services from real bills
  const { popularServices, categoryGroups } = useMemo(() => {
    const serviceFrequency: Record<string, number> = {};
    for (const b of bills) {
      if (b.items) {
        for (const it of b.items) {
          const sName = it.service_name_snapshot;
          serviceFrequency[sName] = (serviceFrequency[sName] || 0) + (it.quantity || 1);
        }
      }
    }

    const popular = services
      .filter((s) => (serviceFrequency[s.name] || 0) > 0)
      .sort((a, b) => (serviceFrequency[b.name] || 0) - (serviceFrequency[a.name] || 0))
      .slice(0, 4);

    const categories = ['Hair', 'Beard', 'Colour', 'Care', 'Packages'] as const;
    const groups: { category: string; services: Service[] }[] = [];

    for (const cat of categories) {
      const catServices = services.filter((s) => s.category_name === cat);
      if (catServices.length > 0) {
        groups.push({ category: cat, services: catServices });
      }
    }

    // Include any remaining categories
    const otherServices = services.filter(
      (s) => !categories.includes(s.category_name as any)
    );
    if (otherServices.length > 0) {
      groups.push({ category: 'Other Services', services: otherServices });
    }

    return { popularServices: popular, categoryGroups: groups };
  }, [services, bills]);

  const toggleService = (svcId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(svcId) ? prev.filter((id) => id !== svcId) : [...prev, svcId]
    );
  };

  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id));
  const cartItems = selectedServices.map((s) => ({
    name: s.name,
    priceMinor: s.price_minor,
    isColour: s.category_name === 'Colour' || s.name.toLowerCase().includes('colour'),
  }));

  // Financial calculation (No GST as requested)
  const subtotalMinor = cartItems.reduce((acc, it) => acc + it.priceMinor, 0);
  const discountAmt = parseFloat(discountInput) || 0;
  const discountMinor = Math.min(subtotalMinor, Math.round(discountAmt * 100));
  const totalMinor = Math.max(0, subtotalMinor - discountMinor);

  const currentStaff =
    selectedStaffIndex >= 0 && staff[selectedStaffIndex]
      ? staff[selectedStaffIndex]
      : {
          id: null,
          name: 'No Stylist',
        };

  const handleProceed = () => {
    if (cartItems.length === 0) {
      Alert.alert('No Services', 'Please select at least one service to create a bill.');
      return;
    }

    let paidMinor = totalMinor;
    let dueMinor = 0;

    if (paymentMode === 'Fully Pending') {
      if (!selectedCustomerId) {
        Alert.alert(
          'Customer Details Required',
          'Dues and pending bills can only be tracked for a registered customer. Please add or select customer name and 10-digit mobile number.',
          [
            { text: '+ Add Customer', onPress: () => setIsAddClientModalOpen(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
      paidMinor = 0;
      dueMinor = totalMinor;
    } else if (paymentMode === 'Partial Pay') {
      if (!selectedCustomerId) {
        Alert.alert(
          'Customer Details Required',
          'Partial payment dues must be assigned to a registered customer. Please add or select customer name and 10-digit mobile number.',
          [
            { text: '+ Add Customer', onPress: () => setIsAddClientModalOpen(true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
      const partialAmt = parseFloat(partialPaidInput) || 0;
      paidMinor = Math.round(partialAmt * 100);
      if (paidMinor <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid amount paid now (greater than ₹0).');
        return;
      }
      if (paidMinor >= totalMinor) {
        Alert.alert(
          'Notice',
          'Paid amount covers the full total. Please select UPI, Cash or Card, or lower the partial amount.'
        );
        return;
      }
      dueMinor = totalMinor - paidMinor;
    }

    const effectivePaymentMethod =
      paymentMode === 'Partial Pay'
        ? `Partial Pay (${partialPaymentMode})`
        : paymentMode;

    onProceedToInvoice({
      customerName,
      customerId: selectedCustomerId,
      staffName: currentStaff.name,
      staffId: currentStaff.id,
      items: cartItems,
      paymentMethod: effectivePaymentMethod,
      discountMinor,
      paidAmountMinor: paidMinor,
      dueAmountMinor: dueMinor,
    });
  };

  // Quick Add Client Action
  const handleSaveQuickClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Required', 'Please enter customer name');
      return;
    }
    const clean = newClientPhone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSavingClient(true);
    try {
      if (onAddNewCustomer) {
        const created = await onAddNewCustomer(newClientName.trim(), clean);
        setSelectedCustomerId(created.id);
      }
      setIsAddClientModalOpen(false);
      setNewClientName('');
      setNewClientPhone('');
      setCustomerSearch('');
      setIsSearchFocused(false);
      Alert.alert('Client Saved', `${newClientName.trim()} registered and selected!`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save client');
    } finally {
      setIsSavingClient(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Button variant="icon" onPress={onBack}>
          <BackIcon size={18} color={colors.text} />
        </Button>
        <Text style={[styles.title, { color: colors.text }]}>{t('newBill')}</Text>
        <Text style={[styles.selectedCountText, { color: colors.textDim }]}>
          {selectedServiceIds.length} {t('services')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* CUSTOMER SELECTION AREA */}
        <Text style={[styles.sectionLabel, { color: colors.textDim }]}>{t('client')}</Text>

        <View style={styles.customerRowContainer}>
          {/* Search Field Box */}
          <View
            style={[
              styles.customerSearchBox,
              {
                backgroundColor: colors.surface,
                borderColor: isSearchFocused ? colors.accent : colors.divider,
              },
            ]}
          >
            <Text style={{ fontSize: 13, marginRight: 6 }}>🔍</Text>
            <TextInput
              style={[styles.customerSearchInput, { color: colors.text }]}
              placeholder="Search client by name or phone..."
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              value={customerSearch}
              onChangeText={(txt) => {
                setCustomerSearch(txt);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
            />
            {customerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setCustomerSearch('')} style={{ padding: 4 }}>
                <Text style={{ color: colors.textDim, fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Walk-in Button */}
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

        {/* Selected Customer Highlight Card (if a registered customer is selected) */}
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
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 12 }}>
                    + Add "{customerSearch}" as new client
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
                  style={[
                    styles.dropdownRow,
                    { borderBottomColor: colors.divider },
                  ]}
                >
                  <View style={[styles.smallAvatar, { backgroundColor: colors.neutral800 }]}>
                    <Text style={{ color: colors.text, fontSize: 10 }}>{getInitials(c.name)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>{c.name}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11 }}>+91 {c.phone}</Text>
                  </View>
                  {c.is_starred && (
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: 'bold' }}>★ MVP</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* SERVICES SECTION */}
        {/* SERVICES SECTION */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {t('services')} ({selectedServiceIds.length} {t('selected', 'selected')})
        </Text>

        {/* CHOOSE SERVICES TRIGGER BOX */}
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
                style={[
                  styles.selectedServiceTag,
                  { backgroundColor: colors.accent900, borderColor: colors.accent },
                ]}
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

        {/* STYLIST SECTION */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 12 }]}>
          {t('staff')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {/* No Stylist Chip */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setSelectedStaffIndex(-1)}
            style={[
              styles.stylistChip,
              {
                borderColor: selectedStaffIndex === -1 ? colors.accent : colors.divider,
                backgroundColor: selectedStaffIndex === -1 ? colors.accent900 : 'transparent',
              },
            ]}
          >
            <View style={[styles.stylistAvatar, { backgroundColor: colors.surface }]}>
              <Text style={[styles.stylistAvatarText, { color: colors.textDim }]}>—</Text>
            </View>
            <Text
              style={[
                styles.stylistName,
                { color: selectedStaffIndex === -1 ? colors.accent200 : colors.textMuted },
              ]}
            >
              No Stylist
            </Text>
          </TouchableOpacity>

          {staff.map((s, idx) => {
            const isSelected = selectedStaffIndex === idx;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.75}
                onPress={() => setSelectedStaffIndex(idx)}
                style={[
                  styles.stylistChip,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : 'transparent',
                  },
                ]}
              >
                <View style={[styles.stylistAvatar, { backgroundColor: colors.accent800 }]}>
                  <Text style={[styles.stylistAvatarText, { color: colors.accent100 }]}>
                    {getInitials(s.name)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stylistName,
                    { color: isSelected ? colors.accent200 : colors.textMuted },
                  ]}
                >
                  {s.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* DISCOUNT SECTION (Replaces GST as instructed) */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 16 }]}>
          {t('discount')} (₹)
        </Text>
        <View style={styles.discountContainer}>
          <View
            style={[
              styles.discountInputBox,
              { backgroundColor: colors.surface, borderColor: colors.divider },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: colors.accent }]}>₹</Text>
            <TextInput
              style={[styles.discountInput, { color: colors.text }]}
              placeholder="0"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              keyboardType="numeric"
              value={discountInput === '0' ? '' : discountInput}
              onChangeText={(txt) => {
                const clean = txt.replace(/\D/g, '');
                setDiscountInput(clean || '0');
              }}
            />
          </View>

          {/* Preset Discount Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: 10 }}>
            {[50, 100, 200].map((amt) => (
              <TouchableOpacity
                key={amt}
                onPress={() => setDiscountInput(String(amt))}
                style={[
                  styles.presetChip,
                  {
                    borderColor: discountInput === String(amt) ? colors.accent : colors.divider,
                    backgroundColor: discountInput === String(amt) ? colors.accent900 : colors.surface,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>₹{amt}</Text>
              </TouchableOpacity>
            ))}
            {[10, 20].map((pct) => {
              const calcAmt = Math.round((subtotalMinor * (pct / 100)) / 100);
              return (
                <TouchableOpacity
                  key={`${pct}%`}
                  onPress={() => setDiscountInput(String(calcAmt))}
                  style={[
                    styles.presetChip,
                    {
                      borderColor: discountInput === String(calcAmt) && calcAmt > 0 ? colors.accent : colors.divider,
                      backgroundColor: discountInput === String(calcAmt) && calcAmt > 0 ? colors.accent900 : colors.surface,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{pct}% off</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* PAYMENT METHOD */}
        <Text style={[styles.sectionLabel, { color: colors.textDim, marginTop: 18 }]}>
          {t('paymentMode')}
        </Text>
        <View style={styles.paymentRow}>
          {(['UPI', 'Cash', 'Card', 'Partial Pay', 'Fully Pending'] as const).map((mode) => {
            const isSelected = paymentMode === mode;
            const modeLabel =
              mode === 'Partial Pay'
                ? t('partialPay', 'Partial Pay')
                : mode === 'Fully Pending'
                ? t('fullyPending', 'Fully Pending')
                : mode;
            return (
              <TouchableOpacity
                key={mode}
                activeOpacity={0.8}
                onPress={() => {
                  setPaymentMode(mode);
                  if (mode === 'Partial Pay') {
                    setPartialPaidInput('');
                  }
                }}
                style={[
                  styles.paymentButton,
                  {
                    borderColor: isSelected ? colors.accent : colors.divider,
                    backgroundColor: isSelected ? colors.accent900 : colors.surface,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    styles.paymentButtonText,
                    { color: isSelected ? colors.accent : colors.textMuted },
                  ]}
                >
                  {modeLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PARTIAL PAY DETAILS */}
        {paymentMode === 'Partial Pay' && (
          <View style={[styles.dueDetailCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                {t('amountPaidNow', 'Amount Paid Now')} (₹):
              </Text>
              <TextInput
                style={[
                  styles.partialInput,
                  {
                    color: colors.accent,
                    borderColor:
                      (parseFloat(partialPaidInput) || 0) * 100 > totalMinor
                        ? colors.error
                        : colors.accent,
                    backgroundColor: colors.bg,
                  },
                ]}
                keyboardType="numeric"
                value={partialPaidInput}
                onChangeText={(txt) => setPartialPaidInput(txt.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={colors.textDim}
              />
            </View>

            {(parseFloat(partialPaidInput) || 0) * 100 > totalMinor && (
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>
                Paid amount cannot exceed total bill of {inrFromMinor(totalMinor)}
              </Text>
            )}

            {/* Upfront Payment Mode (UPI / Cash / Card) */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 6 }}>
                Paid via:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['UPI', 'Cash', 'Card'] as const).map((method) => {
                  const isSel = partialPaymentMode === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPartialPaymentMode(method)}
                      style={{
                        flex: 1,
                        paddingVertical: 7,
                        borderRadius: radii.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSel ? colors.accent900 : colors.bg,
                        borderWidth: 1,
                        borderColor: isSel ? colors.accent : colors.divider,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSel ? colors.accent : colors.textMuted,
                        }}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.dueCalculationRow, { borderTopColor: colors.divider }]}>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>
                {t('remainingDue', 'Remaining Due (stored to customer)')}:
              </Text>
              <Text style={{ color: colors.error, fontSize: 14, fontWeight: '700' }}>
                {inrFromMinor(
                  Math.max(
                    0,
                    totalMinor - Math.min(totalMinor, Math.round((parseFloat(partialPaidInput) || 0) * 100))
                  )
                )}
              </Text>
            </View>
          </View>
        )}

        {/* FULLY PENDING BANNER */}
        {paymentMode === 'Fully Pending' && (
          <View style={[styles.dueDetailCard, { backgroundColor: 'rgba(255, 59, 48, 0.08)', borderColor: colors.error }]}>
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600', marginBottom: 2 }}>
              ⏳ Fully Pending Bill
            </Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>
              Full amount of {inrFromMinor(totalMinor)} will be registered as outstanding due for {customerName}.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Cart Summary Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: colors.textDim }]}>
            {cartItems.length > 0
              ? `${cartItems.length} services · Subtotal ${inrFromMinor(subtotalMinor)}${
                  discountMinor > 0 ? ` · Disc −${inrFromMinor(discountMinor)}` : ''
                }`
              : 'Pick services to start'}
          </Text>
          <Text style={[styles.totalText, { color: colors.text }]}>
            {inrFromMinor(totalMinor)}
          </Text>
        </View>

        <Button
          label={t('saveAndPrint')}
          block
          disabled={cartItems.length === 0}
          onPress={handleProceed}
        />
      </View>

      {/* QUICK ADD CLIENT MODAL */}
      <Modal
        visible={isAddClientModalOpen}
        transparent
        animationType="slide"
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
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addNewCustomer')}</Text>
                  <TouchableOpacity onPress={() => setIsAddClientModalOpen(false)}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: colors.textDim }]}>{t('fullName')}</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={newClientName}
                  onChangeText={setNewClientName}
                />

                <Text style={[styles.inputLabel, { color: colors.textDim, marginTop: 14 }]}>
                  {t('mobileNumber')}
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.bg, borderColor: colors.divider, color: colors.text }]}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={newClientPhone}
                  onChangeText={(txt) => setNewClientPhone(txt.replace(/\D/g, '').slice(0, 10))}
                />

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isSavingClient}
                  onPress={handleSaveQuickClient}
                  style={[styles.saveModalBtn, { backgroundColor: colors.accent }]}
                >
                  {isSavingClient ? (
                    <ActivityIndicator color="#0D0E11" />
                  ) : (
                    <Text style={styles.saveModalBtnText}>{t('save')}</Text>
                  )}
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
  selectedCountText: {
    marginLeft: 'auto',
    fontSize: 11.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 140,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 7,
  },
  customerRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  customerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  customerSearchInput: {
    flex: 1,
    fontSize: 12.5,
    padding: 0,
  },
  walkInBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  walkInBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addClientBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  selectedCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 10,
  },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCustName: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeSelectedCustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchDropdown: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 10,
    maxHeight: 180,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
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
  selectedServiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
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
  categoryBlock: {
    marginBottom: 12,
  },
  categoryHeader: {
    fontSize: 11,
    marginBottom: 6,
  },
  serviceChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceButton: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  serviceName: {
    fontSize: 12.5,
  },
  servicePrice: {
    fontSize: 11,
    marginTop: 2,
  },
  horizontalScroll: {
    marginBottom: 6,
  },
  stylistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  stylistAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistAvatarText: {
    fontSize: 11,
    fontWeight: '500',
  },
  stylistName: {
    fontSize: 12,
    fontWeight: '500',
  },
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  discountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.md,
    borderWidth: 1,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paymentButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22%',
    flexGrow: 1,
  },
  paymentButtonText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  dueDetailCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  partialInput: {
    width: 100,
    height: 38,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  fractionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  dueCalculationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 9,
  },
  summaryText: {
    fontSize: 12,
    flex: 1,
    minWidth: 160,
  },
  totalText: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveModalBtn: {
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  saveModalBtnText: {
    color: '#0D0E11',
    fontWeight: '700',
    fontSize: 14,
  },
});
