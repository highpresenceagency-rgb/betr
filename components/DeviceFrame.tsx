import React, { useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../lib/theme';

// On desktop web, render the app inside a centered phone-sized frame so it looks
// like a handset (and is easy to design against). A top-right button toggles
// between the phone frame and full-width. No-op on native or narrow viewports.
const PHONE_W = 390;
const PHONE_H = 844;
const DESKTOP_MIN = 700;

export default function DeviceFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const { colors } = useTheme();
  const [framed, setFramed] = useState(true);

  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_MIN;
  if (!isDesktopWeb) return <>{children}</>;

  const Toggle = (
    <Pressable
      onPress={() => setFramed((f) => !f)}
      style={{
        position: 'absolute', top: 16, right: 16, zIndex: 9999,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999,
        backgroundColor: colors.accent,
      }}
    >
      <Text style={{ color: colors.bg, fontWeight: '800', fontSize: 13 }}>
        {framed ? '🖥  Full width' : '📱  Phone view'}
      </Text>
    </Pressable>
  );

  if (!framed) {
    return (
      <View style={{ flex: 1 }}>
        {children}
        {Toggle}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: PHONE_W,
          height: Math.min(PHONE_H, height - 40),
          borderRadius: 30,
          overflow: 'hidden',
          borderWidth: 6,
          borderColor: '#1c1c1e',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </View>
      {Toggle}
    </View>
  );
}
