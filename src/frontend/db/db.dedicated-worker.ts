/// <reference lib="webworker" />
import * as Comlink from "comlink";
import { createWorkerApi } from "./shared/worker-api";

// Dedicated-Worker fallback for environments without SharedWorker support.
// OPFS-SAHPool holds an exclusive lock on the database file, so this path is
// effectively single-tab — opening the app in a second tab will fail at
// init() and the UI surfaces a "another tab has the database open" banner.
Comlink.expose(createWorkerApi());
