"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findPersona, type Persona } from "@/lib/demo/personas";

const STORAGE_KEY = "promise:persona";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private windows can block storage. The choice then lasts for this visit only.
  }
}

interface PersonaValue {
  persona: Persona | null;
  /** false until the stored choice has been read, so screens do not flash the empty state */
  ready: boolean;
  select: (id: string) => void;
}

const PersonaContext = createContext<PersonaValue | null>(null);

/** Which demo account the app acts as. The choice is the only thing kept outside the chain. */
export function PersonaProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (findPersona(stored)) setId(stored);
    setReady(true);
  }, []);

  const select = useCallback((next: string) => {
    if (!findPersona(next)) return;
    setId(next);
    writeStored(next);
  }, []);

  const value = useMemo(() => ({ persona: findPersona(id), ready, select }), [id, ready, select]);
  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona(): PersonaValue {
  const value = useContext(PersonaContext);
  if (!value) throw new Error("usePersona must be used inside PersonaProvider");
  return value;
}
