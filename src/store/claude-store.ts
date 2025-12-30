import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ClaudeState {
  // Session state
  sessionActive: boolean
  currentFolder: string | null

  // UI state
  pendingAction: 'pending' | null // When Claude asks for permission

  // Actions
  setSessionActive: (active: boolean) => void
  setCurrentFolder: (folder: string | null) => void
  setPendingAction: (action: 'pending' | null) => void
  reset: () => void
}

const initialState = {
  sessionActive: false,
  currentFolder: null,
  pendingAction: null,
}

export const useClaudeStore = create<ClaudeState>()(
  devtools(
    set => ({
      ...initialState,

      setSessionActive: active =>
        set({ sessionActive: active }, undefined, 'setSessionActive'),

      setCurrentFolder: folder =>
        set({ currentFolder: folder }, undefined, 'setCurrentFolder'),

      setPendingAction: action =>
        set({ pendingAction: action }, undefined, 'setPendingAction'),

      reset: () => set(initialState, undefined, 'reset'),
    }),
    {
      name: 'claude-store',
    }
  )
)
