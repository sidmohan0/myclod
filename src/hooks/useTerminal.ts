import { useEffect, useRef, useCallback } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'

interface UseTerminalOptions {
  onExit?: () => void
}

export function useTerminal(options: UseTerminalOptions = {}) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const unlistenOutputRef = useRef<UnlistenFn | null>(null)
  const unlistenExitRef = useRef<UnlistenFn | null>(null)

  // Initialize terminal
  const initTerminal = useCallback((container: HTMLDivElement) => {
    if (terminalRef.current) return

    containerRef.current = container

    const terminal = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#1a1a1a',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#3f3f46',
        black: '#27272a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.open(container)

    // Initial fit
    fitAddon.fit()

    // Handle user input
    terminal.onData(async (data) => {
      const result = await commands.sendInput(data)
      if (result.status === 'error') {
        logger.error('Failed to send input', { error: result.error })
      }
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    logger.info('Terminal initialized')
  }, [])

  // Spawn Claude in a directory
  const spawn = useCallback(async (cwd: string) => {
    if (!terminalRef.current) {
      logger.error('Terminal not initialized')
      return
    }

    // Clear terminal
    terminalRef.current.clear()

    // Set up event listeners for output
    unlistenOutputRef.current = await listen<string>('claude-output', (event) => {
      terminalRef.current?.write(event.payload)
    })

    unlistenExitRef.current = await listen('claude-exit', () => {
      logger.info('Claude session ended')
      options.onExit?.()
    })

    // Spawn Claude
    const result = await commands.spawnClaude(cwd)
    if (result.status === 'error') {
      logger.error('Failed to spawn Claude', { error: result.error })
      terminalRef.current.writeln(`\r\n\x1b[31mError: ${result.error}\x1b[0m\r\n`)
      return
    }

    // Send initial resize
    if (fitAddonRef.current) {
      const dims = fitAddonRef.current.proposeDimensions()
      if (dims) {
        await commands.resizeTerminal(dims.rows, dims.cols)
      }
    }

    logger.info('Claude spawned in', { cwd })
  }, [options])

  // Resize terminal
  const resize = useCallback(async () => {
    if (!fitAddonRef.current) return

    fitAddonRef.current.fit()
    const dims = fitAddonRef.current.proposeDimensions()
    if (dims) {
      const result = await commands.resizeTerminal(dims.rows, dims.cols)
      if (result.status === 'error') {
        logger.error('Failed to resize terminal', { error: result.error })
      }
    }
  }, [])

  // Kill session
  const kill = useCallback(async () => {
    const result = await commands.killSession()
    if (result.status === 'error') {
      logger.warn('Failed to kill session', { error: result.error })
    }
  }, [])

  // Focus terminal
  const focus = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      unlistenOutputRef.current?.()
      unlistenExitRef.current?.()
      terminalRef.current?.dispose()
      terminalRef.current = null
    }
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resize])

  return {
    initTerminal,
    spawn,
    resize,
    kill,
    focus,
  }
}
