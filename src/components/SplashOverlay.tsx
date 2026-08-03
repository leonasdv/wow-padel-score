import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme/tokens';

const LOGO_ASPECT = 880 / 519; // wow-lockup-dark.png intrinsic width / height

// Android 12+ only allows the native splash to show a small centered icon, so we hide
// the native one immediately and cover the screen with this full-bleed view instead.
export function SplashOverlay() {
  const { width: screenWidth } = useWindowDimensions();
  const logoWidth = Math.round(screenWidth * 0.62);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      <Image
        source={require('../../assets/wow-lockup-dark.png')}
        style={{ width: logoWidth, height: logoHeight, resizeMode: 'contain' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.courtNavy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
