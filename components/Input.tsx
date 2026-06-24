import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { radii } from '../constants/theme';
import { makeStyles, useTheme } from '../lib/theme';

interface Props extends TextInputProps {
  label?: string;
  rightElement?: React.ReactNode;
}

export default function Input({ label, rightElement, style, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, rightElement ? styles.inputWithRight : null, style]}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          {...rest}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 10,
    color: colors.textDim,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderRadius: radii.md,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderTopColor: colors.borderLight,
    borderLeftColor: colors.borderMid,
    borderRightColor: colors.borderDark,
    borderBottomColor: colors.borderDarker,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  inputWithRight: {
    paddingRight: 4,
  },
  right: {
    paddingRight: 12,
  },
}));
