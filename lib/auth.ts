import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

function asOrigin(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

const betterAuthUrl = process.env.BETTER_AUTH_URL;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const auth = betterAuth({
  secret: process.env["BETTER_AUTH_SECRET"],
  baseURL: betterAuthUrl,
  trustedOrigins: [asOrigin(betterAuthUrl), asOrigin(apiBaseUrl)].filter(
    (value): value is string => Boolean(value),
  ),
  advanced: {
    // React Native / Expo fetch may omit Origin on authenticated requests.
    // Keep strict CSRF in production; relax in dev to unblock local mobile auth.
    disableCSRFCheck: process.env.NODE_ENV !== "production",
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
