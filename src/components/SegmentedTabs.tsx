import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ColorPalette } from '../theme/tokens';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  size?: 'lg' | 'sm';
}

export function SegmentedTabs({ options, value, onChange, size = 'lg' }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isLg = size === 'lg';
  return (
    <View style={[styles.track, { padding: isLg ? 4 : 3, borderRadius: isLg ? 14 : 11 }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.tab,
              { height: isLg ? 42 : 36, borderRadius: isLg ? 10 : 8 },
              active && styles.active,
              !isLg && { paddingHorizontal: 16, flex: undefined },
            ]}
          >
            <Text style={[styles.label, { fontSize: isLg ? 14 : 13, color: active ? colors.courtNavy : colors.textMuted, fontWeight: active ? '800' : '700' }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.hairline,
      gap: 4,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    active: { backgroundColor: colors.lime },
    label: {},
  });
