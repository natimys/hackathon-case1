import * as SecureStore from "expo-secure-store";
import type { MobileTokenPair } from "./contracts";
import type { TokenStore } from "./client-core";

const ACCESS_KEY = "session.access";
const REFRESH_KEY = "session.refresh";

export const secureTokenStore: TokenStore = {
  getAccessToken: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_KEY),
  async setTokens(tokens: MobileTokenPair) {
    try {
      await Promise.all([
        SecureStore.setItemAsync(ACCESS_KEY, tokens.access_token),
        SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token),
      ]);
    } catch (error) {
      await this.clearTokens();
      throw error;
    }
  },
  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },
};
