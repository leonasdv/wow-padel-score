import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius } from '../theme/tokens';

interface Props extends TextInputProps {
  label?: string;
  rightHint?: string;
  dark?: boolean;
}

export function TextField({ label, rightHint, dark, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          dark && { backgroundColor: colors.surfaceSunken },
          { borderColor: focused ? colors.lime : colors.hairlineStrong },
          style,
        ]}
        placeholderTextColor={colors.textFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {rightHint && <Text style={styles.hint}>{rightHint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 10,
  },
  input: {
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 10, textAlign: 'right' },
});
