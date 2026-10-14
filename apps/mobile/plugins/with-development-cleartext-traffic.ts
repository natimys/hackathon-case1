import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

const withDevelopmentCleartextTraffic: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android manifest has no application element");
    application.$["android:usesCleartextTraffic"] = "true";
    return modConfig;
  });

export default withDevelopmentCleartextTraffic;
