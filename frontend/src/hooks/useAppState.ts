import { useState, useCallback, useEffect } from "react";
import { type ModuleKey, MODULES } from "@/data/navigation";

export interface AppState {
  activeModule: ModuleKey;
  activePage: string;
  activeDistrict: string | null;
  activeDistrictName: string | null;
  villageByPage: Record<string, string>;
}

const INITIAL: AppState = {
  activeModule: "dest",
  activePage: "p-genel",
  activeDistrict: null,
  activeDistrictName: null,
  villageByPage: {},
};

function loadState(): AppState {
  try {
    const raw = sessionStorage.getItem("app-state");
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...INITIAL, ...parsed, villageByPage: {} };
  } catch {
    return INITIAL;
  }
}

function saveState(s: AppState) {
  try {
    sessionStorage.setItem("app-state", JSON.stringify({
      activeModule: s.activeModule,
      activePage: s.activePage,
    }));
  } catch { /* ignore */ }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const switchModule = useCallback((mod: ModuleKey) => {
    const module = MODULES.find(m => m.key === mod);
    if (!module) return;
    setState(prev => ({ ...prev, activeModule: mod, activePage: module.firstPage }));
  }, []);

  const switchPage = useCallback((pageId: string) => {
    setState(prev => ({ ...prev, activePage: pageId }));
  }, []);

  const pickDistrict = useCallback((id: string, name: string) => {
    setState(prev => ({
      ...prev,
      activeDistrict: id || null,
      activeDistrictName: name || null,
    }));
  }, []);

  const pickVillage = useCallback((pageId: string, village: string) => {
    setState(prev => ({
      ...prev,
      villageByPage: {
        ...prev.villageByPage,
        [pageId]: prev.villageByPage[pageId] === village ? "" : village,
      },
    }));
  }, []);

  return { state, switchModule, switchPage, pickDistrict, pickVillage };
}
