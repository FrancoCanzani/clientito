/**
 * Check if user traits match target criteria.
 * Simple key-value matching: all target keys must match user traits.
 */
export function matchesTraits(
  targetTraits: Record<string, unknown> | null,
  userTraits?: Record<string, unknown>
): boolean {
  if (!targetTraits) return true; // No targeting = show to everyone
  if (!userTraits) return false; // Has targeting but no user traits

  for (const [key, value] of Object.entries(targetTraits)) {
    if (Array.isArray(value)) {
      // Array = any-of match
      if (!value.includes(userTraits[key])) return false;
    } else {
      if (userTraits[key] !== value) return false;
    }
  }

  return true;
}
