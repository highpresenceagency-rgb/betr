import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';

interface Props {
  onPress?: () => void;
  label?: string;
}

export default function BackButton({ onPress, label = '← Back' }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.back())}
      activeOpacity={0.7}
      style={styles.btn}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  text: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
