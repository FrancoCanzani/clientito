import { clearLocalData } from "@/db/client";
import { resetCurrentUserCache } from "@/db/user";
import { signOut } from "@/lib/auth-client";
import { queryClient } from "@/lib/query-client";

export const APP_VERSION = __APP_VERSION__;
export const LOCAL_SCHEMA_VERSION = "4";

let bootedOut = false;

export async function forceSignOut(reason: string): Promise<void> {
 if (bootedOut) return;
 bootedOut = true;
 console.warn(`[forceSignOut] ${reason}`);
 try {
 await signOut();
 } catch {
 /* signOut failures are non-fatal — we still clear local state */
 }
 resetCurrentUserCache();
 await clearLocalData();
 queryClient.clear();
 window.location.href = "/login";
}
