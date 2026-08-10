---
name: bible-story-game-builder
description: Use when creating, continuing, repairing, or evaluating an independent Bible story game's playable experience, including scripture-to-gameplay design, player role, beats/goals, explorable maps, normal/skip behavior, and final-art runtime integration; exclude Foundation-policy-only and SDK-maintenance-only work.
---

# Bible Story Game Builder

Use this workflow only for an independent story repository's playable experience. Foundation-policy-only
and SDK-maintenance-only work belong to their owning repositories.

## 1. Establish authority

- Read `foundation.lock.json`, resolve its pinned guidance, and verify the lock before designing or
  editing the game. Treat Foundation rules as a floor that local rules may tighten but never weaken.
- Find and complete the repository's canonical Planning Gate. Update that single source only; never
  create alternate plan, readiness, runtime, production-stage, or completion artifacts.
- In the Planning presentation contract, lock only the architecture-safe defaults:
  `map-visible-bottom-overlay`, speaker/subject actor binding, portraitless fallback, matching portrait
  identity/version, and bans on ordinary centered/full-screen static character cards and map-sprite,
  atlas-frame, or low-resolution-actor portrait substitutes.
- In Planning, give every Beat with a spatial transition a transition mode (`player-seeks`,
  `npc-arrives`, `npc-leads-player`, or reviewed `time-cut`), player control, actor path, entry/exit,
  and final convergence. Player position must come only from current player input.

<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_BEGIN -->
### Canonical context continuity policy

Policy version: 1.

- Emit a compact continuity record only at these events: a phase transition; a heavy, binary, or media
  boundary; before waiting for user input after heavy work; and checkpoint or continuation takeover.
  This is not a per-turn report and must not use token-percentage thresholds as a pre-send guard.
- Record exactly six fields: `objective`; `status`; `anchors` (repository, branch, commit);
  `decisions` (each labeled confirmed or hypothesis); `next_actions` (at most three, including
  validation); and `risks_blockers`.
- The coordinator must never directly receive screenshots, binary files, or base64. Inspect media in a
  bounded child or session and return only durable path, SHA-256, status, and findings.
- Treat token utilization and serialized request payload bytes as independent budgets. After heavy
  work, save a compact decision brief and checkpoint, then use a clean continuation before `ask_user`.
- After a request-size failure, do not retry from the poisoned session. Preserve checkpoint and
  continuation metadata, including the six fields, parent/child relationship, completed boundary,
  durable media references, and validation state; resume with a smaller batch in a clean continuation.
- Reuse the existing handoff/checkpoint. This policy does not create a story planning artifact,
  production stage, runtime manifest, readiness flag, or alternate plan schema.
<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_END -->

## 2. Ship the fastest playable slice

- Derive the full asset inventory first: maps/environments, character identities/directions/poses,
  portraits, props, UI, voice/audio/SFX, and every prompt/source/runtime/provenance/version/hash/manifest
  closure item. A blocker for one asset blocks only that asset.
- While implementing the playable slice, extend the asset inventory with every moving/turning actor's
  frame layout, four direction semantics,
  required idle/walk coverage, foot baseline, runtime frame keys, mirror policy, and unique
  `direction -> frame -> flipX` mapping. Give every independent group member separate runtime art/animation.
  This late-contract closure must not delay coding the slice.
- Establish only the minimum map, identity, scale, camera, and text contracts required to make the first
  formal assets usable. Do not require a whole-story graybox before formal production.
- Define in one sentence what the player repeatedly does and why it helps them witness the passage.
- Extend the story's existing engine and stack. Do not migrate engines or adopt a large framework to
  deliver story content.
- Implement new behavior story-locally. Extract a shared abstraction only after another story proves
  real reuse; do not generalize in advance.
- Build and play one end-to-end vertical slice before expanding every Beat. It must prove the real-input
  loop:
  `start -> move -> reachable goal -> observe/interact -> scripture-backed map event -> next goal/end`.
  Do not substitute autoplay, a debug jump, dialogue-only advancement, or a test-only shortcut.
- The presentation contract prevents architecture rework, but detailed ratios, screenshots, and exception
  evidence do not block implementation. After the minimum Gate, immediately ship the playable slice and
  close those details automatically before browser QA and completion without creating a user approval queue.
- Treat save persistence, Tiled/multi-map architecture, combat, inventory, branching outcomes, and
  generalized editors as deferred non-goals. Add one only when the approved story requires it and
  Foundation permits it; deterministic restart is sufficient for a short story.

## 3. Bound scripture and player agency

- Classify visible words, actions, and events as sourced scripture, a bounded scenario assumption, or
  fiction. Cite sourced material; keep assumptions minimal, explicit, and outcome-neutral; never present
  fiction as scripture or use it to add motives, doctrine, miracles, or outcomes.
- Make the player a witness who may move, observe, interact, follow, or relay what was already entrusted.
  The player never controls Jesus, causes a miracle, makes a key scriptural decision, or changes the
  passage's outcome.

## 4. Build one deterministic world sequence

- Complete, process, and wire the first formal asset baseline before expanding gameplay validation. Give
  every Beat/Stage an independent development-only entry or fixture; exclude these paths from production.
- Prefer a continuous, readable map. Validate walkability, collision, actor foot anchors, interaction
  reach, camera framing, and foreground occlusion with actual player movement.
- Use explicit interaction input for intentional actions; reserve proximity or arrival triggers for
  events that should begin when the player approaches or enters. Keep those trigger semantics distinct.
- During implementation, validate path and sequence references in both directions. Reject orphan narrative
  paths and any visible toggle without an existing position, credible entry, offscreen origin, or real path.
- During runtime integration, fail closed on a missing frame, unknown direction, undeclared mirror, multiple
  direction mappings, or group-wide texture substitution for an independent member. A horizontal mirror is
  allowed only when the manifest declares it and browser evidence verifies its visual direction.
- Execute ordered choreography from the declared steps and preserve participant order, entry source, path,
  end anchor, and continuous normal convergence in behavior evidence.
- A fixed-point click creates one path to that fixed position and never tracks an actor; directional input
  cancels it immediately, and Space never starts distant navigation.
- Let scripted sequences temporarily own actor control, then release it. Make each Beat own one canonical
  final state: normal completion and skip apply that same state rather than inheriting animation residue;
  restart and re-entry reconstruct it deterministically. Normal choreography reaches that authoritative
  final state through visible movement or a reviewed time-cut; only skip, restore, and re-entry may
  converge directly.
- During implementation, keep desktop map visibility at 70% or more with overlay height at 30% or less,
  mobile map visibility at 50% or more, and map/actor motion visible during blocking dialogue.
- DEV Beat jump/checkpoint may restore a test start, but keep it isolated from production normal play,
  formal completion evidence, and the production bundle.

## 5. Close the final-art loop

- Store stable prompt inputs outside chat context: asset ID, provider/model/version, seed, dimensions,
  dependencies, acceptance, and for revisions `Revision target`, `Change only`, `Keep unchanged`, and
  measurable `Acceptance`.
- Generate exactly one first-pass output per asset. Automatically inspect it, process source to runtime,
  wire it into the real game, and validate it; do not stop at contact sheets, candidate selection, or
  generated-but-unwired files. Multiple candidates require an explicit exception.
- Preserve contracts, tests, development-only overlays, prior versions, and hashes as rollback evidence.
  On failure, version and regenerate only the affected asset; resume skips assets already closed.
- Integrate final four-direction characters, identity-matched portraits, foreground occlusion, and
  runtime assets calibrated to the preserved anchors, collision, navigation, camera, and routes. Use
  mobile-conscious texture sizes and rerun spatial checks with the final pixels.
- Enforce the formal-art portrait contract: each portrait is a chest-up, dedicated story portrait runtime
  asset referencing the map actor's identity/version. Never use a map sprite, atlas frame, or upscaled
  low-resolution map actor as portrait UI.
- Preserve identity continuity across every state of the same character. Use sourced state changes for
  strong story changes while retaining head/chest crop, eye-line, and subject-scale semantics; never use
  random offset/scale changes to manufacture variation.
- Resolve framing only through the baseline and character-type profile contract. Reject component-, Beat-,
  or dialogue-local hardcoded adjustments that substitute for that contract.
- Close every shipped asset's source, rights, version, runtime mapping, provenance, and hash. If final art
  breaks a contract, repair only the affected contract or asset and resume final integration.
- If the user is sleeping, away, or otherwise unavailable, continue every task that does not require a
  genuinely restricted user decision. Use resumable checkpoints, not a fixed nightly schedule.

## 6. Prove completion

- Exercise normal, all-skip, and restart/re-entry paths with keyboard, pointer, and touch on desktop and
  mobile layouts. Prove every goal is reachable and add anti-stuck recovery without bypassing story
  order.
- In browser QA, measure desktop map visibility at 70% or more with overlay height at 30% or less, and
  mobile map visibility at 50% or more. During blocking dialogue, verify the map and actor motion remain
  visible, speaker/subject binding is correct, and actorless scripture/narration uses a portraitless panel.
- Capture browser screenshots for those measurements. Any layout/ratio exception must record the affected
  Beat, reason, designated reviewer, alternative map-continuity plan, and executable evidence before the
  affected Beat passes QA; use the existing contract, not a new user approval queue.
- In browser QA, enumerate every character/state on desktop and mobile; prove baseline/profile resolution,
  identity continuity, stable crop/eye-line/subject scale, sourced state semantics, and fail-closed handling
  for an unknown or incomplete `portraitState`.
- In browser QA, prove the player does not move without current input, NPC coordinates remain continuous,
  no actor appears without a spatial source in the current viewport, and normal completion has no visible
  final-state delta.
- In browser QA, exercise up/down/left/right for every actor and capture actor/spawn ID, movement vector,
  runtime frame key, flipX, and screenshot. Keys, source mappings, and final coordinates alone are not
  visual evidence. Replay multi-actor Beats to prove ordered steps, no pop-in, and continuous convergence.
- Once gameplay is stable, perform concentrated code review and refactoring; polish non-blocking details
  last. Fix immediate safety, data-corruption, and runtime blockers as soon as discovered.
- Inspect the production bundle: remove graybox, placeholder, debug, candidate, review, production-source,
  secret, and internal-stage residue.
- Require art and provenance closure, passing repository gates, and an immutable release whose locked
  inputs and artifact hashes can be reproduced. If any condition is open, report the truthful remaining
  work or release blocker in the existing handoff instead of claiming completion or adding a status field.
- Before completion, require formal map/character/audio assets to be integrated and real-input verified
  with exact versions, SHA-256, provenance, and story-repository independence.
- For the completion declaration, do not claim completion unless browser evidence proves the presentation
  ratios and map continuity, every shipped portrait has the dedicated role and matching identity/version,
  and no ordinary scripture/dialogue uses centered or full-screen static character art.
- For the completion declaration, require the portrait framing baseline/profile/state matrix and prove the
  production runtime contains no scattered framing tweaks or random framing variation.
- For the completion declaration, require the complete directional evidence matrix, independent-member
  inventory, ordered-choreography behavior evidence, and proof that no undeclared mirror or group-wide
  texture substitution entered production.
- For the completion declaration, never use a DEV jump as the only end-to-end evidence, and prove no DEV
  Beat jump/checkpoint is included in production normal play or the production bundle.
