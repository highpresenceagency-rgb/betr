import { router } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { makeStyles } from '../lib/theme';

interface Props {
  onPress?: () => void;
  label?: string;
}

export default function BackButton({ onPress, label = '← Back' }: Props) {
  const styles = useStyles();
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

const useStyles = makeStyles(({ colors }) => ({
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
}));
