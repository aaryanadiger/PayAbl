const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withVoiceShortcut(config) {
  config = withAndroidManifest(config, app => {
    const activity = app.modResults.manifest.application[0].activity.find(item => item.$['android:name'] === '.MainActivity');
    if (!activity) throw new Error('Payabl launcher activity was not found.');
    activity['meta-data'] = (activity['meta-data'] || []).filter(item => item.$['android:name'] !== 'android.app.shortcuts');
    activity['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/payabl_shortcuts' } });
    return app;
  });
  return withDangerousMod(config, ['android', async app => {
    const packageName = app.android.package;
    const directory = path.join(app.modRequest.platformProjectRoot, 'app/src/main/res');
    await fs.mkdir(path.join(directory, 'xml'), { recursive: true });
    await fs.mkdir(path.join(directory, 'values'), { recursive: true });
    await fs.writeFile(path.join(directory, 'values/payabl_shortcuts.xml'), '<resources><string name="payabl_voice_payment">Voice payment</string></resources>');
    await fs.writeFile(path.join(directory, 'xml/payabl_shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <capability android:name="actions.intent.OPEN_APP_FEATURE">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.MainActivity" android:data="payabl:///?screen=contacts&amp;voice=1" />
  </capability>
  <shortcut android:shortcutId="voice_payment" android:shortcutShortLabel="@string/payabl_voice_payment" android:icon="@mipmap/ic_launcher">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.MainActivity" android:data="payabl:///?screen=contacts&amp;voice=1" />
    <capability-binding android:key="actions.intent.OPEN_APP_FEATURE"><parameter-binding android:key="feature" android:value="voice payment" /></capability-binding>
  </shortcut>
</shortcuts>`);
    return app;
  }]);
};
