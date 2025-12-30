import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDependencyStatus } from '@/services/dependencies'
import { NodeCheck } from './NodeCheck'
import { ClaudeCheck } from './ClaudeCheck'
import { AuthCheck } from './AuthCheck'

type SetupStep =
  | 'checking' // Initial dependency check
  | 'need-node' // Node.js not found
  | 'need-claude' // Claude Code not found
  | 'need-auth' // Not authenticated
  | 'ready' // All good

interface SetupFlowProps {
  onComplete: () => void
}

export function SetupFlow({ onComplete }: SetupFlowProps) {
  const { t } = useTranslation()
  const { data: deps, isLoading, refetch } = useDependencyStatus()
  const hasCalledComplete = useRef(false)

  // Derive step from dependency status (no setState in effect)
  const step = useMemo<SetupStep>(() => {
    if (isLoading || !deps) return 'checking'
    if (!deps.node) return 'need-node'
    if (!deps.claude) return 'need-claude'
    if (!deps.authenticated) return 'need-auth'
    return 'ready'
  }, [deps, isLoading])

  // Call onComplete when ready (side effect for external sync)
  useEffect(() => {
    if (step === 'ready' && !hasCalledComplete.current) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [step, onComplete])

  const handleRecheck = async () => {
    hasCalledComplete.current = false
    await refetch()
  }

  if (step === 'checking' || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-[480px]">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">{t('setup.checking')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-[480px]">
        {step === 'need-node' && <NodeCheck onRecheck={handleRecheck} />}
        {step === 'need-claude' && <ClaudeCheck onRecheck={handleRecheck} />}
        {step === 'need-auth' && <AuthCheck onComplete={handleRecheck} />}
      </Card>
    </div>
  )
}
