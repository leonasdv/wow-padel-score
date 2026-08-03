import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme/tokens';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  disabled,
  loading,
  fullWidth = true,
}: Props) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        isGhost && styles.ghost,
        fullWidth && { width: '100%' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.content}>
        {icon && iconPosition === 'left' && !loading && (
          <Ionicons name={icon} size={18} color={isPrimary ? colors.courtNavy : colors.textPrimary} />
        )}
        {loading ? (
          <ActivityIndicator color={isPrimary ? colors.courtNavy : colors.textPrimary} />
        ) : (
          <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary, isGhost && styles.labelGhost]}>
            {label}
          </Text>
        )}
        {icon && iconPosition === 'right' && !loading && (
          <Ionicons name={icon} size={18} color={isPrimary ? colors.courtNavy : colors.textPrimary} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 58,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.lime },
  secondary: { backgroundColor: colors.white06, borderWidth: 1, borderColor: colors.hairlineStrong },
  ghost: { backgroundColor: 'transparent' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '800' },
  labelPrimary: { color: colors.courtNavy },
  labelSecondary: { color: colors.textPrimary },
  labelGhost: { color: colors.textMuted, fontWeight: '700' },
});
