export function markReviewed(registry, ccCode, entryId) {
  if (!ccCode) return;
  registry[ccCode] = entryId;
}

export function isReviewed(registry, ccCode) {
  return Boolean(registry && registry[ccCode]);
}

export function entryFor(registry, ccCode) {
  return registry ? registry[ccCode] || null : null;
}

export function clearReviewed(registry, ccCode) {
  if (registry && ccCode in registry) delete registry[ccCode];
}
