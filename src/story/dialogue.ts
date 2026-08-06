import scripture from "./scripture.json" with { type: "json" };

type TextSelector =
  | Readonly<{ kind: "full" }>
  | Readonly<{ kind: "quote"; index: number }>
  | Readonly<{ kind: "after-open" }>
  | Readonly<{ kind: "before-quote" }>
  | Readonly<{ kind: "before"; token: string }>
  | Readonly<{ kind: "from"; token: string }>
  | Readonly<{ kind: "between"; start: string; end: string }>;

const selectors: Readonly<Record<string, TextSelector>> = {
  "john9:2:disciples-question": { kind: "quote", index: 0 },
  "john9:3:jesus-answer": { kind: "after-open" },
  "john9:4:jesus-works": { kind: "full" },
  "john9:5:jesus-light": { kind: "full" },
  "john9:7:jesus-instruction": { kind: "quote", index: 0 },
  "john9:8:neighbors-question": { kind: "quote", index: 0 },
  "john9:9:people-disagree-a": { kind: "quote", index: 0 },
  "john9:9:people-disagree-b": { kind: "quote", index: 1 },
  "john9:9:man-identifies": { kind: "quote", index: 2 },
  "john9:10:neighbors-ask-how": { kind: "quote", index: 0 },
  "john9:11:man-answers": { kind: "quote", index: 0 },
  "john9:12:neighbors-ask-where": { kind: "quote", index: 0 },
  "john9:12:man-does-not-know": { kind: "quote", index: 1 },
  "john9:15:pharisees-ask-how": {
    kind: "before",
    token: "瞎子對他們說",
  },
  "john9:15:man-answers": { kind: "quote", index: 0 },
  "john9:16:pharisees-disagree-a": { kind: "quote", index: 0 },
  "john9:16:pharisees-disagree-b": { kind: "quote", index: 1 },
  "john9:17:pharisees-ask-opinion": { kind: "quote", index: 0 },
  "john9:17:man-answers": { kind: "quote", index: 1 },
  "john9:19:authorities-question": { kind: "quote", index: 0 },
  "john9:20:parents-identify": { kind: "after-open" },
  "john9:21:parents-do-not-know": { kind: "before", token: "他已經成了人" },
  "john9:21:parents-defer": { kind: "from", token: "他已經成了人" },
  "john9:24:pharisees-demand": { kind: "quote", index: 0 },
  "john9:25:man-does-not-know": {
    kind: "between",
    start: "：「",
    end: "；有一件事",
  },
  "john9:25:man-known-fact": { kind: "from", token: "有一件事" },
  "john9:26:pharisees-repeat-question": { kind: "quote", index: 0 },
  "john9:27:man-answers-again": { kind: "quote", index: 0 },
  "john9:28:pharisees-revile": { kind: "after-open" },
  "john9:29:pharisees-claim": { kind: "full" },
  "john9:30:man-answer-a": { kind: "after-open" },
  "john9:31:man-answer-b": { kind: "full" },
  "john9:32:man-answer-c": { kind: "full" },
  "john9:33:man-answer-d": { kind: "full" },
  "john9:34:pharisees-answer": { kind: "quote", index: 0 },
  "john9:35:jesus-question": { kind: "quote", index: 0 },
  "john9:36:man-question": { kind: "quote", index: 0 },
  "john9:37:jesus-answer": { kind: "quote", index: 0 },
  "john9:38:man-confession": { kind: "quote", index: 0 },
  "john9:39:jesus-saying": { kind: "quote", index: 0 },
  "john9:40:pharisees-question": { kind: "quote", index: 0 },
  "john9:41:jesus-answer": { kind: "quote", index: 0 },
};

const verseTextByKey = new Map(
  scripture.verses.map(({ key, exactText }) => [key, exactText]),
);

function trimSpeechPunctuation(text: string): string {
  return text.replace(/^「/, "").replace(/」$/, "").trim();
}

function selectText(verseKey: string, segmentId: string): string {
  const text = verseTextByKey.get(verseKey);
  const selector = selectors[segmentId];
  if (typeof text !== "string" || text.length === 0 || selector === undefined) {
    throw new Error(`Missing exact scripture text for ${segmentId}.`);
  }
  switch (selector.kind) {
    case "full":
      return trimSpeechPunctuation(text);
    case "quote": {
      const quotes = [...text.matchAll(/「([^」]+)」/g)];
      const selected = quotes[selector.index]?.[1];
      if (selected === undefined) {
        throw new Error(`Missing quote ${selector.index} for ${segmentId}.`);
      }
      return selected;
    }
    case "after-open": {
      const marker = text.indexOf("：「");
      if (marker < 0) {
        throw new Error(`Missing speech opening for ${segmentId}.`);
      }
      return trimSpeechPunctuation(text.slice(marker + 2));
    }
    case "before-quote": {
      const marker = text.indexOf("「");
      if (marker < 0) {
        throw new Error(`Missing quote boundary for ${segmentId}.`);
      }
      return text.slice(0, marker).trim();
    }
    case "before": {
      const marker = text.indexOf(selector.token);
      if (marker < 0) {
        throw new Error(`Missing split token for ${segmentId}.`);
      }
      return trimSpeechPunctuation(text.slice(0, marker));
    }
    case "from": {
      const marker = text.indexOf(selector.token);
      if (marker < 0) {
        throw new Error(`Missing split token for ${segmentId}.`);
      }
      return trimSpeechPunctuation(text.slice(marker));
    }
    case "between": {
      const start = text.indexOf(selector.start);
      const end = text.indexOf(selector.end, start + selector.start.length);
      if (start < 0 || end < 0) {
        throw new Error(`Missing split boundary for ${segmentId}.`);
      }
      return trimSpeechPunctuation(
        text.slice(start + selector.start.length, end),
      );
    }
  }
}

const scriptureLine = (id, beatId, speakerId, verseKey, segmentId) =>
  Object.freeze({
    id,
    beatId,
    speakerId,
    verseKey,
    segmentId,
    sourceLevel: "S0",
    sourceLabel: "經文原文",
    text: selectText(verseKey, segmentId),
  });

export const DIALOGUE_SEGMENTS = Object.freeze([
  scriptureLine("dlg-b02-01", "b02", "disciples", "john9:2", "john9:2:disciples-question"),
  scriptureLine("dlg-b03-01", "b03", "jesus", "john9:3", "john9:3:jesus-answer"),
  scriptureLine("dlg-b03-02", "b03", "jesus", "john9:4", "john9:4:jesus-works"),
  scriptureLine("dlg-b03-03", "b03", "jesus", "john9:5", "john9:5:jesus-light"),
  scriptureLine("dlg-b04-01", "b04", "jesus", "john9:7", "john9:7:jesus-instruction"),
  scriptureLine("dlg-b06-01", "b06", "neighbors", "john9:8", "john9:8:neighbors-question"),
  scriptureLine("dlg-b06-02", "b06", "neighbors", "john9:9", "john9:9:people-disagree-a"),
  scriptureLine("dlg-b06-03", "b06", "neighbors", "john9:9", "john9:9:people-disagree-b"),
  scriptureLine("dlg-b06-04", "b06", "man-born-blind", "john9:9", "john9:9:man-identifies"),
  scriptureLine("dlg-b07-01", "b07", "neighbors", "john9:10", "john9:10:neighbors-ask-how"),
  scriptureLine("dlg-b07-02", "b07", "man-born-blind", "john9:11", "john9:11:man-answers"),
  scriptureLine("dlg-b07-03", "b07", "neighbors", "john9:12", "john9:12:neighbors-ask-where"),
  scriptureLine("dlg-b07-04", "b07", "man-born-blind", "john9:12", "john9:12:man-does-not-know"),
  scriptureLine("dlg-b09-01", "b09", "pharisees", "john9:15", "john9:15:pharisees-ask-how"),
  scriptureLine("dlg-b09-02", "b09", "man-born-blind", "john9:15", "john9:15:man-answers"),
  scriptureLine("dlg-b09-03", "b09", "pharisees", "john9:16", "john9:16:pharisees-disagree-a"),
  scriptureLine("dlg-b09-04", "b09", "pharisees", "john9:16", "john9:16:pharisees-disagree-b"),
  scriptureLine("dlg-b10-01", "b10", "pharisees", "john9:17", "john9:17:pharisees-ask-opinion"),
  scriptureLine("dlg-b10-02", "b10", "man-born-blind", "john9:17", "john9:17:man-answers"),
  scriptureLine("dlg-b11-01", "b11", "judean-authorities", "john9:19", "john9:19:authorities-question"),
  scriptureLine("dlg-b12-01", "b12", "parents", "john9:20", "john9:20:parents-identify"),
  scriptureLine("dlg-b12-02", "b12", "parents", "john9:21", "john9:21:parents-do-not-know"),
  scriptureLine("dlg-b12-03", "b12", "parents", "john9:21", "john9:21:parents-defer"),
  scriptureLine("dlg-b13-01", "b13", "pharisees", "john9:24", "john9:24:pharisees-demand"),
  scriptureLine("dlg-b14-01", "b14", "man-born-blind", "john9:25", "john9:25:man-does-not-know"),
  scriptureLine("dlg-b14-02", "b14", "man-born-blind", "john9:25", "john9:25:man-known-fact"),
  scriptureLine("dlg-b15-01", "b15", "pharisees", "john9:26", "john9:26:pharisees-repeat-question"),
  scriptureLine("dlg-b15-02", "b15", "man-born-blind", "john9:27", "john9:27:man-answers-again"),
  scriptureLine("dlg-b16-01", "b16", "pharisees", "john9:28", "john9:28:pharisees-revile"),
  scriptureLine("dlg-b16-02", "b16", "pharisees", "john9:29", "john9:29:pharisees-claim"),
  scriptureLine("dlg-b17-01", "b17", "man-born-blind", "john9:30", "john9:30:man-answer-a"),
  scriptureLine("dlg-b17-02", "b17", "man-born-blind", "john9:31", "john9:31:man-answer-b"),
  scriptureLine("dlg-b17-03", "b17", "man-born-blind", "john9:32", "john9:32:man-answer-c"),
  scriptureLine("dlg-b17-04", "b17", "man-born-blind", "john9:33", "john9:33:man-answer-d"),
  scriptureLine("dlg-b17-05", "b17", "pharisees", "john9:34", "john9:34:pharisees-answer"),
  scriptureLine("dlg-b18-01", "b18", "jesus", "john9:35", "john9:35:jesus-question"),
  scriptureLine("dlg-b18-02", "b18", "man-born-blind", "john9:36", "john9:36:man-question"),
  scriptureLine("dlg-b18-03", "b18", "jesus", "john9:37", "john9:37:jesus-answer"),
  scriptureLine("dlg-b18-04", "b18", "man-born-blind", "john9:38", "john9:38:man-confession"),
  scriptureLine("dlg-b19-01", "b19", "jesus", "john9:39", "john9:39:jesus-saying"),
  scriptureLine("dlg-b19-02", "b19", "pharisees", "john9:40", "john9:40:pharisees-question"),
  scriptureLine("dlg-b19-03", "b19", "jesus", "john9:41", "john9:41:jesus-answer"),
]);

export const DIALOGUE_BY_BEAT = Object.freeze(
  DIALOGUE_SEGMENTS.reduce(
    (groups, line) => ({
      ...groups,
      [line.beatId]: Object.freeze([...(groups[line.beatId] ?? []), line]),
    }),
    {},
  ),
);
