import React from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { radii } from '../constants/theme';
import { makeStyles, useTheme } from '../lib/theme';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function PrimaryButton({ label, loading, style, disabled, ...rest }: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.primary, (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors.bg} />
      ) : (
        <Text style={styles.primaryLabel}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({ label, style, ...rest }: ButtonProps) {
  const styles = useStyles();
  return (
    <TouchableOpacity activeOpacity={0.75} style={[styles.ghost, style]} {...rest}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  primary: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderTopColor: colors.accent,
    borderLeftColor: colors.accent,
    borderRightColor: colors.accentBorder,
    borderBottomColor: colors.accentBorder,
  },
  primaryLabel: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.5,
  },
  ghost: {
    width: '100%',
    backgroundColor: colors.input,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderTopColor: colors.borderLight,
    borderLeftColor: colors.borderMid,
    borderRightColor: colors.borderDark,
    borderBottomColor: colors.borderDarker,
  },
  ghostLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
}));
