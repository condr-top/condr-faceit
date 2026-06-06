import { create } from 'zustand'

interface UiState {
  hideNav: boolean
  setHideNav: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  hideNav: false,
  setHideNav: (v) => set({ hideNav: v }),
}))
