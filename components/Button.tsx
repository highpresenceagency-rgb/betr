import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { colors, radii } from '../constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export function PrimaryButton({ label, loading, style, disabled, ...rest }: ButtonProps) {
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
  return (
    <TouchableOpacity activeOpacity={0.75} style={[styles.ghost, style]} {...rest}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    borderTopColor: '#5FFF9A',
    borderLeftColor: '#4FFF8A',
    borderRightColor: '#25CC60',
    borderBottomColor: '#1AAA50',
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
});
