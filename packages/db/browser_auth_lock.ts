/**
 * In-process auth lock for browser Supabase clients.
 *
 * Supabase defaults to `navigator.locks` with `ifAvailable: true` for auto-refresh,
 * which throws NavigatorLockAcquireTimeoutError when init and refresh overlap
 * (e.g. on tab visibility change). This queue serializes auth ops in-tab without
 * LockManager. Cross-tab refresh races are resolved server-side by GoTrue.
 */
type AuthLockFunc = <R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>
) => Promise<R>;

const tails = new Map<string, Promise<unknown>>();

export const inMemoryAuthLock: AuthLockFunc = async (name, _acquireTimeout, fn) => {
  const prior = tails.get(name) ?? Promise.resolve();
  const current = prior
    .catch(() => undefined)
    .then(fn);

  tails.set(
    name,
    current.then(
      () => undefined,
      () => undefined
    )
  );

  return current;
};
