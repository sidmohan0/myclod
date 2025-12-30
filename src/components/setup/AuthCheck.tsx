import { useTranslation } from 'react-i18next'
import { Key } from 'lucide-react'
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AuthCheckProps {
  onComplete: () => void
}

export function AuthCheck({ onComplete }: AuthCheckProps) {
  const { t } = useTranslation()

  // For now, we just show instructions and let the user complete auth manually
  // In the future, we could embed a terminal here to show the auth flow

  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Key className="h-8 w-8 text-green-500" />
          <div>
            <CardTitle>{t('setup.auth.title')}</CardTitle>
            <CardDescription>{t('setup.auth.description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4">
          <p className="text-sm text-muted-foreground mb-2">
            {t('setup.auth.instructions')}
          </p>
          <code className="block bg-background rounded p-2 text-sm font-mono">
            claude
          </code>
        </div>

        <Button variant="ghost" className="w-full" onClick={onComplete}>
          {t('setup.auth.complete')}
        </Button>
      </CardContent>
    </>
  )
}
