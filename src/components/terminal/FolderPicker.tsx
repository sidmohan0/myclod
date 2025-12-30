import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useClaudeStore } from '@/store/claude-store'
import { logger } from '@/lib/logger'

interface FolderPickerProps {
  onFolderSelected: (path: string) => void
}

export function FolderPicker({ onFolderSelected }: FolderPickerProps) {
  const { t } = useTranslation()
  const [isSelecting, setIsSelecting] = useState(false)
  const setCurrentFolder = useClaudeStore((state) => state.setCurrentFolder)

  const handleSelectFolder = async () => {
    setIsSelecting(true)

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('folder.selectTitle'),
      })

      if (selected && typeof selected === 'string') {
        logger.info('Folder selected', { path: selected })
        setCurrentFolder(selected)
        onFolderSelected(selected)
      }
    } catch (error) {
      logger.error('Failed to select folder', { error })
    } finally {
      setIsSelecting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-[480px]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FolderOpen className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>{t('folder.title')}</CardTitle>
          <CardDescription>{t('folder.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSelectFolder}
            disabled={isSelecting}
          >
            {t('folder.selectButton')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
