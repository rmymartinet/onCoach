import { auth } from "@/lib/auth";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 20;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

type AttemptState = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const attemptsByKey = new Map<string, AttemptState>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function buildRateLimitKey(pathname: string, email: string | undefined, ip: string) {
  if (pathname.endsWith("/sign-in/email")) {
    return `signin:${email ?? "anon"}:${ip}`;
  }
  if (pathname.endsWith("/sign-up/email")) {
    return `signup:${email ?? "anon"}:${ip}`;
  }
  if (pathname.endsWith("/request-password-reset")) {
    return `password-reset:${email ?? "anon"}:${ip}`;
  }
  return `auth:${ip}`;
}

function parseEmailFromBody(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  if (!("email" in body)) return undefined;

  const maybeEmail = body.email;
  if (typeof maybeEmail !== "string") return undefined;

  return maybeEmail.trim().toLowerCase();
}

function checkBasicRateLimit(key: string, now: number) {
  const current = attemptsByKey.get(key);

  if (!current) {
    return { allowed: true as const };
  }

  if (current.lockedUntil && current.lockedUntil > now) {
    return {
      allowed: false as const,
      status: 429,
      message: "Too many attempts. Try again later.",
    };
  }

  const expiredWindow = now - current.firstAttemptAt > WINDOW_MS;
  if (expiredWindow) {
    attemptsByKey.delete(key);
    return { allowed: true as const };
  }

  if (current.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      allowed: false as const,
      status: 429,
      message: "Too many requests. Slow down and try again.",
    };
  }

  return { allowed: true as const };
}

function recordAttempt(key: string, now: number, status: number, isSignIn: boolean) {
  const previous = attemptsByKey.get(key);
  const expiredWindow =
    !previous || now - previous.firstAttemptAt > (isSignIn ? LOCKOUT_WINDOW_MS : WINDOW_MS);

  const nextCount = expiredWindow ? 1 : (previous?.count ?? 0) + 1;
  const firstAttemptAt = expiredWindow ? now : (previous?.firstAttemptAt ?? now);

  // On successful sign-in, clear lockout history.
  if (isSignIn && status >= 200 && status < 300) {
    attemptsByKey.delete(key);
    return;
  }

  const state: AttemptState = {
    count: nextCount,
    firstAttemptAt,
  };

  if (isSignIn && status === 401 && nextCount >= LOCKOUT_MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  attemptsByKey.set(key, state);
}

function maybeCleanup(now: number) {
  if (attemptsByKey.size < 200) return;

  for (const [key, state] of attemptsByKey.entries()) {
    const limitWindow = state.lockedUntil ? LOCKOUT_WINDOW_MS + LOCKOUT_DURATION_MS : WINDOW_MS;
    if (now - state.firstAttemptAt > limitWindow) {
      attemptsByKey.delete(key);
    }
  }
}

export async function GET(request: Request) {
  return auth.handler(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const ip = getClientIp(request);
  const now = Date.now();

  const body = await request
    .clone()
    .json()
    .catch(() => undefined);

  const email = parseEmailFromBody(body);
  const key = buildRateLimitKey(pathname, email, ip);
  const isSignIn = pathname.endsWith("/sign-in/email");

  const precheck = checkBasicRateLimit(key, now);
  if (!precheck.allowed) {
    return Response.json({ message: precheck.message }, { status: precheck.status });
  }

  const response = await auth.handler(request);
  recordAttempt(key, now, response.status, isSignIn);
  maybeCleanup(now);

  return response;
}

export async function PUT(request: Request) {
  return auth.handler(request);
}

export async function PATCH(request: Request) {
  return auth.handler(request);
}

export async function DELETE(request: Request) {
  return auth.handler(request);
}

export async function OPTIONS(request: Request) {
  return auth.handler(request);
}
