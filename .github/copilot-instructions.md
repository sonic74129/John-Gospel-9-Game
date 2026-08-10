# Bible story repository instructions

Before planning or changing gameplay, read:

1. `.foundation/docs/FOUNDATION_CHARTER.zh-CN.md`
2. `.foundation/docs/BIBLE_STORY_GAME_PLAYBOOK.zh-CN.md`
3. `.foundation/docs/MULTI_REPO_ARCHITECTURE.zh-CN.md`
4. `foundation.lock.json`
5. `src/story/story.config.json`

Treat `.foundation/` and `public/assets/vendor/` as generated, pinned inputs. Never edit them
manually. To change the Foundation version or shared asset packs, update `foundation.lock.json`,
run `npm run foundation:sync`, inspect the result, and run `npm test`.

Do not weaken scripture fidelity, player-role limits, map-based storytelling, normal/skip final-state
equivalence, art restrictions, provenance, hash, or independent-repository requirements.

Story scripture, beats, goals, coordinates, voice, portraits, special poses, maps, and local assets
belong in this repository. Never import source code or story state from another story repository.

Do not use Foundation `main`, `latest`, raw branch URLs, local absolute paths, or Git submodules.
Every Foundation input must remain pinned to the full commit in `foundation.lock.json`.

Candidate assets require explicit opt-in and cannot be described as stable or publicly
redistributable.

## Highest operational priority: preserve context continuity

Apply this execution policy before optimizing for speed or parallelism without weakening scripture,
Foundation, promotion, security, trust, quality, or delivery constraints.

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
