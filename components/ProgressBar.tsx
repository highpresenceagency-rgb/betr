import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../lib/theme';

interface Props {
  step: number;
  total?: number;
}

export default function ProgressBar({ step, total = 4 }: Props) {
  const styles = useStyles();
  const pct = step / total;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  track: {
    height: 3,
    backgroundColor: colors.borderMid,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
}));
