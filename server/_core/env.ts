import "dotenv/config";

export const ENV = {
  appId: process.env.VITE_APP_ID || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL || "",
  cookieSecret: process.env.COOKIE_SECRET || "umai-dev-secret",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || "",
  ownerOpenId: process.env.OWNER_OPEN_ID || "",
};
