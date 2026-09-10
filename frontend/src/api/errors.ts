export function normalizeError(err: any): any {
  if (err && typeof err === 'object') {
    if ('error' in err) return err;
    if (typeof err.message === 'string') {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          Object.assign(err, parsed);
          return err;
        }
      } catch {}
    }
  }
  return err;
}
