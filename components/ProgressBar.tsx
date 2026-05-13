import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';

interface Props {
  step: number;
  total?: number;
}

export default function ProgressBar({ step, total = 4 }: Props) {
  const pct = step / total;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
});
