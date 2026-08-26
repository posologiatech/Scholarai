import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { useResearchProject } from "@/hooks/useResearchProjects";

interface ActiveProjectContextType {
  activeProjectId: string | null;
  activeProjectTitle: string | null;
  setActiveProject: (id: string | null, title?: string | null) => void;
}

const ActiveProjectContext = createContext<ActiveProjectContextType | undefined>(undefined);

const ID_KEY = "scholar-active-project";
const TITLE_KEY = "scholar-active-project-title";

export const ActiveProjectProvider = ({ children }: { children: ReactNode }) => {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => localStorage.getItem(ID_KEY));
  const [cachedTitle, setCachedTitle] = useState<string | null>(() => localStorage.getItem(TITLE_KEY));

  // Keep the cached title fresh (e.g. if the project was renamed elsewhere).
  const { data: project, isError } = useResearchProject(activeProjectId ?? undefined);

  useEffect(() => {
    if (project?.title) {
      setCachedTitle(project.title);
      localStorage.setItem(TITLE_KEY, project.title);
    }
  }, [project?.title]);

  // Self-heal if the stored project no longer exists (deleted, or belongs to another account).
  useEffect(() => {
    if (activeProjectId && isError) {
      setActiveProjectId(null);
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TITLE_KEY);
      setCachedTitle(null);
    }
  }, [activeProjectId, isError]);

  const setActiveProject = useCallback((id: string | null, title?: string | null) => {
    setActiveProjectId(id);
    if (id) {
      localStorage.setItem(ID_KEY, id);
      if (title) {
        localStorage.setItem(TITLE_KEY, title);
        setCachedTitle(title);
      }
    } else {
      localStorage.removeItem(ID_KEY);
      localStorage.removeItem(TITLE_KEY);
      setCachedTitle(null);
    }
  }, []);

  const value = useMemo(
    () => ({ activeProjectId, activeProjectTitle: cachedTitle, setActiveProject }),
    [activeProjectId, cachedTitle, setActiveProject],
  );

  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
};

export const useActiveProject = () => {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error("useActiveProject must be used within ActiveProjectProvider");
  return ctx;
};
