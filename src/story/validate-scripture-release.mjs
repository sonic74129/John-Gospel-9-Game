import {
  loadScriptureContract,
  validateReleaseReadyScripture,
} from "./scripture.mjs";

const loaded = await loadScriptureContract();
if (!loaded.ok) {
  console.error(JSON.stringify(loaded, null, 2));
  process.exitCode = 1;
} else {
  const validation = await validateReleaseReadyScripture(
    loaded.scripture,
    loaded.rights,
    {
      trustedReviewerConfigSha256:
        process.env.SCRIPTURE_TRUSTED_REVIEWERS_SHA256,
    },
  );
  if (!validation.ok) {
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
  } else {
    console.log("John 9 scripture contract is release-ready.");
  }
}
