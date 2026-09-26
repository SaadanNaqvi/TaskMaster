import { useEffect, useState } from 'react';
import { ApiExercise, getCategories, getExercisesInCategory } from './apiGateway';

let cachedPromise: Promise<ApiExercise[]> | null = null;

async function fetchAllExercises(): Promise<ApiExercise[]> {
  const categories = await getCategories();
  const perCategory = await Promise.all(categories.map((c) => getExercisesInCategory(c.id)));
  return perCategory.flat();
}

function loadExercises(force = false): Promise<ApiExercise[]> {
  if (force || !cachedPromise) {
    cachedPromise = fetchAllExercises();
  }
  return cachedPromise;
}

interface CatalogueState {
  exercises: ApiExercise[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Exercises the backend actually supports right now — fetched live, not hardcoded, so the UI
 * never advertises a lift the API can't process. */
export function useCatalogue(): CatalogueState {
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadExercises(attempt > 0)
      .then((list) => {
        if (!cancelled) setExercises(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load exercises');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setAttempt((a) => a + 1);
  };

  return { exercises, loading, error, reload };
}

export function findExerciseName(exercises: ApiExercise[], id: string | undefined): string {
  return exercises.find((e) => e.id === id)?.name ?? id ?? 'Exercise';
}
