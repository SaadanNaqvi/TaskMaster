/** Reminder shown on the record screen so every clip for an exercise is framed the same way.
 * Matched by substring against the backend's snake_case exercise id, with a generic fallback
 * for any exercise the API adds later. */
export function framingHint(exerciseId: string): string {
  const key = exerciseId.toLowerCase();
  if (key.includes('bench')) return 'Side-on · bench parallel to camera · full bar path visible';
  if (key.includes('squat')) return 'Side-on · fixed distance · full body + bar in frame';
  if (key.includes('lat') || key.includes('pulldown')) return 'Side-on · seat and bar stack visible';
  if (key.includes('dead')) return 'Side-on · floor to lockout fully in frame';
  return 'Side-on · fixed distance · full body in frame';
}
