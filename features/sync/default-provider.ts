import { createApiFootballProvider } from "./api-football-provider";
import { createEpsnProvider } from "./espn-provider";
import { createFallbackFootballProvider } from "./fallback-provider";
import type { FootballProvider } from "./provider";

export function createDefaultFootballProvider(): FootballProvider {
  return createFallbackFootballProvider([
    createEpsnProvider(),
    createApiFootballProvider()
  ]);
}
