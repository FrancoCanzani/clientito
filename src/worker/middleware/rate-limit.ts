import type { MiddlewareHandler } from "hono";
import type { AppRouteEnv } from "../routes/types";

const passThrough: MiddlewareHandler<AppRouteEnv> = async (_c, next) => {
  await next();
};

export const authLimiter = passThrough;
export const strictLimiter = passThrough;
export const standardLimiter = passThrough;
