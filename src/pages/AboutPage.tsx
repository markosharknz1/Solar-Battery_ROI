import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const CONTACT_EMAIL = 'markosharkau@gmail.com'
const GITHUB_URL = 'https://github.com/markosharknz1/Solar-Battery_ROI'

export function AboutPage() {
  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Version', value: __APP_VERSION__ },
    {
      label: 'Released',
      value: new Date(`${__APP_BUILD_DATE__}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    },
    {
      label: 'Contact',
      value: (
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
          {CONTACT_EMAIL}
        </a>
      ),
    },
    {
      label: 'Project page',
      value: (
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          github.com/markosharknz1/Solar-Battery_ROI
        </a>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="About" />
      <Card>
        <CardHeader>
          <CardTitle>Solar &amp; Battery Advisor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {facts.map((f) => (
              <div key={f.label} className="grid grid-cols-[8rem_1fr] items-baseline gap-2 text-sm">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium">{f.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Analyse smart meter data, model time-of-use tariffs, simulate battery storage, and compare power plans -
            entirely on this device. Your usage data is never uploaded anywhere. New versions are published on the
            project page above under Releases.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
