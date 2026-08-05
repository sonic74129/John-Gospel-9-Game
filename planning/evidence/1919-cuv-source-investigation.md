# 1919 CUV source investigation

This record captures the completed search for an exact original 1919
Traditional Chinese Union Version (和合本), 神版 source for John 9. It contains no
scripture text and grants no source, rights, transcription, or review approval.

## Result

No ready-to-download, institutionally hosted 1919 神版 scan was found with all
of the evidence needed for use: verifiable bibliography, title/imprint/variant
pages, every John 9 page, reuse terms, and stable institutional identifiers.
The fixed translation identity is therefore unchanged, but no candidate is an
authorized John 9 source artifact. The Gate remains
`blocked-text-unavailable`.

## Candidate evidence

| Candidate | Evidence found | Classification and limit |
| --- | --- | --- |
| Cambridge University Library physical first edition | Catalog record for *新舊約全書*, “Bible Chinese Peking Union 1919,” First edition, Shanghai: BFBS, 1919; MMS `9947142403403606`; shelfmark `BSS.612.F19.6`; [institutional catalog](https://idiscover.lib.cam.ac.uk/discovery/fulldisplay?docid=alma9947142403403606&context=L&vid=44CAM_INST%3A44CAM_PROD&lang=en) | **Keep as the strongest bibliographic lead.** The item is not digitized through this record. Its 神版 identity, title/imprint evidence, John 9 pages, image bytes, reuse terms, and stable page-level IDs are not available or confirmed. It is not a source artifact. |
| FHL item 403 | Reported catalog claim: `上海大美國聖經公會印官話和合譯本 (1919)`. That description makes 神版 plausible, not proven. | **Adapt only as a retrieval lead.** The current environment could not connect to the item. Files, metadata, variant-identifying pages, John 9 coverage, stable IDs, custodian relationship, and reuse terms were not independently verified. It is not authority for John 9. |
| `mondain-dev/cuv-1919` at fixed commit `4cc18e40ee87681dee6aacc2c529d2d9d09e50ac` | The GitHub tree contains only a Genesis transcription experiment and no license file. The fixed tree was checked through the GitHub API during this planning update. | **Discard as John 9 authority.** It contains no John material, has no demonstrated institutional provenance, and supplies no reuse grant. It must not seed, correct, or validate John 9 text. |

The Cambridge catalog is evidence that a physical 1919 first edition exists,
not evidence that the held copy is the selected 神版 or that its pages may be
copied. The FHL description is a lead, not a verified source. The GitHub
experiment is neither complete nor licensed. None supplies source bytes,
per-page hashes, stable 41-verse boundaries, or a trusted provenance chain.

## Required source package

To unblock exact-text acquisition, a custodian-backed source package must
provide:

1. Images of the title, imprint, and variant-identifying pages, plus every page
   containing John 9, all tied to an institutional catalog record or identified
   custodian.
2. Stable catalog, object, and page identifiers sufficient to reproduce the
   acquisition.
3. Acquisition date and method, original source-image bytes, and SHA-256 for
   every image and for the complete image set.
4. Reuse terms or an approval record covering the intended handling of scan
   images, with an evidence locator and hash.
5. A documented conclusion that the imaged volume is the original 1919 和合本
   神版 rather than a later punctuation, revision, 上帝版, API, or modern
   substitute.

If scan reuse is unclear, source images must remain private. Only an
independently transcribed public-domain text may be distributed, and only after
rights/provenance approval confirms that scope. Public-domain text status does
not itself authorize redistribution of a custodian's scan files.

## Required transcription and review package

The authorized images must be converted to text under this minimum protocol:

1. Two Traditional-Chinese-literate keyers independently double-key John 9
   from the source images without sharing intermediate transcriptions.
2. A third qualified adjudicator resolves every disagreement against the source
   images and records the decision evidence.
3. A qualified reviewer confirms exactly 41 stable verse boundaries and the
   complete John 9:1-41 sequence.
4. The canonical text uses UTF-8, NFC normalization, and LF line endings. NFKC,
   OpenCC conversion, automated punctuation modernization, and automatic
   substitution from another edition are prohibited.
5. No unresolved, uncertain, illegible, or replacement glyph remains. Any such
   glyph keeps the text unavailable.
6. The package records SHA-256 for the canonical whole-file bytes and for each
   of the 41 exact verse byte sequences.
7. Trusted reviewer anchors identify the source images, both keying records,
   adjudication record, verse-boundary review, canonical bytes, and hashes.

Only that evidence, together with approved rights/provenance and trusted
reviewer records, can populate the currently null verse slots. This
investigation does not satisfy those approvals.
