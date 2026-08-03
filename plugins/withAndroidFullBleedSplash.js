const fs = require('fs');
const path = require('path');
const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');

const DRAWABLE_NAME = 'splashscreen_fullbleed';
const BACKGROUND_DRAWABLE_NAME = 'splashscreen_fullbleed_bg';

function withFullBleedSplashImage(config, { image }) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidMainPath = path.join(projectRoot, 'android/app/src/main');

      const nodpiDir = path.join(androidMainPath, 'res/drawable-nodpi');
      await fs.promises.mkdir(nodpiDir, { recursive: true });
      await fs.promises.copyFile(
        path.join(projectRoot, image),
        path.join(nodpiDir, `${DRAWABLE_NAME}.png`)
      );

      const drawableDir = path.join(androidMainPath, 'res/drawable');
      await fs.promises.mkdir(drawableDir, { recursive: true });
      const layerListXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item>
    <bitmap android:src="@drawable/${DRAWABLE_NAME}" android:gravity="fill" />
  </item>
</layer-list>
`;
      await fs.promises.writeFile(path.join(drawableDir, `${BACKGROUND_DRAWABLE_NAME}.xml`), layerListXml);

      return config;
    },
  ]);
}

function withFullBleedSplashStyles(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    styles.resources.style = (styles.resources.style ?? []).map((style) => {
      if (style.$.name !== 'Theme.App.SplashScreen') return style;
      const items = (style.item ?? []).filter(
        (item) =>
          item.$.name !== 'android:windowSplashScreenBehavior' &&
          item.$.name !== 'android:windowBackground'
      );
      items.push({ $: { name: 'android:windowSplashScreenBehavior' }, _: 'disabled' });
      items.push({ $: { name: 'android:windowBackground' }, _: `@drawable/${BACKGROUND_DRAWABLE_NAME}` });
      return { ...style, item: items };
    });
    return config;
  });
}

// Opts Android out of the androidx SplashScreen "icon_preferred" API (which only ever
// renders a small centered icon, capped well below full-screen regardless of imageWidth)
// and instead sets a stretched full-bleed windowBackground so the poster fills the screen.
module.exports = function withAndroidFullBleedSplash(config, { image }) {
  config = withFullBleedSplashImage(config, { image });
  config = withFullBleedSplashStyles(config);
  return config;
};
