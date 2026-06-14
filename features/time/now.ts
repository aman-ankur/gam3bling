export function getCurrentDate(): Date {
  if (process.env.E2E_USE_FALLBACK_FIXTURES === "1" && process.env.E2E_NOW) {
    const e2eNow = new Date(process.env.E2E_NOW);

    if (!Number.isNaN(e2eNow.getTime())) {
      return e2eNow;
    }
  }

  return new Date();
}
