import React, { createContext, ReactNode, useContext, useState } from 'react';
import { ApiJobResult } from '../services/apiGateway';

export interface JobSummary {
  jobId: string;
  exerciseId: string;
  exerciseName: string;
  referenceId: string;
  referenceName: string;
  createdAt: string;
  result: ApiJobResult;
}

interface AnalysisContextValue {
  lastJob: JobSummary | null;
  history: JobSummary[];
  addJob: (summary: JobSummary) => void;
  getJob: (jobId: string) => JobSummary | undefined;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<JobSummary[]>([]);

  const addJob = (summary: JobSummary) => {
    setHistory((prev) => [summary, ...prev.filter((j) => j.jobId !== summary.jobId)].slice(0, 30));
  };

  const getJob = (jobId: string) => history.find((j) => j.jobId === jobId);

  return (
    <AnalysisContext.Provider value={{ lastJob: history[0] ?? null, history, addJob, getJob }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
