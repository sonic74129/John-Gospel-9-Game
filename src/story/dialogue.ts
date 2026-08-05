import scriptureArtifact from "./licensed-artifacts/scrollmapper-chiun-john9.json" with { type: "json" };

const VERSE_KEYS_BY_BEAT = Object.freeze([
  ["john9:1"],
  ["john9:2"],
  ["john9:3", "john9:4", "john9:5"],
  ["john9:6", "john9:7"],
  ["john9:7"],
  ["john9:8", "john9:9"],
  ["john9:10", "john9:11", "john9:12"],
  ["john9:13", "john9:14"],
  ["john9:15", "john9:16"],
  ["john9:17"],
  ["john9:18", "john9:19"],
  ["john9:20", "john9:21", "john9:22", "john9:23"],
  ["john9:24"],
  ["john9:25"],
  ["john9:26", "john9:27"],
  ["john9:28", "john9:29"],
  ["john9:30", "john9:31", "john9:32", "john9:33", "john9:34"],
  ["john9:35", "john9:36", "john9:37", "john9:38"],
  ["john9:39", "john9:40", "john9:41"],
]);

const verseByKey = new Map(
  scriptureArtifact.verses.map((verse) => [verse.key, verse] as const),
);

export const DIALOGUE_SEGMENTS = Object.freeze(
  VERSE_KEYS_BY_BEAT.flatMap((verseKeys, beatIndex) => {
    const beatId = `b${String(beatIndex + 1).padStart(2, "0")}`;
    return verseKeys.map((verseKey) => {
      const verse = verseByKey.get(verseKey);
      if (verse === undefined) {
        throw new Error(`Missing exact scripture text for ${verseKey}.`);
      }
      return Object.freeze({
        id: `dlg-${beatId}-${verseKey.replace(":", "-")}`,
        beatId,
        speakerId: "scripture",
        verseKey,
        segmentId: `${verseKey}:full`,
        sourceLevel: "S0" as const,
        sourceLabel: "1919 和合本（繁體神版）",
        exactText: verse.exactText,
        textSha256: verse.sha256,
      });
    });
  }),
);

export const DIALOGUE_BY_BEAT = Object.freeze(
  DIALOGUE_SEGMENTS.reduce<Record<string, readonly typeof DIALOGUE_SEGMENTS[number][]>>(
    (groups, line) => ({
      ...groups,
      [line.beatId]: Object.freeze([...(groups[line.beatId] ?? []), line]),
    }),
    {},
  ),
);
