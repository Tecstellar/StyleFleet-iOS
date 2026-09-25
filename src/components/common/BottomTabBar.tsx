import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { MainTab } from '../../types/domain';
import { HomeIcon, UsersIcon, ReceiptIcon, ChartIcon } from './SvgIcons';

interface BottomTabBarProps {
  currentTab: MainTab;
  onTabSelect: (tab: MainTab) => void;
}

export const BottomTabBar = ({ currentTab, onTabSelect }: BottomTabBarProps) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const tabs: { key: MainTab; label: string; icon: (color: string) => React.ReactNode }[] = [
    {
      key: 'home',
      label: t('home', 'Home'),
      icon: (color) => <HomeIcon size={21} color={color} />,
    },
    {
      key: 'customers',
      label: t('customers', 'Customers'),
      icon: (color) => <UsersIcon size={21} color={color} />,
    },
    {
      key: 'sales',
      label: t('sales', 'Sales'),
      icon: (color) => <ReceiptIcon size={21} color={color} />,
    },
    {
      key: 'accounts',
      label: t('accounts', 'Accounts'),
      icon: (color) => <ChartIcon size={21} color={color} />,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      {tabs.map((t) => {
        const isActive = currentTab === t.key;
        const color = isActive ? colors.accent : colors.textDim;

        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.8}
            onPress={() => onTabSelect(t.key)}
            style={[
              styles.tabButton,
              {
                borderTopColor: isActive ? colors.accent : 'transparent',
              },
            ]}
          >
            {t.icon(color)}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.tabLabel, { color }]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 2,
    gap: 3,
    borderTopWidth: 2,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
