import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radii } from '../constants/theme';

interface Props extends TextInputProps {
  label?: string;
  rightElement?: React.ReactNode;
}

export default function Input({ label, rightElement, style, ...rest }: Props) {
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

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 8,
    color: '#3A3A3A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 5,
    fontWeight: '600',
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
});
