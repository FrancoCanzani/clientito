import { rateLimiter } from "hono-rate-limiter";
import type { AppRouteEnv } from "../routes/types";

const isLocalRequest = (c: any): boolean => {
  const host = c.req.header("host") ?? "";
  const origin = c.req.header("origin") ?? "";
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
  );
};

const userKey = (c: any): string => {
  const user = c.get("user");
  return user?.id ?? c.req.header("cf-connecting-ip") ?? "anonymous";
};

const ipKey = (c: any): string => {
  const forwardedIp =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for") ??
    c.req.header("x-real-ip");

  if (forwardedIp) {
    return forwardedIp;
  }

  if (isLocalRequest(c)) {
    return "localhost-dev";
  }

  const userAgent = c.req.header("user-agent");
  if (userAgent) {
    return `ua:${userAgent}`;
  }

  return "unknown";
};

const isSafeAuthRead = (c: any): boolean => c.req.method === "GET";

/** Auth routes: brute force protection */
export const authLimiter = rateLimiter<AppRouteEnv>({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: ipKey,
  skip: (c) => isLocalRequest(c) || isSafeAuthRead(c),
});

export const strictLimiter = rateLimiter<AppRouteEnv>({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: userKey,
});

export const standardLimiter = rateLimiter<AppRouteEnv>({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: userKey,
});
