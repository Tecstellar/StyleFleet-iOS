import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform, StatusBar as RNStatusBar, Linking } from 'react-native';
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
  const [initialBillStaffId, setInitialBillStaffId] = useState<string | null>(null);
  const [bulkAudience, setBulkAudience] = useState<WhatsAppAudience>({
    id: 1,
    label: 'All Customers',
    count: 0,
  });

  // Verify real session and shop on startup (persistent login)
  useEffect(() => {
    let isMounted = true;

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
        console.error('Initialization error:', e);
        const shop = await shopRepository.getCachedShop().catch(() => null);
        if (shop && isMounted) {
          setCurrentShop(shop);
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
    setInitialBillStaffId(null);
    setPendingAppointmentToBill(null);
    setScreen(tab);
  };

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

  const handleSettleDue = async (customerId: string, method: 'cash' | 'upi' = 'cash') => {
    if (!currentShop) return;
    try {
      await customerRepository.settleDues(currentShop.id, customerId, method);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId ? { ...c, outstanding_due_minor: 0 } : c
        )
      );
      if (selectedCustomer && selectedCustomer.id === customerId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, outstanding_due_minor: 0 } : null));
      }
      const b = await billingRepository.getBills(currentShop.id);
      setBills(b);
      Alert.alert('Due Settled', 'Outstanding payment has been cleared successfully.');
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
      billData.discountMinor
    );
    setBills((prev) => [newBill, ...prev]);
    setSelectedBill(newBill);

    // If billing an in-chair appointment, advance it to Done
    if (pendingAppointmentToBill) {
      await appointmentRepository.updateStatus(currentShop.id, pendingAppointmentToBill.id, 'Done');
      setAppointments((prev) =>
        prev.map((a) => (a.id === pendingAppointmentToBill.id ? { ...a, status: 'Done' } : a))
      );
      setPendingAppointmentToBill(null);
      setInitialBillServiceId(null);
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
            onAddCustomer={(newCust) => {
              setCustomers((prev) => [newCust, ...prev]);
            }}
            onBatchAddCustomers={(newCusts) => {
              setCustomers((prev) => [...newCusts, ...prev]);
            }}
            onUpdateCustomer={(updated) => {
              setCustomers((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
              );
              if (selectedCustomer?.id === updated.id) {
                setSelectedCustomer(updated);
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
            initialStaffId={initialBillStaffId}
            onBack={() => {
              setSelectedCustomer(null);
              setInitialBillServiceId(null);
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
              customers.find((c) => c.id === selectedBill.customer_id)?.phone || null
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
            onAccountDeleted={() => {
              setCurrentUser(null);
              setCurrentShop(null);
              setBills([]);
              setCustomers([]);
              setStaff([]);
              setExpenses([]);
              setAppointments([]);
              setReminders([]);
              setCategories([]);
              setServices([]);
              setScreen('splash');
              setInitialDestination('phone');
            }}
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
              if (appt.customer_id) {
                const c = customers.find((cust) => cust.id === appt.customer_id) || null;
                setSelectedCustomer(c);
              } else {
                setSelectedCustomer(null);
              }
              setInitialBillServiceId(appt.service_id || null);
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
            ownerName="Owner"
            phone={currentShop.phone || authPhone || '9800000000'}
            address={currentShop.address || ''}
            city={currentShop.city || ''}
            pinCode={currentShop.pin_code || ''}
            gstin={currentShop.gstin || undefined}
            logoUrl={currentShop.logo_path}
            currentGstRate={currentShop.gst_rate}
            teamCount={staff.length}
            onBack={goBack}
            onUpdateLogo={async (logoPath) => {
              await shopRepository.updateShop(currentShop.id, { logo_path: logoPath });
              setCurrentShop((prev) => (prev ? { ...prev, logo_path: logoPath } : null));
            }}
            onUpdateGstRate={async (gstRate) => {
              await shopRepository.updateShop(currentShop.id, { gst_rate: gstRate });
              setCurrentShop((prev) => (prev ? { ...prev, gst_rate: gstRate } : null));
            }}
            onAccountDeleted={async () => {
              await authRepository.signOut();
              await shopRepository.clearCachedShop();
              await AsyncStorage.removeItem('@salon_os_last_phone');
              setCurrentUser(null);
              setCurrentShop(null);
              setBills([]);
              setCustomers([]);
              setStaff([]);
              setExpenses([]);
              setAppointments([]);
              setReminders([]);
              setInitialDestination('phone');
              setScreen('phone');
            }}
            onSignOut={async () => {
              await authRepository.signOut();
              await shopRepository.clearCachedShop();
              await AsyncStorage.removeItem('@salon_os_last_phone');
              setCurrentUser(null);
              setCurrentShop(null);
              setBills([]);
              setCustomers([]);
              setStaff([]);
              setExpenses([]);
              setAppointments([]);
              setReminders([]);
              setInitialDestination('phone');
              setScreen('phone');
            }}
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
