import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  loadScriptureContract,
  validateReleaseReadyScripture,
} from "./scripture.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const reviewerRoot = new URL("./", import.meta.url);

function sanitizeErrors(errors, { preserveMessages = false } = {}) {
  if (!Array.isArray(errors)) {
    return [
      {
        field: "validation",
        code: "INVALID_ERROR_RESULT",
        message: "validation failed without structured errors",
      },
    ];
  }

  return errors.map((error) => {
    const field =
      typeof error?.field === "string" &&
      /^[A-Za-z0-9_.[\]-]+$/.test(error.field)
        ? error.field
        : "validation";
    const code =
      typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : undefined;
    const message =
      preserveMessages && typeof error?.message === "string"
        ? error.message
        : "validation failed";

    return {
      field,
      ...(code === undefined ? {} : { code }),
      message,
    };
  });
}

function writeFailure(stream, errors, options) {
  stream.write(
    `${JSON.stringify(
      { ok: false, errors: sanitizeErrors(errors, options) },
      null,
      2,
    )}\n`,
  );
}

export async function runScriptureReleaseCli({
  loadOptions,
  validationOptions = {},
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const loaded = await loadScriptureContract(loadOptions);
  if (!loaded.ok) {
    writeFailure(stderr, loaded.errors, { preserveMessages: true });
    return 1;
  }

  const validation = await validateReleaseReadyScripture(
    loaded.scripture,
    loaded.rights,
    {
      artifactRoot: repositoryRoot,
      evidenceRoot: repositoryRoot,
      reviewerRoot,
      ...validationOptions,
      trustedReviewerConfigSha256:
        validationOptions.trustedReviewerConfigSha256 ??
        env.SCRIPTURE_TRUSTED_REVIEWERS_SHA256,
    },
  );
  if (!validation.ok) {
    writeFailure(stderr, validation.errors);
    return 1;
  }

  stdout.write("John 9 scripture contract is release-ready.\n");
  return 0;
}

const invokedUrl =
  process.argv[1] === undefined
    ? null
    : pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedUrl === import.meta.url) {
  process.exitCode = await runScriptureReleaseCli();
}
