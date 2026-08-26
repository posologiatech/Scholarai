import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface CommandPaletteContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export const CommandPaletteProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const value = useMemo(() => ({ open, setOpen }), [open, setOpen]);
  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
};

export const useCommandPalette = () => {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
};
