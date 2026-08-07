export class UnsupportedPlatformOperationError extends Error {
  code = "PLATFORM_OPERATION_UNSUPPORTED";

  /**
   * @param {string} operation
   */
  constructor(operation) {
    super(`${operation} is not supported by this story runtime.`);
    this.name = "UnsupportedPlatformOperationError";
    this.operation = operation;
  }
}

/**
 * @param {string} operation
 * @returns {never}
 */
export function failUnsupportedOperation(operation) {
  throw new UnsupportedPlatformOperationError(operation);
}
