/// <reference types="vite/client" />

import type { RosterApi } from "@roster/shared-types";
import type { useAppStore } from "./stores/app-store";

declare global {
  interface Window {
    roster: RosterApi;
    __ROSTER_STORE__?: typeof useAppStore;
  }
}
