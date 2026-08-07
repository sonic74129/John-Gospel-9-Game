import scriptureArtifact from "./licensed-artifacts/scrollmapper-chiun-john9.json" with { type: "json" };

const DIALOGUE_SEGMENT_PLAN = Object.freeze([
  Object.freeze([{ verseKey: "john9:1", segmentId: "john9:1:full" }]),
  Object.freeze([{ verseKey: "john9:2", segmentId: "john9:2:full" }]),
  Object.freeze([
    { verseKey: "john9:3", segmentId: "john9:3:full" },
    { verseKey: "john9:4", segmentId: "john9:4:full" },
    { verseKey: "john9:5", segmentId: "john9:5:full" },
  ]),
  Object.freeze([{ verseKey: "john9:6", segmentId: "john9:6:full" }]),
  Object.freeze([
    {
      verseKey: "john9:7",
      segmentId: "john9:7:instruction",
      exactText:
        "對他說：「你往西羅亞池子裡去洗。」（西羅亞翻出來就是「奉差遣」。）",
      textSha256:
        "3071898244dd5860d5bbc59b8c3feb91049eb33be777eee1e494894f0a07e452",
    },
  ]),
  Object.freeze([
    {
      verseKey: "john9:7",
      segmentId: "john9:7:outcome",
      exactText: "他去一洗，回頭就看見了。",
      textSha256:
        "ee78785f3b9202814ec088d6f002b00459cdc20438cef208fa75fa8a544629ff",
    },
  ]),
]);

const verseByKey = new Map(
  scriptureArtifact.verses.map((verse) => [verse.key, verse] as const),
);

export const DIALOGUE_SEGMENTS = Object.freeze(
  DIALOGUE_SEGMENT_PLAN.flatMap((segments, beatIndex) => {
    const beatId = `b${String(beatIndex + 1).padStart(2, "0")}`;
    return segments.map((segment) => {
      const verse = verseByKey.get(segment.verseKey);
      if (verse === undefined) {
        throw new Error(`Missing exact scripture text for ${segment.verseKey}.`);
      }
      return Object.freeze({
        id: `dlg-${beatId}-${segment.segmentId.replaceAll(":", "-")}`,
        beatId,
        speakerId: "scripture",
        verseKey: segment.verseKey,
        segmentId: segment.segmentId,
        sourceLevel: "S0" as const,
        sourceLabel: "1919 和合本（繁體神版）",
        exactText: segment.exactText ?? verse.exactText,
        textSha256: segment.textSha256 ?? verse.sha256,
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
