# Minimal user decisions for John 9

These are the only user-owned decisions needed to unblock scripture evidence.
They do not make the Planning Gate ready by themselves. Foundation policy and
trusted post-Promotion stage-transition work remain separate platform blockers.

## 1. Fixed translation identity; source artifact still required

**Recorded user decision:** John 9 and future story games default to the
original 1919 Traditional Chinese Union Version (和合本), 神版. Translation and
divine-name variant are fixed and must not be asked again.

**Still required:**

1. Supply the exact authorized 1919 神版 source artifact and provider.
2. Confirm that the supplied artifact covers all 41 verse slots for
   John 9:1-41 with stable verse boundaries.
3. Confirm canonical artifact, edition and translation IDs that identify the
   selected 1919 神版 without changing that decision.

**Evidence that must accompany the decision:**

- Exact authorized source bytes and SHA-256.
- Provider, artifact ID, edition, language and translation metadata.
- A trusted source locator using either a repository path plus SHA-256 or an
  external trust identity, external record ID and SHA-256.

No text may be copied from an unverified website, remembered text, another
story repository or a runtime branch.

The following are explicitly rejected as substitutes unless separately
authorized by a new user decision and complete source/rights/review evidence:

- 1988 New Punctuation CUV/CUNP;
- 2010 RCUV;
- modern or legacy CCB;
- YouVersion or other API text;
- eBible `cmn-cu89t`.

## 2. Usage rights and provenance

**Current evidence:** Provider and artifact are unknown. Territories,
repository/offline use, redistribution, TTS and attribution are unresolved.
Legacy art/source provenance does not grant scripture rights.

**Decision required:**

1. Confirm the authority granting use of the selected edition.
2. Approve or reject each intended scope:
   - storage in this private repository;
   - in-game text and subtitle display;
   - offline bundling;
   - public or private artifact redistribution;
   - permitted territories;
   - TTS and derived audio text usage;
   - required attribution wording.
3. Confirm the provenance chain from provider artifact to the exact bytes
   supplied for this plan.

**Evidence that must accompany the decision:**

- Rights status `approved` for every scope needed before implementation.
- Rights scope and exact attribution text.
- Rights approval record with trusted locator and SHA-256.
- Source artifact hash matching the bytes reviewed for rights.

Any pending, restricted or rejected required scope keeps the Gate closed. This
inventory records engineering evidence and is not legal advice.

TTS engine and voice-output redistribution rights are separate from scripture
text rights. They remain blocked until the chosen engine/voice terms and the
intended audio distribution scope are independently approved and evidenced.

## 3. Qualified reviewers and approval anchors

**Current evidence:** The trusted reviewer registry is empty; all 41 verse
slots are `unreviewed`. Disability and Jewish-group language reviews are both
applicable and required.

**Decision required:**

1. Nominate qualified reviewers with stable IDs, names and roles for:
   - exact text, verse boundaries and conformance to the fixed original 1919
     和合本 神版 identity;
   - rights scope, attribution and provenance;
   - disability portrayal and language;
   - Jewish-group terminology and contextual portrayal.
2. Confirm whether one qualified person may hold more than one role. Each role
   must still be explicit in the trusted registry.
3. Approve an evidence anchor covering every John 9:1-41 verse slot and the
   applicable sensitivity reviews.

**Evidence that must accompany the decision:**

- Trusted reviewer-registry record with locator and SHA-256.
- For each approval anchor:
  - declared reviewer ID;
  - status `approved`;
  - stable anchor/record ID;
  - repository-path or external-trust evidence locator;
  - SHA-256 of the reviewed evidence.
- An approved anchor for each verse slot. A batch review may cover multiple
  verses only when its stable evidence explicitly enumerates those verses.
- Separate approved records for source/edition, rights, disability review and
  Jewish-group language review, even if one reviewer fills multiple roles.

## Gate effect

Until all three decision groups have complete trusted evidence:

- `scripture.availability` remains `missing`;
- all `exactText` values remain null;
- S0/S1/S2/S3 ledger rows, event spine, Beats, dialogue and audio remain
  unpromoted;
- Gate state remains `blocked-text-unavailable`;
- runtime, map, art and audio reconstruction remain prohibited.
