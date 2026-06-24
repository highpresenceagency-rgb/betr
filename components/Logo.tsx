import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../lib/theme';

interface Props {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 20, md: 28, lg: 42 };

export default function Logo({ size = 'md' }: Props) {
  const styles = useStyles();
  const fs = sizes[size];
  return (
    <View>
      <Text style={[styles.logo, { fontSize: fs }]}>
        Bett<Text style={styles.accent}>rr</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  logo: {
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: undefined,
  },
  accent: {
    color: colors.accent,
  },
}));
