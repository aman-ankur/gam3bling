import type {
  FootballProvider,
  ProviderMatchDetails,
  ProviderMatchQuery,
  ProviderMatchUpdate
} from "./provider";

export function createFallbackFootballProvider(providers: FootballProvider[]): FootballProvider {
  if (providers.length === 0) {
    throw new Error("At least one football provider is required");
  }

  return {
    name: providers.map((provider) => provider.name).join("+"),
    async fetchUpdates(matches) {
      const remaining = [...matches];
      const updates: ProviderMatchUpdate[] = [];
      const errors: string[] = [];

      for (const provider of providers) {
        if (remaining.length === 0) {
          break;
        }

        try {
          const providerUpdates = await provider.fetchUpdates([...remaining]);
          updates.push(...providerUpdates);
          removeResolvedMatches(remaining, providerUpdates);
        } catch (error) {
          errors.push(`${provider.name}: ${errorMessage(error)}`);
        }
      }

      if (updates.length === 0 && errors.length > 0) {
        throw new Error(errors.join(" | "));
      }

      return updates;
    },
    async fetchMatchDetails(match) {
      const errors: string[] = [];
      let lastDetails: ProviderMatchDetails | null = null;

      for (const provider of providers) {
        try {
          const details = await provider.fetchMatchDetails(match);

          if (details.lineupsStatus === "available" || details.statisticsStatus === "available") {
            return details;
          }

          lastDetails = details;
        } catch (error) {
          errors.push(`${provider.name}: ${errorMessage(error)}`);
        }
      }

      if (lastDetails) {
        return lastDetails;
      }

      throw new Error(errors.join(" | ") || "No football provider returned match details");
    }
  };
}

function removeResolvedMatches(
  remaining: Array<string | ProviderMatchQuery>,
  updates: ProviderMatchUpdate[]
): void {
  const resolvedLocalIds = new Set(updates.map((update) => update.localMatchId).filter(Boolean));
  const resolvedApiIds = new Set(updates.map((update) => update.apiMatchId));

  for (let index = remaining.length - 1; index >= 0; index -= 1) {
    const match = remaining[index];

    if (typeof match === "string") {
      if (resolvedApiIds.has(match)) {
        remaining.splice(index, 1);
      }

      continue;
    }

    if (resolvedLocalIds.has(match.localMatchId) || (match.apiMatchId && resolvedApiIds.has(match.apiMatchId))) {
      remaining.splice(index, 1);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
