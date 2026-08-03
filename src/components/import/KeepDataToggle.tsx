import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useDataStore } from '@/store/dataStore'

export function KeepDataToggle() {
  const keepDataOnDevice = useDataStore((s) => s.keepDataOnDevice)
  const setKeepDataOnDevice = useDataStore((s) => s.setKeepDataOnDevice)

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div>
        <Label>Keep my usage data on this device</Label>
        <p className="text-xs text-muted-foreground">
          Off by default: imported data lives only in this session and is gone when you close the app. Turn on to
          store it in this device's local storage so it's still here next time - it never leaves your device either
          way. Very large multi-year datasets may exceed the browser's storage limit.
        </p>
      </div>
      <Switch checked={keepDataOnDevice} onCheckedChange={setKeepDataOnDevice} />
    </div>
  )
}
