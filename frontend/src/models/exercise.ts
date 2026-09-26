export type Exercise = 'Bench Press' | 'Squat' | 'Lat Pulldown' | 'Deadlift';

export const EXERCISES: Exercise[] = ['Bench Press', 'Squat', 'Lat Pulldown', 'Deadlift'];

/** Reminder shown on the record screen so every clip for an exercise is framed the same way. */
export function framingHint(exercise: Exercise): string {
  switch (exercise) {
    case 'Bench Press':
      return 'Side-on · bench parallel to camera · full bar path visible';
    case 'Squat':
      return 'Side-on · fixed distance · full body + bar in frame';
    case 'Lat Pulldown':
      return 'Side-on · seat and bar stack visible';
    case 'Deadlift':
      return 'Side-on · floor to lockout fully in frame';
  }
}
