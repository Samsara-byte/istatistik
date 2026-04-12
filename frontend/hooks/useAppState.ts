'use client';

import { useState, useCallback } from 'react';
import { type ModuleKey, MODULES } from '@/data/navigation';

export interface AppState {
  activeModule: ModuleKey;
  activePage: string;
  activeDistrict: string | null;
  activeDistrictName: string | null;
  villageByPage: Record<string, string>;
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    activeModule: 'dest',
    activePage: 'p-genel',
    activeDistrict: null,
    activeDistrictName: null,
    villageByPage: {},
  });

  const switchModule = useCallback((mod: ModuleKey) => {
    const module = MODULES.find(m => m.key === mod);
    if (!module) return;
    setState(prev => ({
      ...prev,
      activeModule: mod,
      activePage: module.firstPage,
    }));
  }, []);

  const switchPage = useCallback((pageId: string) => {
    setState(prev => ({ ...prev, activePage: pageId }));
  }, []);

  const pickDistrict = useCallback((id: string, name: string) => {
    setState(prev => ({ ...prev, activeDistrict: id, activeDistrictName: name }));
  }, []);

  const clearDistrict = useCallback(() => {
    setState(prev => ({ ...prev, activeDistrict: null, activeDistrictName: null }));
  }, []);

  const pickVillage = useCallback((pageId: string, village: string) => {
    setState(prev => ({
      ...prev,
      villageByPage: {
        ...prev.villageByPage,
        [pageId]: prev.villageByPage[pageId] === village ? '' : village,
      },
    }));
  }, []);

  return { state, switchModule, switchPage, pickDistrict, clearDistrict, pickVillage };
}
