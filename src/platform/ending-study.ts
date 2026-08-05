export interface ApprovedStudyQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly verseKeys: readonly string[];
  readonly optional: true;
}

export const APPROVED_STUDY_QUESTIONS = Object.freeze([
  Object.freeze({
    id: "study-neighbor-testimony",
    prompt: "這些段落識別記錄了哪些辨認、詢問與見證？",
    verseKeys: Object.freeze(["john9:8", "john9:9", "john9:10", "john9:11", "john9:12"]),
    optional: true,
  }),
  Object.freeze({
    id: "study-parents-known-unknown",
    prompt: "父母在這些段落識別中分別說明了哪些已知與未知之處？",
    verseKeys: Object.freeze(["john9:18", "john9:19", "john9:20", "john9:21", "john9:22", "john9:23"]),
    optional: true,
  }),
  Object.freeze({
    id: "study-ending-questions",
    prompt: "結尾段落識別記錄了哪些提問與回應？",
    verseKeys: Object.freeze(["john9:35", "john9:36", "john9:37", "john9:38", "john9:39", "john9:40", "john9:41"]),
    optional: true,
  }),
] satisfies readonly ApprovedStudyQuestion[]);
