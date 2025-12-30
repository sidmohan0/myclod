import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Loader2 } from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useInstallClaudeCode } from '@/services/dependencies'

interface ClaudeCheckProps {
  onRecheck: () => void
}

export function ClaudeCheck({ onRecheck }: ClaudeCheckProps) {
  const { t } = useTranslation()
  const [log, setLog] = useState('')
  const installMutation = useInstallClaudeCode()

  // Listen for install progress
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      unlisten = await listen<string>('install-progress', event => {
        setLog(prev => prev + event.payload + '\n')
      })
    }

    setup()
    return () => unlisten?.()
  }, [])

  const handleInstall = async () => {
    setLog('')
    await installMutation.mutateAsync()
    onRecheck()
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-blue-500" />
          <div>
            <CardTitle>{t('setup.claude.title')}</CardTitle>
            <CardDescription>{t('setup.claude.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!installMutation.isPending ? (
          <Button className="w-full" onClick={handleInstall}>
            {t('setup.claude.install')}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('setup.claude.installing')}</span>
            </div>
            <pre className="h-32 overflow-auto rounded bg-muted p-2 text-xs font-mono">
              {log || t('setup.claude.waiting')}
            </pre>
          </div>
        )}
      </CardContent>
    </>
  )
}
