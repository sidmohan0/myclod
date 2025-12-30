import { useEffect, useRef, useCallback } from 'react'
import { useTerminal } from '@/hooks/useTerminal'
import { useClaudeStore } from '@/store/claude-store'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  cwd: string
  onExit?: () => void
}

export function Terminal({ cwd, onExit }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hasSpawned = useRef(false)

  const setSessionActive = useClaudeStore((state) => state.setSessionActive)

  const handleExit = useCallback(() => {
    setSessionActive(false)
    onExit?.()
  }, [setSessionActive, onExit])

  const { initTerminal, spawn, resize, focus } = useTerminal({
    onExit: handleExit,
  })

  // Initialize terminal when container is ready
  useEffect(() => {
    if (!containerRef.current) return
    initTerminal(containerRef.current)
  }, [initTerminal])

  // Spawn Claude when cwd changes
  useEffect(() => {
    if (!cwd || hasSpawned.current) return

    const startSession = async () => {
      hasSpawned.current = true
      setSessionActive(true)
      await spawn(cwd)
    }

    // Small delay to ensure terminal is fully initialized
    const timer = setTimeout(startSession, 100)
    return () => clearTimeout(timer)
  }, [cwd, spawn, setSessionActive])

  // Handle resize with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(() => {
      resize()
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [resize])

  // Focus terminal on click
  const handleClick = useCallback(() => {
    focus()
  }, [focus])

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#1a1a1a] p-2"
      onClick={handleClick}
    />
  )
}
