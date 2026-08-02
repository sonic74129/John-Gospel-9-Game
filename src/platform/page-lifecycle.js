/**
 * @typedef {{
 *   readonly suspend: () => void | Promise<void>,
 *   readonly resume: () => void | Promise<void>,
 *   readonly dispose: () => void | Promise<void>
 * }} PageLifecycleOperations
 */

/** @param {PageLifecycleOperations} operations */
export function createPageLifecycleController(operations) {
  let cacheSuspended = false;
  let disposed = false;

  return Object.freeze({
    get disposed() {
      return disposed;
    },
    get cacheSuspended() {
      return cacheSuspended;
    },
    /** @param {boolean} persisted */
    async handlePageHide(persisted) {
      if (disposed) {
        return;
      }
      if (persisted) {
        if (!cacheSuspended) {
          cacheSuspended = true;
          await operations.suspend();
        }
        return;
      }
      disposed = true;
      cacheSuspended = false;
      await operations.dispose();
    },
    /** @param {boolean} persisted */
    async handlePageShow(persisted) {
      if (!persisted || disposed || !cacheSuspended) {
        return;
      }
      cacheSuspended = false;
      await operations.resume();
    },
  });
}
