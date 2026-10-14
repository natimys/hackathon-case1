import type { ExpoConfig } from "expo/config";

const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8000";
const production = ["prod", "production"].includes((process.env.APP_ENV ?? "").toLowerCase());

if (production && !apiUrl.startsWith("https://")) {
  throw new Error("Production builds require an HTTPS EXPO_PUBLIC_API_BASE_URL");
}

const config: ExpoConfig = {
  name: "Домофон Якутск",
  slug: "yakutsk-home-mobile",
  scheme: "yakutskhome",
  version: "0.1.0",
  orientation: "portrait",
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-document-picker",
    "expo-video",
    ...(!production && apiUrl.startsWith("http://")
      ? ["./plugins/with-development-cleartext-traffic"]
      : []),
  ],
  experiments: { typedRoutes: true },
  android: {
    package: "ru.yakutsk.home",
  },
  ios: { bundleIdentifier: "ru.yakutsk.home" },
};

export default config;
