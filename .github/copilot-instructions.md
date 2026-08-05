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
