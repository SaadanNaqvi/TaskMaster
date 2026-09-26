import React, { createContext, ReactNode, useContext, useState } from 'react';
import { AnalysisResult } from '../models/analysis';

interface AnalysisContextValue {
  lastAnalysis: AnalysisResult | null;
  history: AnalysisResult[];
  setLastAnalysis: (result: AnalysisResult) => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  const setLastAnalysis = (result: AnalysisResult) => {
    setHistory((prev) => [result, ...prev].slice(0, 20));
  };

  return (
    <AnalysisContext.Provider value={{ lastAnalysis: history[0] ?? null, history, setLastAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysis must be used within AnalysisProvider');
  return ctx;
}
