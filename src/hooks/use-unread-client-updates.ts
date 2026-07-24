import { useSyncExternalStore } from "react";
import {
  hasUnreadClientUpdates,
  subscribeClientUpdatesSeen,
} from "@/lib/client-updates-seen";

export function useUnreadClientUpdates(
  clientId: string,
  clientUpdatesAt: string | null | undefined,
) {
  return useSyncExternalStore(
    subscribeClientUpdatesSeen,
    () => hasUnreadClientUpdates(clientId, clientUpdatesAt),
    () => false,
  );
}
