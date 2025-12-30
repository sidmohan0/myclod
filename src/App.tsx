import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { initializeCommandSystem } from './lib/commands'
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu'
import { initializeLanguage } from './i18n/language-init'
import { logger } from './lib/logger'
import { cleanupOldFiles } from './lib/recovery'
import { commands } from './lib/tauri-bindings'
import './App.css'
import { SetupFlow } from './components/setup'
import { Terminal, FolderPicker, ActionBar } from './components/terminal'
import { TooltipProvider } from './components/ui/tooltip'
import { ThemeProvider } from './components/ThemeProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TitleBar } from './components/titlebar'
import { CommandPalette } from './components/command-palette'
import { PreferencesDialog } from './components/preferences'
import { Toaster } from './components/ui/sonner'

type AppState = 'setup' | 'folder-picker' | 'terminal'

function App() {
  const [appState, setAppState] = useState<AppState>('setup')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 myclod starting up')
    initializeCommandSystem()
    logger.debug('Command system initialized')

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        // Load preferences to get saved language
        const result = await commands.loadPreferences()
        const savedLanguage =
          result.status === 'ok' ? result.data.language : null

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage)

        // Build the application menu with the initialized language
        await buildAppMenu()
        logger.debug('Application menu built')
        setupMenuLanguageListener()
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error })
      }
    }

    initLanguageAndMenu()

    // Clean up old recovery files on startup
    cleanupOldFiles().catch(error => {
      logger.warn('Failed to cleanup old recovery files', { error })
    })

    // Example of logging with context
    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    })

    // Auto-updater logic - check for updates 5 seconds after app loads
    const checkForUpdates = async () => {
      try {
        const update = await check()
        if (update) {
          logger.info(`Update available: ${update.version}`)

          // Show confirmation dialog
          const shouldUpdate = confirm(
            `Update available: ${update.version}\n\nWould you like to install this update now?`
          )

          if (shouldUpdate) {
            try {
              // Download and install with progress logging
              await update.downloadAndInstall(event => {
                switch (event.event) {
                  case 'Started':
                    logger.info(`Downloading ${event.data.contentLength} bytes`)
                    break
                  case 'Progress':
                    logger.info(`Downloaded: ${event.data.chunkLength} bytes`)
                    break
                  case 'Finished':
                    logger.info('Download complete, installing...')
                    break
                }
              })

              // Ask if user wants to restart now
              const shouldRestart = confirm(
                'Update completed successfully!\n\nWould you like to restart the app now to use the new version?'
              )

              if (shouldRestart) {
                await relaunch()
              }
            } catch (updateError) {
              logger.error(`Update installation failed: ${String(updateError)}`)
              alert(
                `Update failed: There was a problem with the automatic download.\n\n${String(updateError)}`
              )
            }
          }
        }
      } catch (checkError) {
        logger.error(`Update check failed: ${String(checkError)}`)
        // Silent fail for update checks - don't bother user with network issues
      }
    }

    // Check for updates 5 seconds after app loads
    const updateTimer = setTimeout(checkForUpdates, 5000)
    return () => clearTimeout(updateTimer)
  }, [])

  const handleSetupComplete = () => {
    logger.info('Setup complete, showing folder picker')
    setAppState('folder-picker')
  }

  const handleFolderSelected = (path: string) => {
    logger.info('Folder selected, launching terminal', { path })
    setSelectedFolder(path)
    setAppState('terminal')
  }

  const handleSessionExit = () => {
    logger.info('Session ended, returning to folder picker')
    setSelectedFolder(null)
    setAppState('folder-picker')
  }

  const renderContent = () => {
    switch (appState) {
      case 'setup':
        return <SetupFlow onComplete={handleSetupComplete} />
      case 'folder-picker':
        return (
          <div className="flex h-screen flex-col">
            <TitleBar />
            <main className="flex-1">
              <FolderPicker onFolderSelected={handleFolderSelected} />
            </main>
          </div>
        )
      case 'terminal':
        return (
          <div className="flex h-screen flex-col">
            <TitleBar />
            <main className="flex-1 overflow-hidden">
              {selectedFolder && (
                <Terminal cwd={selectedFolder} onExit={handleSessionExit} />
              )}
            </main>
            {selectedFolder && (
              <ActionBar
                currentFolder={selectedFolder}
                onChangeFolder={handleSessionExit}
              />
            )}
          </div>
        )
    }
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider>
          {renderContent()}
          <CommandPalette />
          <PreferencesDialog />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
