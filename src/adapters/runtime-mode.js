export const GRAYBOX_SHELL_MODE = "graybox-shell";

export const GRAYBOX_STORY_STATUS = Object.freeze({
  mode: GRAYBOX_SHELL_MODE,
  wired: false,
  completed: false,
});

export class UnwiredPlatformOperationError extends Error {
  code = "PLATFORM_OPERATION_UNWIRED";

  /** @param {string} operation */
  constructor(operation) {
    super(
      `${operation} is unavailable in graybox-shell mode; bind the I5 story adapter first.`,
    );
    this.name = "UnwiredPlatformOperationError";
    this.operation = operation;
  }
}

/**
 * @param {string} operation
 * @returns {never}
 */
export function failUnwiredOperation(operation) {
  throw new UnwiredPlatformOperationError(operation);
}
