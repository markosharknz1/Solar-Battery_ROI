import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export function ModeToggle() {
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const navigate = useNavigate()

  const choose = (next: 'simple' | 'advanced') => {
    setMode(next)
    navigate(next === 'advanced' ? '/overview' : '/')
  }

  return (
    <div className="flex items-center rounded-full border p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => choose('simple')}
        className={cn('rounded-full px-3 py-1 transition-colors', mode === 'simple' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
      >
        Simple
      </button>
      <button
        type="button"
        onClick={() => choose('advanced')}
        className={cn('rounded-full px-3 py-1 transition-colors', mode === 'advanced' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
      >
        Advanced
      </button>
    </div>
  )
}
