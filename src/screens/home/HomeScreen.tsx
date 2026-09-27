import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  Platform,
  StatusBar as RNStatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { BellIcon, SettingsIcon, CalendarIcon, ArrowRightIcon } from '../../components/common/SvgIcons';
import { getInitials } from '../../utils/format';

interface HomeScreenProps {
  shopName?: string;
  logoUrl?: string | null;
  remindersCount?: number;
  onBookSlot: () => void;
  onNavigateReminders: () => void;
  onNavigateProfile: () => void;
}

const { width, height } = Dimensions.get('window');

export const HomeScreen = ({
  shopName = 'StyleFleet',
  logoUrl = null,
  remindersCount = 0,
  onBookSlot,
  onNavigateReminders,
  onNavigateProfile,
}: HomeScreenProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Dynamic greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return t('goodMorning');
    } else if (hour >= 12 && hour < 17) {
      return t('goodAfternoon');
    } else {
      return t('goodEvening');
    }
  }, [t]);

  const statusBarHeight = Platform.OS === 'android' ? RNStatusBar.currentHeight || 28 : 16;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/home_hero_bg.jpg')}
        style={styles.bgImage}
        imageStyle={styles.bgImageStyle}
        resizeMode="cover"
      >
        {/* Subtle Dark Gradient Overlay for optimal contrast and elegance */}
        <View style={styles.darkOverlay} />

        <SafeAreaView style={[styles.safeArea, { paddingTop: 4 }]}>
          {/* ======================================================== */}
          {/* TOP HEADER: LOGO, STORE NAME, GREETING, BELL, SETTINGS   */}
          {/* ======================================================== */}
          <View style={styles.header}>
            <View style={styles.storeInfoRow}>
              {/* Circular Logo Badge */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onNavigateProfile}
                style={[styles.logoCircle, { borderColor: colors.accent }]}
              >
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.logoPlaceholder, { backgroundColor: colors.accent900 }]}>
                    <Text style={[styles.logoInitials, { color: colors.accent100 }]}>
                      {getInitials(shopName || 'StyleFleet')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Store Name & Dynamic Time-Based Greeting */}
              <View style={styles.storeTextCol}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  ellipsizeMode="tail"
                  style={[
                    styles.storeTitle,
                    {
                      fontSize:
                        (shopName || 'StyleFleet').length <= 14
                          ? 21
                          : (shopName || 'StyleFleet').length <= 22
                          ? 17
                          : (shopName || 'StyleFleet').length <= 30
                          ? 14.5
                          : 13,
                    },
                  ]}
                >
                  {shopName || 'StyleFleet'}
                </Text>
                <Text numberOfLines={1} style={[styles.greetingSub, { color: colors.accent }]}>
                  {greeting.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Notification and Settings Action Icons */}
            <View style={styles.actionButtonsRow}>
              {/* Notification Bell Button */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onNavigateReminders}
                style={[styles.circleActionBtn, { borderColor: 'rgba(217, 164, 65, 0.4)' }]}
              >
                <BellIcon size={20} color={colors.accent} />
                {remindersCount > 0 && <View style={styles.notifBadge} />}
              </TouchableOpacity>

              {/* Settings Gear Button */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onNavigateProfile}
                style={[styles.circleActionBtn, { borderColor: 'rgba(217, 164, 65, 0.4)' }]}
              >
                <SettingsIcon size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ======================================================== */}
          {/* HERO CENTER TEXT: "LOOK GOOD • FEEL GOOD"                 */}
          {/* ======================================================== */}
          <View style={styles.centerContent}>
            <Text style={[styles.taglineSmall, { color: colors.accent }]}>
              {t('lookGoodFeelGood', 'LOOK GOOD  •  FEEL GOOD')}
            </Text>

            <View style={styles.headlineBlock}>
              <Text style={styles.heroLine1}>{t('because', 'Because')}</Text>
              <Text style={[styles.heroLine2Cursive, { color: colors.accent }]}>
                {t('youDeserve', 'You Deserve')}
              </Text>
              <Text style={styles.heroLine3}>{t('theBest', 'the Best')}</Text>
            </View>

            <View style={[styles.goldDivider, { backgroundColor: colors.accent }]} />

            <Text style={styles.heroDescription}>
              {t('heroDescription', 'Premium salon services\nfor your natural beauty\nand confidence.')}
            </Text>
          </View>

          {/* ======================================================== */}
          {/* BOTTOM CTA BUTTON: "📅 | Book Slot →"                    */}
          {/* ======================================================== */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={onBookSlot}
              style={[
                styles.bookSlotButton,
                {
                  backgroundColor: colors.accent,
                  shadowColor: colors.accent,
                },
              ]}
            >
              <View style={styles.iconPill}>
                <CalendarIcon size={15} color="#120E06" strokeWidth={2.2} />
              </View>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.bookSlotText}>
                {t('bookSlot')}
              </Text>
              <View style={styles.arrowCircle}>
                <ArrowRightIcon size={11} color={colors.accent} strokeWidth={3} />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0D',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  bgImageStyle: {
    opacity: 0.75,
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 8, 11, 0.28)',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  logoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.7)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  storeTextCol: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  storeTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  greetingSub: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  circleActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.2,
    backgroundColor: 'rgba(12, 13, 18, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    borderWidth: 1.2,
    borderColor: '#12131A',
  },
  centerContent: {
    paddingLeft: 4,
    paddingRight: 8,
    marginTop: height > 750 ? 30 : 16,
    maxWidth: 260,
    alignSelf: 'flex-start',
  },
  taglineSmall: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headlineBlock: {
    marginVertical: 2,
  },
  heroLine1: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroLine2Cursive: {
    fontSize: 38,
    lineHeight: 46,
    fontStyle: 'italic',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroLine3: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  goldDivider: {
    width: 44,
    height: 2.5,
    marginVertical: 14,
    borderRadius: 1.5,
  },
  heroDescription: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  bottomSection: {
    paddingBottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookSlotButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingLeft: 13,
    paddingRight: 7,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    maxWidth: '85%',
  },
  iconPill: {
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookSlotText: {
    color: '#120E06',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginRight: 9,
    flexShrink: 1,
  },
  arrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#120E06',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
