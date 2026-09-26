import { Exercise } from './exercise';

export type ReferenceCategory = 'Pros' | 'Friends' | 'My best';

export interface ReferenceOption {
  id: string;
  name: string;
  tagline: string;
  meta: string;
  category: ReferenceCategory;
  initials: string;
}

/**
 * Mock reference library — stand-in for a real backend catalog of professional / friend / personal-best
 * clips. No pose-comparison backend exists yet, so this seeds the reference-picker and results screens
 * with realistic demo content per exercise.
 */
const BASE: Record<Exercise, ReferenceOption[]> = {
  Squat: [
    { id: 'maya', name: 'Coach Maya R.', tagline: 'Powerlifting coach · high-bar', meta: '5 reps · 2.1s tempo', category: 'Pros', initials: 'MR' },
    { id: 'jordan', name: 'Jordan K.', tagline: 'Olympic lifter · ATG', meta: '3 reps · 1.6s tempo', category: 'Pros', initials: 'JK' },
    { id: 'sam', name: 'Sam (friend)', tagline: 'Shared from Sam · low-bar', meta: '4 reps · 2.4s tempo', category: 'Friends', initials: 'S' },
    { id: 'best', name: 'Your best set', tagline: '12 Sep · score 81', meta: '5 reps · 2.2s tempo', category: 'My best', initials: '★' },
  ],
  'Bench Press': [
    { id: 'maya', name: 'Coach Maya R.', tagline: 'Powerlifting coach · arch + tuck', meta: '5 reps · 1.8s tempo', category: 'Pros', initials: 'MR' },
    { id: 'priya', name: 'Priya N.', tagline: 'Raw bencher · wide grip', meta: '4 reps · 2.0s tempo', category: 'Pros', initials: 'PN' },
    { id: 'sam', name: 'Sam (friend)', tagline: 'Shared from Sam · close grip', meta: '3 reps · 2.2s tempo', category: 'Friends', initials: 'S' },
    { id: 'best', name: 'Your best set', tagline: '6 Sep · score 77', meta: '4 reps · 2.0s tempo', category: 'My best', initials: '★' },
  ],
  Deadlift: [
    { id: 'jordan', name: 'Jordan K.', tagline: 'Olympic lifter · conventional', meta: '3 reps · 1.9s tempo', category: 'Pros', initials: 'JK' },
    { id: 'maya', name: 'Coach Maya R.', tagline: 'Powerlifting coach · sumo', meta: '4 reps · 2.3s tempo', category: 'Pros', initials: 'MR' },
    { id: 'sam', name: 'Sam (friend)', tagline: 'Shared from Sam · conventional', meta: '3 reps · 2.5s tempo', category: 'Friends', initials: 'S' },
    { id: 'best', name: 'Your best set', tagline: '2 Sep · score 64', meta: '3 reps · 2.2s tempo', category: 'My best', initials: '★' },
  ],
  'Lat Pulldown': [
    { id: 'priya', name: 'Priya N.', tagline: 'Coach · wide grip', meta: '6 reps · 2.0s tempo', category: 'Pros', initials: 'PN' },
    { id: 'jordan', name: 'Jordan K.', tagline: 'Olympic lifter · close grip', meta: '5 reps · 1.8s tempo', category: 'Pros', initials: 'JK' },
    { id: 'sam', name: 'Sam (friend)', tagline: 'Shared from Sam · underhand', meta: '5 reps · 2.1s tempo', category: 'Friends', initials: 'S' },
  ],
};

export function referencesFor(exercise: Exercise): ReferenceOption[] {
  return BASE[exercise];
}

export function referenceCountFor(exercise: Exercise): number {
  return BASE[exercise].length;
}

export function findReference(exercise: Exercise, id: string | undefined): ReferenceOption {
  const list = BASE[exercise];
  return list.find((r) => r.id === id) ?? list[0];
}
