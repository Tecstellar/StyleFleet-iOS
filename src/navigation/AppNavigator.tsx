import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform, StatusBar as RNStatusBar, Linking, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { ScreenName, MainTab, Customer, Bill, Appointment, Service, Offer, StaffMember, Expense, ServiceCategory, ReminderItem } from '../types/domain';
import { BottomTabBar } from '../components/common/BottomTabBar';

// Repositories & Services
import { authRepository, AuthUser } from '../repositories/authRepository';
import { shopRepository, ShopRow, ShopRegistrationData } from '../repositories/shopRepository';
import { customerRepository } from '../repositories/customerRepository';
import { staffRepository } from '../repositories/staffRepository';
import { serviceRepository } from '../repositories/serviceRepository';
import { offerRepository } from '../repositories/offerRepository';
import { appointmentRepository } from '../repositories/appointmentRepository';
import { billingRepository } from '../repositories/billingRepository';
import { expenseRepository } from '../repositories/expenseRepository';
import { reminderRepository, ReminderRule } from '../repositories/reminderRepository';
import { supportRepository } from '../repositories/supportRepository';
import { WhatsAppAudience } from '../repositories/whatsappRepository';
import { authService } from '../services/authService';
import { billingService } from '../services/billingService';
import { appointmentService } from '../services/appointmentService';
import { telemetryService } from '../services/telemetryService';
import { systemLogService } from '../services/systemLogService';

// Screens
import { SplashScreen } from '../screens/splash/SplashScreen';
import { PhoneScreen } from '../screens/auth/PhoneScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { WorkersScreen } from '../screens/auth/WorkersScreen';
import { CustomersScreen } from '../screens/customers/CustomersScreen';
import { CustomerDetailScreen } from '../screens/customers/CustomerDetailScreen';
import { SalesScreen } from '../screens/sales/SalesScreen';
import { NewBillScreen } from '../screens/billing/NewBillScreen';
import { InvoiceScreen } from '../screens/billing/InvoiceScreen';
import { SentScreen } from '../screens/billing/SentScreen';
import { AccountsScreen } from '../screens/accounts/AccountsScreen';
import { ExpensesScreen } from '../screens/expenses/ExpensesScreen';
import { AppointmentsScreen } from '../screens/appointments/AppointmentsScreen';
import { BookingScreen } from '../screens/appointments/BookingScreen';
import { RemindersScreen } from '../screens/reminders/RemindersScreen';
import { BulkWhatsAppScreen } from '../screens/whatsapp/BulkWhatsAppScreen';
import { BulkSentScreen } from '../screens/whatsapp/BulkSentScreen';
import { StaffScreen } from '../screens/staff/StaffScreen';
import { PricingScreen } from '../screens/pricing/PricingScreen';
import { ShopProfileScreen } from '../screens/profile/ShopProfileScreen';
import { OnboardingTourModal } from '../components/common/OnboardingTourModal';

export const AppNavigator = () => {
  const { colors } = useTheme();

  // Navigation state - starts strictly with splash screen
  const [screen, setScreen] = useState<ScreenName>('splash');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [history, setHistory] = useState<ScreenName[]>([]);
  const [initialDestination, setInitialDestination] = useState<ScreenName>('phone');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Auth & Shop context
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [currentShop, setCurrentShop] = useState<ShopRow | null>(null);
  const [ownerName, setOwnerName] = useState<string>('Owner');
  const [authPhone, setAuthPhone] = useState('');
  const [authSessionId, setAuthSessionId] = useState<string | undefined>();
  const [pendingRegistration, setPendingRegistration] = useState<ShopRegistrationData | null>(null);
  const [showTour, setShowTour] = useState<boolean>(false);

  // Real Domain data (100% genuine from Supabase)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);

  // Selected screen data targets
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [pendingAppointmentToBill, setPendingAppointmentToBill] = useState<Appointment | null>(null);
  const [initialBillServiceId, setInitialBillServiceId] = useState<string | null>(null);
  const [initialBillServiceIds, setInitialBillServiceIds] = useState<string[]>([]);
  const [initialBillStaffId, setInitialBillStaffId] = useState<string | null>(null);
  const [bulkAudience, setBulkAudience] = useState<WhatsAppAudience>({
    id: 1,
    label: 'All Customers',
    count: 0,
  });

  // Sync current shop with telemetry stream
  useEffect(() => {
    telemetryService.setShopId(currentShop?.id || null);
  }, [currentShop?.id]);

  // Verify real session and shop on startup (persistent login)
  useEffect(() => {
    let isMounted = true;
    telemetryService.startStream(currentShop?.id || null);

    (async () => {
      try {
        // 1. FAST PATH: Check local cache & local session first (sub-5ms)
        const [cachedShop, cachedUser, lastPhone] = await Promise.all([
          shopRepository.getCachedShop(),
          authRepository.getSession(),
          shopRepository.getLastPhone(),
        ]);

        if (cachedShop) {
          if (isMounted) {
            setCurrentShop(cachedShop);
            shopRepository.resolveOwnerName(cachedShop.owner_profile_id).then((oName) => {
              if (oName && isMounted) setOwnerName(oName);
            });
            const user: AuthUser = cachedUser || {
              id: cachedShop.owner_profile_id || 'user_' + (cachedShop.phone || 'salon'),
              phone: cachedShop.phone || lastPhone || '',
            };
            setCurrentUser(user);
            await authRepository.saveSession(user);
            await authRepository.setCurrentShopId(cachedShop.id);
            setActiveTab('home');
            setInitialDestination('home');
            setIsInitializing(false);
          }

          // Background sync of live data (never blocks splash dismiss)
          loadShopData(cachedShop.id).catch((err) =>
            console.warn('Background sync notice:', err)
          );
          return;
        }

        // 2. No cached shop locally - check Supabase session or last phone
        let user = cachedUser;
        if (!user) {
          user = await authRepository.getSession();
        }

        let shop: ShopRow | null = null;
        if (user) {
          if (isMounted) setCurrentUser(user);
          shop = await shopRepository.getShopForUser(user.id);
          if (!shop && user.phone) {
            shop = await shopRepository.getShopByPhone(user.phone);
          }
        }

        if (!shop && lastPhone) {
          shop = await shopRepository.getShopByPhone(lastPhone);
        }

        if (shop) {
          if (isMounted) {
            setCurrentShop(shop);
            shopRepository.resolveOwnerName(shop.owner_profile_id).then((oName) => {
              if (oName && isMounted) setOwnerName(oName);
            });
            await shopRepository.cacheShop(shop);
            await authRepository.setCurrentShopId(shop.id);
            if (!user) {
              const fallback: AuthUser = {
                id: shop.owner_profile_id || 'user_' + (shop.phone || 'salon'),
                phone: shop.phone || lastPhone || '',
              };
              setCurrentUser(fallback);
              await authRepository.saveSession(fallback);
            }
            setActiveTab('home');
            setInitialDestination('home');
            setIsInitializing(false);
          }
          loadShopData(shop.id).catch(() => {});
          return;
        }

        // 3. User authenticated but no shop found in DB yet -> Go to register
        if (user) {
          if (isMounted) {
            setInitialDestination('register');
            setIsInitializing(false);
          }
          return;
        }

        // 4. Brand new visitor -> Phone login
        if (isMounted) {
          setInitialDestination('phone');
          setIsInitializing(false);
        }
      } catch (e) {
        systemLogService.error('APP_INITIALIZATION', 'Failed to initialize session', e);
        const shop = await shopRepository.getCachedShop().catch(() => null);
        if (shop && isMounted) {
          setCurrentShop(shop);
          telemetryService.setShopId(shop.id);
          setActiveTab('home');
          setInitialDestination('home');
        } else if (isMounted) {
          setInitialDestination('phone');
        }
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      telemetryService.stopStream();
    };
  }, []);

  const loadShopData = async (shopId: string) => {
    try {
      const [c, st, cats, sv, o, a, b, ex, rem, r] = await Promise.all([
        customerRepository.getCustomers(shopId),
        staffRepository.getStaff(shopId),
        serviceRepository.getCategories(shopId),
        serviceRepository.getServices(shopId),
        offerRepository.getOffers(shopId),
        appointmentRepository.getAppointments(shopId),
        billingRepository.getBills(shopId),
        expenseRepository.getExpenses(shopId),
        reminderRepository.getReminders(shopId),
        reminderRepository.getRules(shopId),
      ]);
      setCustomers(c);
      setStaff(st);
      setCategories(cats);
      setServices(sv);
      setOffers(o);
      setAppointments(a);
      setBills(b);
      setExpenses(ex);
      setReminders(rem);
      setRules(r);
    } catch (e) {
      console.warn('Error loading shop data:', e);
    }
  };

  // Realtime subscription for admin panel support message answers
  useEffect(() => {
    if (!currentShop?.id) return;
    const unsub = supportRepository.subscribeToSupportAnswers(currentShop.id, (answer) => {
      reminderRepository.getReminders(currentShop.id).then((rems) => setReminders(rems));
      Alert.alert(
        '💬 Message from Support',
        `${answer.admin_name || 'StyleFleet Support'}:\n\n"${answer.answer}"`,
        [
          { text: 'View in Reminders', onPress: () => navigateTo('reminders') },
          { text: 'OK', style: 'cancel' },
        ]
      );
    });

    return () => {
      unsub();
    };
  }, [currentShop?.id]);

  // Navigation helpers
  const navigateTo = (nextScreen: ScreenName, resetHistory = false) => {
    if (resetHistory) {
      setHistory([]);
    } else {
      setHistory((prev) => [...prev, screen]);
    }
    setScreen(nextScreen);
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((old) => old.slice(0, old.length - 1));
      setScreen(prev);
    } else {
      setScreen(activeTab);
    }
  };

  const handleTabSelect = (tab: MainTab) => {
    setActiveTab(tab);
    setHistory([]);
    setSelectedCustomer(null);
    setInitialBillServiceId(null);
    setInitialBillServiceIds([]);
    setInitialBillStaffId(null);
    setPendingAppointmentToBill(null);
    setScreen(tab);
  };

  // Android Hardware Back Button Handling & App Exit Confirmation
  useEffect(() => {
    const onBackPress = () => {
      // 1. While on splash screen or initializing, ignore back press
      if (screen === 'splash' || isInitializing) {
        return true;
      }

      // 2. If there is navigation history, pop back to the previous screen
      if (history.length > 0) {
        goBack();
        return true;
      }

      const mainTabs: MainTab[] = ['home', 'customers', 'sales', 'accounts'];

      // 3. If on an inner sub-screen (e.g. newBill, booking, customerDetail, shopProfile) without history stack
      if (!mainTabs.includes(screen as MainTab)) {
        if (currentUser && currentShop) {
          handleTabSelect(activeTab || 'home');
          return true;
        }
      }

      // 4. If roaming on another tab (e.g. accounts, sales, customers, appointments), navigate to home
      if (activeTab !== 'home' || screen !== 'home') {
        if (currentUser && currentShop) {
          handleTabSelect('home');
          return true;
        }
      }

      // 5. If on auth sub-screens, navigate back to phone entry
      if (['otp', 'register', 'workers'].includes(screen)) {
        setScreen('phone');
        return true;
      }

      // 6. If on home page (or unauthenticated phone root), confirm app exit
      if (screen === 'home' || screen === 'phone') {
        Alert.alert(
          'Exit StyleFleet',
          'Are you sure you want to exit?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes',
              onPress: () => BackHandler.exitApp(),
            },
          ],
          { cancelable: true }
        );
        return true;
      }

      return false;
    };

    const backHandlerSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => backHandlerSubscription.remove();
  }, [screen, activeTab, history, isInitializing, currentUser, currentShop]);

  // Auth flow handlers
  const handleSendOtp = async (phone: string) => {
    setAuthPhone(phone);
    await shopRepository.saveLastPhone(phone);
    const res = await authService.sendOtp(phone);
    setAuthSessionId(res.sessionId);
    navigateTo('otp');
  };

  const handleVerifyOtp = async (otp: string) => {
    const res = await authService.verifyOtp(authPhone, otp, authSessionId);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      await authRepository.saveSession(res.user);
      await shopRepository.saveLastPhone(authPhone);

      // Check if this phone number or user already has a registered shop in Supabase
      let shop = await shopRepository.getShopByPhone(authPhone);
      if (!shop && res.user.id) {
        shop = await shopRepository.getShopForUser(res.user.id);
      }
      if (!shop) {
        shop = await shopRepository.getCachedShop();
      }

      if (shop) {
        setCurrentShop(shop);
        await shopRepository.cacheShop(shop);
        await authRepository.setCurrentShopId(shop.id);
        await loadShopData(shop.id);
        handleTabSelect('sales');
      } else {
        navigateTo('register');
      }
    } else {
      Alert.alert('Verification Failed', res.error || 'Please enter the correct 6-digit OTP');
    }
  };

  const handleRegisterNext = (data: ShopRegistrationData) => {
    setPendingRegistration(data);
    navigateTo('workers');
  };

  const handleFinishSetup = async (staffDraft: { name: string; role: string }[]) => {
    if (pendingRegistration) {
      try {
        const phoneToUse = pendingRegistration.phone || authPhone;
        const regDataWithPhone: ShopRegistrationData = {
          ...pendingRegistration,
          phone: phoneToUse,
        };
        const userId = currentUser?.id || `user_${Date.now()}`;
        const shop = await authService.registerShop(userId, regDataWithPhone);
        setCurrentShop(shop);
        if (pendingRegistration.ownerName) {
          setOwnerName(pendingRegistration.ownerName);
          await shopRepository.saveOwnerName(pendingRegistration.ownerName);
        }
        await shopRepository.cacheShop(shop);
        await authRepository.setCurrentShopId(shop.id);
        if (phoneToUse) {
          await shopRepository.saveLastPhone(phoneToUse);
        }
        if (currentUser) {
          await authRepository.saveSession({
            ...currentUser,
            shopId: shop.id,
            phone: phoneToUse || currentUser.phone,
          });
        }

        for (const s of staffDraft) {
          await staffRepository.addStaff(shop.id, s.name, s.role);
        }
        await loadShopData(shop.id);
        handleTabSelect('home');
        setShowTour(true);
      } catch (err: any) {
        console.error('Registration failed:', err);
        Alert.alert(
          'Registration Notice',
          err.message || 'Could not save salon to database. Please check your connection and try again.'
        );
      }
    }
  };

  // Business actions
  const handleToggleStar = async (customerId: string) => {
    if (!currentShop) return;
    const newStar = await customerRepository.toggleStar(currentShop.id, customerId);
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, is_starred: newStar } : c))
    );
  };

  const handleSettleDue = async (
    customerId: string,
    method: 'cash' | 'upi' = 'cash',
    amountMinor?: number
  ) => {
    if (!currentShop) return;
    try {
      const remainingCustDue = await customerRepository.settleDues(
        currentShop.id,
        customerId,
        method,
        amountMinor
      );
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId ? { ...c, outstanding_due_minor: remainingCustDue } : c
        )
      );
      if (selectedCustomer && selectedCustomer.id === customerId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, outstanding_due_minor: remainingCustDue } : null));
      }
      const b = await billingRepository.getBills(currentShop.id);
      setBills(b);
      const isFull = remainingCustDue === 0;
      Alert.alert(
        isFull ? 'Due Fully Settled' : 'Partial Due Payment Recorded',
        isFull
          ? 'Outstanding balance has been cleared in full.'
          : `Payment recorded. Remaining customer due: ₹${Math.round(remainingCustDue / 100).toLocaleString('en-IN')}`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not settle dues');
    }
  };

  const handleProceedToInvoice = async (billData: {
    customerName: string;
    customerId: string | null;
    staffName: string;
    staffId: string | null;
    items: { name: string; priceMinor: number; isColour?: boolean }[];
    paymentMethod: string;
    discountMinor: number;
    paidAmountMinor?: number;
    dueAmountMinor?: number;
  }) => {
    if (!currentShop) return;
    const newBill = await billingRepository.createBill(
      currentShop.id,
      billData.customerName,
      billData.customerId,
      billData.staffName,
      billData.staffId,
      billData.items,
      billData.paymentMethod,
      billData.discountMinor,
      billData.paidAmountMinor,
      billData.dueAmountMinor
    );
    setBills((prev) => {
      const filtered = prev.filter(
        (b) => b.id !== newBill.id && b.invoice_number !== newBill.invoice_number
      );
      return [newBill, ...filtered];
    });
    setSelectedBill(newBill);

    if (billData.dueAmountMinor && billData.dueAmountMinor > 0 && billData.customerId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === billData.customerId
            ? { ...c, outstanding_due_minor: (c.outstanding_due_minor || 0) + (billData.dueAmountMinor || 0) }
            : c
        )
      );
    }

    // If billing an in-chair appointment, advance it to Done
    if (pendingAppointmentToBill) {
      await appointmentRepository.updateStatus(currentShop.id, pendingAppointmentToBill.id, 'Done');
      setAppointments((prev) =>
        prev.map((a) => (a.id === pendingAppointmentToBill.id ? { ...a, status: 'Done' } : a))
      );
      setPendingAppointmentToBill(null);
      setInitialBillServiceId(null);
      setInitialBillServiceIds([]);
      setInitialBillStaffId(null);
    }

    navigateTo('invoice');
  };

  const handleQuickAddCustomer = async (name: string, phone: string) => {
    if (!currentShop) throw new Error('No active shop found');
    const newCust = await customerRepository.addCustomer(currentShop.id, name, phone, 0, false);
    setCustomers((prev) => [newCust, ...prev]);
    return newCust;
  };

  const handleSendInvoiceWhatsApp = async (bill: Bill) => {
    await billingService.shareInvoiceWhatsApp(bill);
    navigateTo('sent');
  };

  const handleAddExpense = async (cat: string, amt: number, note: string) => {
    if (!currentShop) return;
    const newExp = await expenseRepository.addExpense(
      currentShop.id,
      cat,
      amt,
      note,
      'UPI'
    );
    setExpenses((prev) => [newExp, ...prev]);
  };

  const handleConfirmBooking = async (data: {
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
  }) => {
    if (!currentShop) return;
    const newAppt = await appointmentRepository.addAppointment({
      shopId: currentShop.id,
      customerName: data.customerName,
      customerId: data.customerId,
      customerPhone: data.customerPhone,
      serviceName: data.serviceName,
      serviceId: data.serviceId,
      serviceIds: data.serviceIds,
      stylistName: data.stylistName,
      stylistId: data.stylistId,
      slot: data.slot,
      dateStr: data.dateStr,
      amountRupees: data.amountRupees,
      sendConfirm: data.sendConfirm,
    });
    setAppointments((prev) => [...prev, newAppt]);
    navigateTo('appointments');
  };

  const handleAdvanceStatus = async (apptId: string) => {
    if (!currentShop) return;
    const nextStatus = await appointmentRepository.advanceStatus(currentShop.id, apptId);
    if (nextStatus) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: nextStatus } : a))
      );
    }
  };

  const handleDismissReminder = async (reminderId: string) => {
    if (!currentShop) return;
    await reminderRepository.dismissReminder(currentShop.id, reminderId);
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  };

  const handleToggleRule = async (ruleId: string) => {
    if (!currentShop) return;
    const newOn = await reminderRepository.toggleRule(currentShop.id, ruleId);
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, on: newOn } : r))
    );
  };

  const handleSendDueReminderWhatsApp = (r: ReminderItem) => {
    let custPhone = r.customer_phone;
    let custName = r.customer_name;
    let dueAmt = r.amount_minor ? Math.round(r.amount_minor / 100) : 0;

    if (!custPhone && r.customer_id) {
      const c = customers.find((cust) => cust.id === r.customer_id);
      if (c) {
        custPhone = c.phone;
        custName = c.name;
        if (!dueAmt) dueAmt = Math.round(c.outstanding_due_minor / 100);
      }
    }

    if (!custPhone) {
      const match = customers.find(
        (c) => r.title.toLowerCase().includes(c.name.toLowerCase())
      );
      if (match) {
        custPhone = match.phone;
        custName = match.name;
        if (!dueAmt) dueAmt = Math.round(match.outstanding_due_minor / 100);
      }
    }

    if (!dueAmt) {
      const amtMatch = r.title.match(/₹\s*(\d+[\d,]*)/);
      if (amtMatch && amtMatch[1]) {
        dueAmt = parseInt(amtMatch[1].replace(/,/g, ''), 10);
      }
    }

    const cleanPhone = (custPhone || '').replace(/\D/g, '').slice(-10);
    const sName = currentShop?.name || 'StyleFleet';
    const amountFormatted = dueAmt > 0 ? `₹${dueAmt.toLocaleString('en-IN')}` : 'your pending amount';

    const message =
      `Hello ${custName || 'there'}! 👋\n\n` +
      `This is a gentle payment reminder from *${sName}*.\n` +
      `You are having a due amount of *${amountFormatted}*, please pay.\n\n` +
      `If you have already settled this payment, kindly ignore this reminder.\n\n` +
      `Thank you!\n*${sName}*`;

    if (cleanPhone.length === 10) {
      const nativeUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
      const webUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;

      Linking.canOpenURL(nativeUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(nativeUrl).catch(() => Linking.openURL(webUrl));
          } else {
            Linking.openURL(webUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webUrl);
        });
    } else {
      Alert.alert(
        'Phone Number Missing',
        `No valid 10-digit mobile number found for ${custName || 'this customer'}. Please update their mobile number in the Customers tab.`
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await authRepository.signOut();
      await shopRepository.clearCachedShop();
      await AsyncStorage.removeItem('@salon_os_last_phone');
    } catch (e) {
      console.warn('Sign out cleanup error:', e);
    }
    setCurrentUser(null);
    setCurrentShop(null);
    setOwnerName('Owner');
    setBills([]);
    setCustomers([]);
    setStaff([]);
    setExpenses([]);
    setAppointments([]);
    setReminders([]);
    setCategories([]);
    setServices([]);
    setOffers([]);
    setInitialDestination('phone');
    setScreen('phone');
  };

  const isMainTabScreen = ['home', 'customers', 'sales', 'accounts'].includes(screen);

  const insets = useSafeAreaInsets();
  // Safe top padding on Android to comfortably clear status bar icons, clock, and camera punch hole
  const androidTopInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, RNStatusBar.currentHeight || 28) + 12
      : 0;
  const screenTopPadding = screen === 'splash' || screen === 'home' ? 0 : androidTopInset;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Screen Router - SafeAreaView inside child screens manages top insets */}
      <View style={{ flex: 1 }}>
        {screen === 'splash' && (
          <SplashScreen
            isReady={!isInitializing}
            onFinish={() => {
              setScreen(initialDestination);
              if (
                initialDestination === 'home' ||
                initialDestination === 'sales' ||
                initialDestination === 'customers' ||
                initialDestination === 'accounts'
              ) {
                setActiveTab(initialDestination as MainTab);
              }
            }}
          />
        )}

        {screen === 'home' && (
          <HomeScreen
            shopName={currentShop?.name}
            logoUrl={currentShop?.logo_path}
            remindersCount={reminders.length}
            onBookSlot={() => {
              setSelectedCustomer(null);
              navigateTo('appointments');
            }}
            onNavigateReminders={() => navigateTo('reminders')}
            onNavigateProfile={() => navigateTo('profile')}
          />
        )}

        {screen === 'phone' && (
          <PhoneScreen
            onSendOtp={handleSendOtp}
            onRegisterShop={() => navigateTo('register')}
          />
        )}

        {screen === 'otp' && (
          <OtpScreen
            phone={authPhone || 'your mobile'}
            onVerify={handleVerifyOtp}
            onBack={goBack}
          />
        )}

        {screen === 'register' && (
          <RegisterScreen
            initialData={pendingRegistration || undefined}
            onNext={handleRegisterNext}
            onBack={goBack}
          />
        )}

        {screen === 'workers' && (
          <WorkersScreen
            onFinish={handleFinishSetup}
            onBack={goBack}
          />
        )}

        {screen === 'customers' && (
          <CustomersScreen
            customers={customers}
            shopId={currentShop?.id}
            onSelectCustomer={(c) => {
              setSelectedCustomer(c);
              navigateTo('customer');
            }}
            onToggleStar={handleToggleStar}
            onAddCustomer={async (newCust) => {
              setCustomers((prev) => [newCust, ...prev]);
              if (currentShop) {
                const refreshed = await billingRepository.getBills(currentShop.id);
                setBills(refreshed);
              }
            }}
            onBatchAddCustomers={async (newCusts) => {
              setCustomers((prev) => [...newCusts, ...prev]);
              if (currentShop) {
                const refreshed = await billingRepository.getBills(currentShop.id);
                setBills(refreshed);
              }
            }}
            onUpdateCustomer={async (updated) => {
              setCustomers((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              );
              if (selectedCustomer?.id === updated.id) {
                setSelectedCustomer(updated);
              }
              if (currentShop) {
                const refreshed = await billingRepository.getBills(currentShop.id);
                setBills(refreshed);
              }
            }}
            onSettleDue={handleSettleDue}
          />
        )}

        {screen === 'customer' && selectedCustomer && (
          <CustomerDetailScreen
            customer={selectedCustomer}
            bills={bills}
            shopId={currentShop?.id}
            onBack={() => {
              setSelectedCustomer(null);
              goBack();
            }}
            onToggleStar={handleToggleStar}
            onStartBill={(c) => {
              setSelectedCustomer(c);
              setInitialBillServiceId(null);
              setInitialBillServiceIds([]);
              setInitialBillStaffId(null);
              setPendingAppointmentToBill(null);
              navigateTo('bill');
            }}
            onBookSlot={(c) => {
              setSelectedCustomer(c);
              navigateTo('booking');
            }}
            onWhatsApp={() => navigateTo('bulk')}
            onSettleDue={handleSettleDue}
            onUpdateCustomer={(updated) => {
              setSelectedCustomer(updated);
              setCustomers((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              );
            }}
          />
        )}

        {screen === 'sales' && (
          <SalesScreen
            bills={bills}
            shopName={currentShop?.name}
            onOpenInvoice={(bill) => {
              setSelectedBill(bill);
              navigateTo('invoice');
            }}
            onNewBill={() => {
              setSelectedCustomer(null);
              setInitialBillServiceId(null);
              setInitialBillServiceIds([]);
              setInitialBillStaffId(null);
              setPendingAppointmentToBill(null);
              navigateTo('bill');
            }}
          />
        )}

        {screen === 'bill' && (
          <NewBillScreen
            customers={customers}
            services={services}
            staff={staff}
            bills={bills}
            initialCustomerId={selectedCustomer?.id || null}
            initialServiceId={initialBillServiceId}
            initialServiceIds={initialBillServiceIds}
            initialStaffId={initialBillStaffId}
            onBack={() => {
              setSelectedCustomer(null);
              setInitialBillServiceId(null);
              setInitialBillServiceIds([]);
              setInitialBillStaffId(null);
              setPendingAppointmentToBill(null);
              goBack();
            }}
            onAddNewCustomer={handleQuickAddCustomer}
            onProceedToInvoice={handleProceedToInvoice}
          />
        )}

        {screen === 'invoice' && selectedBill && (
          <InvoiceScreen
            bill={selectedBill}
            shopName={currentShop?.name || 'My Salon'}
            shopAddress={
              currentShop
                ? `${currentShop.address}, ${currentShop.city} ${currentShop.pin_code}`
                : undefined
            }
            shopGstin={currentShop?.gstin || undefined}
            shopLogoUrl={currentShop?.logo_path || null}
            customerPhone={
              (selectedBill.customer_id
                ? customers.find((c) => c.id === selectedBill.customer_id)?.phone
                : null) ||
              selectedCustomer?.phone ||
              customers.find(
                (c) =>
                  c.name.trim().toLowerCase() ===
                  selectedBill.customer_name.trim().toLowerCase()
              )?.phone ||
              null
            }
            onBack={goBack}
            onSendWhatsApp={handleSendInvoiceWhatsApp}
          />
        )}

        {screen === 'sent' && selectedBill && (
          <SentScreen
            bill={selectedBill}
            shopName={currentShop?.name || 'My Salon'}
            onNextBill={() => {
              setSelectedCustomer(null);
              navigateTo('bill', true);
            }}
            onDone={() => handleTabSelect('sales')}
          />
        )}

        {screen === 'accounts' && (
          <AccountsScreen
            openRemindersCount={reminders.length}
            bills={bills}
            expenses={expenses}
            shopId={currentShop?.id}
            shopName={currentShop?.name || 'My Salon'}
            userPhone={currentShop?.phone || authPhone}
            onNavigate={(dest) => navigateTo(dest)}
            onAccountDeleted={handleSignOut}
            onSignOut={handleSignOut}
          />
        )}

        {screen === 'expenses' && (
          <ExpensesScreen
            expenses={expenses}
            onBack={goBack}
            onAddExpense={handleAddExpense}
          />
        )}

        {screen === 'appointments' && (
          <AppointmentsScreen
            appointments={appointments}
            shopName={currentShop?.name}
            onBack={goBack}
            onBook={() => {
              setSelectedCustomer(null);
              navigateTo('booking');
            }}
            onAdvanceStatus={handleAdvanceStatus}
            onBillAndClose={(appt) => {
              const matchedCustomer =
                (appt.customer_id ? customers.find((cust) => cust.id === appt.customer_id) : null) ||
                (appt.customer_phone ? customers.find((cust) => cust.phone === appt.customer_phone) : null) ||
                customers.find(
                  (cust) => cust.name.trim().toLowerCase() === appt.customer_name.trim().toLowerCase()
                ) ||
                (appt.customer_phone
                  ? ({
                      id: appt.customer_id || '',
                      name: appt.customer_name,
                      phone: appt.customer_phone,
                      visits: 1,
                      spend: 0,
                      dues: 0,
                      is_starred: false,
                      outstanding_due_minor: 0,
                      total_spend_minor: 0,
                      total_visits: 1,
                    } as any)
                  : null);
              setSelectedCustomer(matchedCustomer);

              // Resolve ALL services for this appointment
              let matchedIds: string[] = [];

              // 1. Direct service_ids array
              if (appt.service_ids && appt.service_ids.length > 0) {
                matchedIds = [...appt.service_ids];
              }

              // 2. Parsed JSON from notes
              if (matchedIds.length === 0 && appt.notes) {
                try {
                  const parsed = JSON.parse(appt.notes);
                  if (Array.isArray(parsed?.service_ids) && parsed.service_ids.length > 0) {
                    matchedIds = [...parsed.service_ids];
                  }
                } catch {
                  // regular string
                }
              }

              // 3. Match services by name (e.g. "Haircut + Beard Trim + Facial")
              if (appt.service_name) {
                const parts = appt.service_name.split(/\s*[\+,]\s*/);
                for (const part of parts) {
                  const cleaned = part.trim().toLowerCase();
                  if (cleaned) {
                    const found = services.find(
                      (s) => s.name.trim().toLowerCase() === cleaned
                    );
                    if (found && !matchedIds.includes(found.id)) {
                      matchedIds.push(found.id);
                    }
                  }
                }
              }

              // 4. Fallback to single service_id if none matched
              if (matchedIds.length === 0 && appt.service_id) {
                matchedIds.push(appt.service_id);
              }

              setInitialBillServiceIds(matchedIds);
              setInitialBillServiceId(matchedIds[0] || null);
              setInitialBillStaffId(appt.staff_id || null);
              setPendingAppointmentToBill(appt);
              navigateTo('bill');
            }}
          />
        )}

        {screen === 'booking' && (
          <BookingScreen
            customers={customers}
            services={services}
            staff={staff}
            appointments={appointments}
            initialCustomerId={selectedCustomer?.id || null}
            onBack={() => {
              setSelectedCustomer(null);
              goBack();
            }}
            onAddNewCustomer={handleQuickAddCustomer}
            onConfirmBooking={handleConfirmBooking}
          />
        )}

        {screen === 'reminders' && (
          <RemindersScreen
            reminders={reminders}
            rules={rules}
            onBack={goBack}
            onAction={(r) => {
              if (r.kind === 'support') {
                Alert.alert(
                  r.title,
                  r.sub,
                  [
                    {
                      text: 'Mark as Read',
                      onPress: () => handleDismissReminder(r.id),
                    },
                    { text: 'Close', style: 'cancel' },
                  ]
                );
              } else if (r.kind === 'money') {
                handleSendDueReminderWhatsApp(r);
              } else {
                navigateTo('appointments');
              }
            }}
            onDismiss={handleDismissReminder}
            onToggleRule={handleToggleRule}
          />
        )}

        {screen === 'bulk' && (
          <BulkWhatsAppScreen
            shopName={currentShop?.name || 'My Salon'}
            customers={customers}
            onBack={goBack}
            onSendBulk={({ audience }) => {
              setBulkAudience(audience);
              navigateTo('bulksent');
            }}
          />
        )}

        {screen === 'bulksent' && (
          <BulkSentScreen
            audience={bulkAudience}
            onNewCampaign={() => navigateTo('bulk', true)}
            onDone={() => handleTabSelect('sales')}
          />
        )}

        {screen === 'staff' && (
          <StaffScreen
            staff={staff}
            bills={bills}
            shopId={currentShop?.id}
            onBack={goBack}
            onAddStaff={async (name, role, phone) => {
              if (!currentShop) return;
              const newMember = await staffRepository.addStaff(currentShop.id, name, role, phone);
              setStaff((prev) => [...prev, newMember]);
            }}
            onManage={() => {}}
          />
        )}

        {screen === 'pricing' && (
          <PricingScreen
            services={services}
            offers={offers}
            categories={categories}
            shopId={currentShop?.id}
            onBack={goBack}
            onAddCategory={async (catName: string) => {
              if (!currentShop) throw new Error('No active shop');
              const created = await serviceRepository.addCategory(currentShop.id, catName);
              setCategories((prev) => [...prev.filter((c) => c.id !== created.id), created]);
              return created;
            }}
            onAddService={async (cat: string, name: string, price: number) => {
              if (!currentShop) return;
              const created = await serviceRepository.addService(currentShop.id, cat, name, price);
              setServices((prev) => [...prev, created]);
              const reloadedCats = await serviceRepository.getCategories(currentShop.id);
              setCategories(reloadedCats);
            }}
            onUpdateService={async (serviceId, updates) => {
              if (!currentShop) return;
              await serviceRepository.updateService(currentShop.id, serviceId, updates);
              const reloaded = await serviceRepository.getServices(currentShop.id);
              setServices(reloaded);
            }}
            onRemoveService={async (serviceId: string) => {
              if (!currentShop) return;
              await serviceRepository.removeService(currentShop.id, serviceId);
              setServices((prev) => prev.filter((s) => s.id !== serviceId));
            }}
            onToggleOffer={async (offerId: string) => {
              if (!currentShop) return;
              const next = await offerRepository.toggleOffer(currentShop.id, offerId);
              setOffers((prev) =>
                prev.map((o) => (o.id === offerId ? { ...o, is_active: next } : o))
              );
            }}
            onRemoveOffer={async (offerId: string) => {
              if (!currentShop) return;
              await offerRepository.removeOffer(currentShop.id, offerId);
              setOffers((prev) => prev.filter((o) => o.id !== offerId));
            }}
            onAddOffer={async (name, description, discountType, discountValue) => {
              if (!currentShop) return;
              const created = await offerRepository.addOffer(currentShop.id, name, description, discountType, discountValue);
              setOffers((prev) => [...prev, created]);
            }}
            onImportMenuAI={async (items) => {
              if (!currentShop) return;
              const imported = await serviceRepository.importMenuFromAI(currentShop.id, items);
              setServices(imported);
              const reloadedCats = await serviceRepository.getCategories(currentShop.id);
              setCategories(reloadedCats);
            }}
          />
        )}

        {screen === 'profile' && currentShop && (
          <ShopProfileScreen
            shopId={currentShop.id}
            shopName={currentShop.name}
            ownerName={ownerName}
            phone={currentShop.phone || authPhone || '9800000000'}
            address={currentShop.address || ''}
            city={currentShop.city || ''}
            pinCode={currentShop.pin_code || ''}
            gstin={currentShop.gstin || undefined}
            logoUrl={currentShop.logo_path}
            currentGstRate={currentShop.gst_rate}
            teamCount={staff.length}
            onBack={goBack}
            onUpdateShop={async (updatedShopData) => {
              if (updatedShopData?.name) {
                setCurrentShop((prev) => (prev ? { ...prev, name: updatedShopData.name } : null));
              }
              if (updatedShopData?.owner_name) {
                setOwnerName(updatedShopData.owner_name);
              }
            }}
            onUpdateLogo={async (logoPath) => {
              await shopRepository.updateShop(currentShop.id, { logo_path: logoPath });
              setCurrentShop((prev) => (prev ? { ...prev, logo_path: logoPath } : null));
            }}
            onUpdateGstRate={async (gstRate) => {
              await shopRepository.updateShop(currentShop.id, { gst_rate: gstRate });
              setCurrentShop((prev) => (prev ? { ...prev, gst_rate: gstRate } : null));
            }}
            onAccountDeleted={handleSignOut}
          />
        )}
      </View>

      {/* Persistent Bottom Tab Bar (shown exclusively on main tabs) */}
      {isMainTabScreen && (
        <BottomTabBar
          currentTab={activeTab}
          onTabSelect={handleTabSelect}
        />
      )}

      {/* Interactive App Onboarding Tour */}
      <OnboardingTourModal
        visible={showTour}
        shopName={currentShop?.name}
        onFinish={() => setShowTour(false)}
        onTabChange={(tab) => handleTabSelect(tab)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
