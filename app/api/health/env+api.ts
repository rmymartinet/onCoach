export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const betterAuthUrl = process.env.BETTER_AUTH_URL;

  return Response.json({
    ok: true,
    env: {
      hasDatabaseUrl: Boolean(databaseUrl && databaseUrl.trim().length > 0),
      hasBetterAuthSecret: Boolean(betterAuthSecret && betterAuthSecret.trim().length > 0),
      hasBetterAuthUrl: Boolean(betterAuthUrl && betterAuthUrl.trim().length > 0),
    },
  });
}
