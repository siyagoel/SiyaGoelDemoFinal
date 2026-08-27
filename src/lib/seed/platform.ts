import { createSeededPlatform, type SeededPlatform } from "./history";

/**
 * The KYC store, the flag store and the audit log all read from one seed so
 * their initial states agree. Held on globalThis so every module in the
 * process — and every dev-server reload — sees the same history.
 */
const globalSeed = globalThis as typeof globalThis & {
  __platformSeed?: SeededPlatform;
};

export function platformSeed(): SeededPlatform {
  if (!globalSeed.__platformSeed) {
    globalSeed.__platformSeed = createSeededPlatform();
  }
  return globalSeed.__platformSeed;
}
