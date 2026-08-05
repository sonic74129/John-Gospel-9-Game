# John 9 consumer evidence inventory

This document inventories evidence for the canonical blocked plan. It does not
authorize implementation, Promotion, runtime manifests, map reconstruction,
art production, audio production, or a Foundation/vendor change.

## Repository and lineage

- Repository: `sonic74129/John-Gospel-9-Game`.
- Default branch: `main` at
  `6a510714814938fc27b501a76d14106af6e9d5b6`.
- Default `main` contains only `README.md`
  (`51509cea1d145ea3f7c7890504fd035672b29860520f6f2d3d52d99678c33824`),
  whose description establishes a John 9 dialogue, investigation, reasoning
  and conflict story.
- GitHub reported no open, closed or merged PR records for this repository.
  The relevant work survives as remote branch and merge-commit history.
- Latest comprehensive remote evidence tip:
  `origin/sonic74129-sync-foundation` at
  `e7074459c6444eceebd58dfa89c4dccb5cfb5b1b`
  (`2026-08-03T08:26:32+08:00`, `fix: align formal art provenance`).

Relevant remote tips and their role:

| Remote branch | Tip | Evidence role |
| --- | --- | --- |
| `sonic74129-build-john9-world-graybox` | `472fc9ba994dc7d2f59d8531c243f28bd79c12d8` | World topology, anchors, routes, collision and camera baseline |
| `sonic74129-model-john9-narrative` | `dea3c9850124e109d0d022a1d5003e8a3afad5f3` | Independent narrative model; integrated through merge parent `27ff6eff...` |
| `sonic74129-build-scripture-contract` | `e1983ce5ce52b1dce8ac65641288dcfc3b229ae2` | Fail-closed scripture, rights and reviewer evidence |
| `sonic74129-integrate-story-platform` | `fb4fcf85220b42cbe5ea8e28f5ab667c91db614e` | Old platform boundary and integration tests |
| `sonic74129-build-john-9-slice` | `110eeb05e6499cb3b18a734872a107a9100703f6` | B01-B07 observable vertical-slice behavior |
| `sonic74129-complete-john-9-story` | `a914d3aec467dd3adf974113ec2389acf0524ad2` | B01-B19 behavior, persistence and completion |
| `sonic74129-fix-arrival-navigation` | `05a9abebd647cf8711f9720935bab5117ed01e4e` | Traversal-aware trigger and objective fixes |
| `sonic74129-redesign-john9-world` | `ff4a565ba71a238ec9fc2ea3803af20810357a93` | Two-dimensional zig-zag world and responsive framing |
| `sonic74129-produce-john-9-art` | `6b676b319384297e13cf3fee4f668f5c77a5a544` | Generated private-preview art evidence |
| `sonic74129-finish-john-9-formal-art` | `8242927390e440d2255a30f726a356368cccfdde` | Remote formal-art checkpoint |
| `sonic74129-sync-foundation` | `e7074459c6444eceebd58dfa89c4dccb5cfb5b1b` | Most complete evidence lineage and pinned Foundation input |

The primary lineage merges the world branch, narrative parent
`27ff6eff8e5a7524e0120d73f7ce0dfa771df3e7`, and scripture branch before the
slice, completion, navigation, world redesign and formal-art work. The
independent branch tips are evidence sources, not an instruction to restore
their architecture.

## External contracts

- Pinned Foundation lock found at the comprehensive legacy tip:
  `foundation.lock.json`
  (`84894d020a2ee1723bd95d5cae561d6d00365c03baa7b65883a5723919408c20`),
  Foundation repository `sonic74129/bible-game-foundation`, commit
  `6c836d55bfd786b8a55b4e0c7356bf8791505653`.
- Pinned repository instructions:
  `.github/copilot-instructions.md`
  (`8ec328bd4cf506bd213253c9d4bdf76344bb042f750b5b5b915677383f941b08`).
- The lock allows candidate assets and names
  `identity-jesus-storybook@0.1.0` and
  `nt-judea-first-century@0.1.0`; candidate status is not release approval.
- Default `main` does not materialize this lock or generated guidance. They
  must be restored only through a trusted Foundation sync, not copied or
  hand-edited during planning.
- That Foundation tree has 33 blobs and no planning policy artifact. In
  particular, `.foundation/policy/story-planning-policy.v1.json` is absent.
- Pinned Foundation guidance hashes used by the plan:
  - Charter: `9a8990230d4d662044d1a09bddb07cea0ff28b84ff67dce393d38a78f9ef1faa`
  - Playbook: `f363b37ac1f6bab765af91deef2174803c6f3c102324e1c1c5b4d77026b34b03`
  - Multi-repo architecture: `86f400f99c5106465c4091ada543b24c93fbbaf61578b9411b5c8110ff7f56ca`
  - Rights/provenance: `56910ac1ca7a9e551079d27b9f980ca818598b7ec726881ed09a66ed33dfea54`
  - End-to-end policy: `8a67e66354ddba3d005fac842e163dc69cd051f31bef9ffc7441ca38d447222d`
- Merged template contract:
  `sonic74129/bible-story-template@100bb7977ec2b59a06311fc0b50288d41e3d8a37`
  (`Integrate planning gate and story promotion (#2)`).
  Its canonical starter hash is
  `55b213008d447b0e9daeab7df208d68c80ca5fc88dcf65c8c5c680bdd8fbfa34`.
- SDK contract:
  `sonic74129/bible-game-sdk@20f643185c2521a6d9a45c3e7ed3a391fb189d6e`
  (`v0.3.0`), planning source hash
  `34743bb485a8d5c599b63542701f823ebeae8d762e6458ebc63ba55100b4d883`.
- SDK 0.3.0 defines Planning Gate and transactional Promotion. Its trusted
  outputs stop at a promoted `internal-graybox` preimage; it supplies no
  trusted post-Promotion production-stage transition contract. No stage
  transition is attempted here.

## Scripture source, rights and reviewers

Evidence at `e7074459...`:

| File | SHA-256 | Finding |
| --- | --- | --- |
| `src/story/scripture.json` | `e27291e2f555698b2437c97664b7c60b70ecc3555ef16ad8bc10bb2e8f757112` | John 9:1-41 slots exist, but all 41 exact texts are null and pending |
| `src/story/scripture-rights.json` | `f20b54be33e6f5973fdd48f09e47c4923da6448d5e4b8086366d24aaeb9e0e6d` | Provider/artifact unavailable; edition and 神/上帝 variant unresolved; territories, redistribution, offline and TTS rights unknown |
| `src/story/scripture-trusted-reviewers.json` | `9011c1d152744081c46cb36ec87fad64709e19e06ea1b02c766804d17a175a4e` | Reviewer registry is empty |
| `src/story/story.config.json` | `fc3fd2ddba0b2c54a28ed341a5ae311235fc158be7c9885c16d8856f708ececc` | Legacy identity is John 9:1-41, zh-Hant, CUV-Traditional, unnamed observer |

No authorized scripture artifact, rights approval locator, trusted reviewer,
or per-verse review anchor exists. The canonical plan therefore uses
`availability: "missing"`, preserves 41 null verse slots, and contains no S0
text, dialogue text, or audio hash.

The user has since fixed the canonical translation identity to the original
1919 Traditional Chinese Union Version (和合本), 神版 for John 9 and future
stories. This supersedes the legacy file's unresolved 神/上帝 choice but does
not supply source bytes or authorization. The 1988 New Punctuation CUV/CUNP,
2010 RCUV, modern/legacy CCB, YouVersion/API text and eBible `cmn-cu89t` are
rejected as substitutions without separate authorization.

## S0/S1/S2/S3 evidence ledger

The pinned Playbook defines:

- S0: exact authorized translation text.
- S1: facts, actions, locations, order and relationships explicit in scripture.
- S2: minimal removable game bridges that change no cause, identity, order or
  outcome and are marked as bridges.
- S3: dramatized motive/theology, extra miracles or invented outcomes;
  prohibited.

Classification for the consumer phase:

| Layer | Legacy candidate evidence | Decision | Canonical-plan treatment |
| --- | --- | --- | --- |
| S0 | Forty-one verse keys with null text | Keep slots; discard any success-shaped scripture presentation | No ledger rows until an authorized artifact and exact text exist |
| S1 | Nineteen verse-grouped events, actors, testimony and fixed outcome | Adapt after exact-text and trusted review | Not inserted because SDK 0.3.0 accepts event/Beat references only to authorized non-null verses |
| S2 | Unnamed observer, short goals, three optional recalls, five neutral staging regions and nine routes | Adapt after policy and sensitivity review | Not inserted because there is no pinned source-level policy or trusted bridge reviewer |
| S3 | Player-caused miracle, controlling Jesus, altered outcomes, punitive faith scoring, invented motive/theology | Discard/prohibit | Cannot be canonically encoded until the missing policy publishes exact prohibited rule IDs and text |

This omission is deliberate fail-closed behavior, not missing analysis.

## Story and gameplay evidence

Legacy story hashes at `e7074459...`:

- Beats `53e78a131c2392a8e4ad7fef728a97209bf40246f02d742c8cd0fbe0e86803cf`
- Actors `3491a36ed1bacd3f07aa00cfef578f9593fd81fccf494745d94474a4bb1aaf9c`
- Sequences `4f1a19c63f32e03704d5211d1ec1152f0de987cfa88e4895f463015624952b70`
- Goals `397faa6ad8ab28b361b75af0910e0bffb307cfdbbcbcebb4823dfc767f789381`
- Recall `67211fb71e7ee85b182cfb2ba9f33d6508ba5ef7850af78de1fbd137a07a680b`
- Dialogue index `dd1aaed4df01a67d4fd389371911f040dc750b1451eaf7799a95e9bf0ef756fa`
- Completion `0ad07b1b3aaa6d57a4a7379f89f8b6a521d025abfeb579cd8e40fb6621f1bfe0`

Candidate event spine to adapt after authorization:

1. Encounter while passing by (9:1).
2. Disciples' question (9:2).
3. Jesus' answer and light/works teaching (9:3-5).
4. Clay action and instruction (9:6-7).
5. Washing at Siloam and return seeing (9:7).
6. Neighbor identity dispute (9:8-9).
7. First account and unknown whereabouts (9:10-12).
8. Brought for inquiry; Sabbath context (9:13-14).
9. Inquiry and disagreement (9:15-16).
10. The man's stated assessment (9:17).
11. Parents summoned (9:18-19).
12. Parents confirm identity but defer the explanation (9:20-23).
13. Second summons and demand (9:24).
14. The man's limited knowledge and known change (9:25).
15. Repeated questioning and answer (9:26-27).
16. Reviling and competing claims (9:28-29).
17. The man's argument and expulsion (9:30-34).
18. Jesus finds him; question, recognition, belief and worship (9:35-38).
19. Closing saying and response (9:39-41).

Player-role candidate: unnamed observer, not acknowledged by scripture
characters, no dialogue, no control of Jesus, no miracle causation, no answer
on behalf of characters and no mutable outcome. Candidate actions are move,
observe, listen, interact and non-punitive recall.

Legacy acceptance tests observed: unique ordered B01-B19; fixed normal/skip
snapshots; all-normal, all-skip and mixed playthrough order; cancellation
rollback; deterministic persistence/restart; generic player-facing errors;
three non-blocking scoreless recalls; accessible keyboard/pointer/mobile
objective behavior. Keep the behavioral intent; adapt its implementation to
future trusted contracts; discard SDK 0.1/runtime architecture as authority.

## World and map evidence

Legacy candidate hashes:

- Layout `894890abc921a350ae55a843b870a68f5ad6aada469fc294c645759ac7fc9144`
- Paths `74994f8fda336c076ce2ac57f8b6bb2003ad4bbbea02090a887600a4cf00788c`
- Camera `995bd79536136048af2253139afca753cfe55e2fc99891f0489b83a95909a7dd`
- Responsive framing `7e84549c37c3951b2eefa15a985886a86e21d14c41838cd6774e1c1fad413c62`

Candidate topology is a 2560x1792 continuous, three-quarter, north-south
zig-zag space with five ordered staging regions: roadside, Siloam Pool,
neighbor gathering, inquiry courtyard and outer road. Only Siloam is claimed
as scripture-named; all other exact names and placements are removable S2
staging. Nine candidate paths cover travel to Siloam, return, neighbor and
inquiry movement, parent entry/exit, expulsion, Jesus' entrance and ending
camera motion. Desktop 1280x720 and mobile 390x844 framing were tested.
The blocked schema shell records the legacy 32-pixel navigation grid, 72-pixel
agent height and 48-pixel anchor clearance. Because the outdoor candidate has
no door contract, the required positive `doorHeight` retains the merged
template starter's 160-pixel structural placeholder; it is not a John 9 fact
or production scale.

Decision: keep the evidence and responsive/finality requirements; adapt the
topology only after S1/S2 review; discard claims that this stylized composition
is a historical reconstruction. No map or runtime file is restored now.

## Assets and audio

Evidence:

- Candidate-pack review
  `c1a0680f81eb6c78caf4d1171147a493be9d3ba5f6ca50ed8135dd910a5d3f57`
  conditionally accepts two candidate packs for private evaluation only.
- Story-local art review
  `86410b4bccb05fea478c66d84c85cdabe6a7b034b410ea37ec1e708a384880ce`
  records seven selected MAI candidates, 25 runtime files, accepted private
  preview composition/scale/restraint, and no generated portraits.
- Art manifest
  `4430588c5c14289e3e9a54d07030f4fc83c8c9b128befb124612544f24a79386`
  records output hashes and baselines, but remains legacy runtime state.
- Both packs remain candidate, release ineligible, and not approved for public
  redistribution. Story-local generated art is private-preview only.
- Legacy game manifest reports `voice: false`; no authorized exact-text hash,
  TTS permission or production audio contract exists.

Decision: keep provenance and objective private-preview findings as evidence;
adapt only after policy, rights and post-Promotion stage contracts exist;
discard any claim that these assets are stable, publicly redistributable,
released, or currently wired. Do not restore assets or create audio.

## Minimal decisions and external dependencies

The user-owned subset is specified as a field-level checklist in
[`user-decisions.md`](user-decisions.md).

1. Supply the exact authorized original 1919 Traditional Chinese Union
   Version (和合本), 神版 John 9:1-41 source artifact, including provider,
   canonical artifact/edition/translation IDs, stable 41-verse boundaries,
   bytes/SHA-256 and trusted provenance locator. Translation and 神版 identity
   are already fixed and must not be asked again.
2. Supply approved rights evidence and scope for repository storage/display,
   offline use, redistribution territories, attribution and scripture-text
   TTS use. TTS engine/voice output redistribution requires separate approval.
3. Register trusted reviewers and approved evidence anchors for exact text,
   rights, disability portrayal and Jewish-group language.
4. Foundation must publish the planning policy artifact at a pinned commit;
   this story must then update/sync its lock through the trusted process.
5. Before any post-Promotion production-stage change, Foundation/SDK must
   provide the missing trusted stage-transition contract.

Until those dependencies are met, the Planning Gate is not ready and code
generation remains prohibited.

## Validation record

Default `main` has no `package.json`, project validator, test runner or local
Foundation closure to execute. No dependency, validator or workflow was added.

The artifact was parsed with the existing Node runtime and assessed directly
against the planning validator source from SDK 0.3.0 commit `20f64318...`.
The validator derived:

- Gate: `blocked-text-unavailable`
- Ready: false
- Code generation allowed: false
- Verse slots: 41
- Available exact texts: 0
- No `UNKNOWN_FIELD`, `GATE_STATE_MISMATCH`, `EXACT_TEXT_MISMATCH`,
  `FINALITY_MISMATCH`, `UNBOUND_STORY_CONTENT` or numeric-contract defect

Intentional findings remain: missing scripture, missing Foundation policy,
empty evidence-bound contracts, thirteen blocked acceptance areas, and
required disability/Jewish-group sensitivity reviews without trusted
reviewers. The latter sensitivity findings are preserved even though the
merged template's generic blocked-starter allowlist does not list them; hiding
applicability would weaken validation.
