import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, FolderOpen, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface ActionBarProps {
  currentFolder: string
  onChangeFolder: () => void
  className?: string
}

export function ActionBar({ currentFolder, onChangeFolder, className }: ActionBarProps) {
  const { t } = useTranslation()

  const sendResponse = useCallback(async (response: string) => {
    const result = await commands.sendInput(response + '\n')
    if (result.status === 'error') {
      logger.error('Failed to send response', { error: result.error })
    }
  }, [])

  const handleAccept = useCallback(() => {
    logger.debug('Accept clicked')
    sendResponse('y')
  }, [sendResponse])

  const handleReject = useCallback(() => {
    logger.debug('Reject clicked')
    sendResponse('n')
  }, [sendResponse])

  // Extract folder name from path
  const folderName = currentFolder.split('/').pop() || currentFolder

  return (
    <div className={cn('flex items-center justify-between border-t bg-background px-4 py-2', className)}>
      {/* Left side: Current folder */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FolderOpen className="h-4 w-4" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="max-w-[200px] truncate cursor-default">{folderName}</span>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            <p className="font-mono text-xs">{currentFolder}</p>
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onChangeFolder}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Right side: Accept/Reject buttons */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              onClick={handleReject}
            >
              <X className="h-4 w-4" />
              {t('actionBar.reject')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('actionBar.rejectTooltip')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-green-500/50 text-green-500 hover:bg-green-500/10 hover:text-green-500"
              onClick={handleAccept}
            >
              <Check className="h-4 w-4" />
              {t('actionBar.accept')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('actionBar.acceptTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
