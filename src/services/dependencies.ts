import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { commands, type DependencyStatus } from '@/lib/tauri-bindings'

// Query keys for dependencies
export const dependenciesQueryKeys = {
  all: ['dependencies'] as const,
  status: () => [...dependenciesQueryKeys.all, 'status'] as const,
}

/**
 * Hook to check dependency status (Node.js, Claude Code, auth)
 */
export function useDependencyStatus() {
  return useQuery({
    queryKey: dependenciesQueryKeys.status(),
    queryFn: async (): Promise<DependencyStatus> => {
      logger.debug('Checking dependencies...')
      const status = await commands.checkDependencies()
      logger.info('Dependency status', { status })
      return status
    },
    staleTime: Infinity, // Only check once per session unless manually refetched
    gcTime: Infinity,
  })
}

/**
 * Hook to install Claude Code via npm
 * Progress is emitted via 'install-progress' Tauri events
 */
export function useInstallClaudeCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      logger.info('Installing Claude Code...')

      const result = await commands.installClaudeCode()

      if (result.status === 'error') {
        logger.error('Failed to install Claude Code', { error: result.error })
        throw new Error(result.error)
      }

      logger.info('Claude Code installed successfully')
      return result
    },
    onSuccess: () => {
      // Invalidate dependency status to trigger recheck
      queryClient.invalidateQueries({ queryKey: dependenciesQueryKeys.status() })
      toast.success('Claude Code installed successfully')
    },
    onError: error => {
      toast.error('Failed to install Claude Code', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })
}
