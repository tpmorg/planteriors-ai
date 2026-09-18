/**
 * Restores the Android `<queries>` entry that `Linking.canOpenURL('https://…')` needs on
 * Android 11+ (API 30+).
 *
 * Why this exists: `@reactvision/react-viro@2.53.1`'s config plugin (`withViroManifest`) does
 *
 *     contents.manifest.queries = [{ package: [{ $: { 'android:name': 'com.google.ar.core' } }] }]
 *
 * i.e. it *assigns* `manifest.queries` instead of appending to it. That replaces the Expo
 * template's entry
 *
 *     <queries>
 *       <intent>
 *         <action android:name="android.intent.action.VIEW" />
 *         <category android:name="android.intent.category.BROWSABLE" />
 *         <data android:scheme="https" />
 *       </intent>
 *     </queries>
 *
 * Without it, package-visibility filtering hides every https handler, so
 * `Linking.canOpenURL('https://…')` resolves to `false` and the app skips opening the link.
 * (`SettingsScreen`, `AccountScreen`, `AuthScreen`, `NearbyShopsModal` all gate on that check.)
 *
 * Ordering note: `app.json` lists this plugin *before* `@reactvision/react-viro` deliberately.
 * AndroidManifest mods from config plugins are chained with the most recently registered action
 * outermost, so registering earlier makes this action run **after** Viro has already set
 * `manifest.queries`. Verified empirically: the generated
 * `android/app/src/main/AndroidManifest.xml` contains the https query when this plugin is
 * registered before Viro, and contains none when it is registered after Viro.
 *
 * Scope: additive and idempotent. It only adds a query entry if one with the https scheme is not
 * already present, and it removes nothing.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const HTTPS_VIEW_QUERY = {
  intent: [
    {
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': 'https' } }],
    },
  ],
};

function hasHttpsSchemeQuery(queries) {
  if (!Array.isArray(queries)) return false;
  return queries.some((entry) => {
    const intent = Array.isArray(entry?.intent) ? entry.intent[0] : undefined;
    const data = intent?.data;
    return (
      Array.isArray(data) && data.some((item) => item?.$?.['android:scheme'] === 'https')
    );
  });
}

function withAndroidHttpsLinkingQueries(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const queries = Array.isArray(manifest.queries) ? manifest.queries : [];

    if (!hasHttpsSchemeQuery(queries)) {
      manifest.queries = [...queries, HTTPS_VIEW_QUERY];
    }

    return modConfig;
  });
}

module.exports = withAndroidHttpsLinkingQueries;
module.exports.default = withAndroidHttpsLinkingQueries;
