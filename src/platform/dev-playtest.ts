export interface DevPlaytestRequest {
  readonly beatId: string;
  readonly completedBeatIds: readonly string[];
}

const DEV_PLAYTEST_BEAT_COUNT = 20;

export const DEFAULT_DEV_PLAYTEST_BEAT_IDS = Object.freeze(
  Array.from({ length: DEV_PLAYTEST_BEAT_COUNT }, (_, index) => {
    const beatNumber = index + 1;
    return `b${String(beatNumber).padStart(2, "0")}`;
  }),
);

function normalizeCanonicalBeatIds(
  beatIds: readonly string[],
): readonly string[] {
  if (!Array.isArray(beatIds) || beatIds.length === 0) {
    throw new RangeError("Canonical playtest beat IDs must not be empty.");
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const beatId of beatIds) {
    if (typeof beatId !== "string" || beatId.length === 0) {
      throw new TypeError(
        "Canonical playtest beat IDs must be non-empty strings.",
      );
    }
    if (seen.has(beatId)) {
      throw new RangeError(`Duplicate canonical playtest beat ID: ${beatId}.`);
    }
    seen.add(beatId);
    normalized.push(beatId);
  }

  return Object.freeze(normalized);
}

function toSearchParams(
  input: string | URLSearchParams,
): URLSearchParams {
  if (typeof input !== "string") {
    return input;
  }

  const query = input.startsWith("?") ? input.slice(1) : input;
  return new URLSearchParams(query);
}

export function getCompletedPredecessorBeatIds(
  beatId: string,
  canonicalBeatIds: readonly string[] = DEFAULT_DEV_PLAYTEST_BEAT_IDS,
): readonly string[] {
  const ids = normalizeCanonicalBeatIds(canonicalBeatIds);
  const beatIndex = ids.indexOf(beatId);
  if (beatIndex < 0) {
    throw new RangeError(`Unsupported playtest beat ID: ${beatId}.`);
  }

  return Object.freeze(ids.slice(0, beatIndex));
}

export function parseDevPlaytestRequest(
  input: string | URLSearchParams | null | undefined,
  canonicalBeatIds: readonly string[] = DEFAULT_DEV_PLAYTEST_BEAT_IDS,
): DevPlaytestRequest | null {
  if (input == null) {
    return null;
  }

  const params = toSearchParams(input);
  if (!params.has("playtest")) {
    return null;
  }

  const playtestValues = params.getAll("playtest");
  if (playtestValues.length !== 1) {
    throw new RangeError("playtest must appear exactly once.");
  }

  const beatId = playtestValues[0];
  if (beatId === undefined || beatId === "") {
    throw new RangeError("playtest beat ID must not be empty.");
  }

  const completedBeatIds = getCompletedPredecessorBeatIds(
    beatId,
    canonicalBeatIds,
  );
  return Object.freeze({
    beatId,
    completedBeatIds,
  });
}
