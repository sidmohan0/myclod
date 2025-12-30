import { useTranslation } from 'react-i18next'
import { AlertCircle, Download, Terminal, Copy } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { toast } from 'sonner'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface NodeCheckProps {
  onRecheck: () => void
}

export function NodeCheck({ onRecheck }: NodeCheckProps) {
  const { t } = useTranslation()

  const openNodeDownload = async () => {
    await openUrl('https://nodejs.org/')
  }

  const copyBrewCommand = async () => {
    await writeText('brew install node')
    toast.success(t('setup.node.copied'))
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-amber-500" />
          <div>
            <CardTitle>{t('setup.node.title')}</CardTitle>
            <CardDescription>{t('setup.node.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button className="w-full" onClick={openNodeDownload}>
          <Download className="mr-2 h-4 w-4" />
          {t('setup.node.download')}
        </Button>

        <Button variant="outline" className="w-full" onClick={copyBrewCommand}>
          <Terminal className="mr-2 h-4 w-4" />
          brew install node
          <Copy className="ml-auto h-4 w-4 text-muted-foreground" />
        </Button>

        <Button variant="ghost" className="w-full" onClick={onRecheck}>
          {t('setup.node.recheck')}
        </Button>
      </CardContent>
    </>
  )
}
