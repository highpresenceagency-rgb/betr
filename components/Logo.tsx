import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 20, md: 28, lg: 42 };

export default function Logo({ size = 'md' }: Props) {
  const fs = sizes[size];
  return (
    <View>
      <Text style={[styles.logo, { fontSize: fs }]}>
        Bett<Text style={styles.accent}>rr</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: undefined,
  },
  accent: {
    color: colors.accent,
  },
});
