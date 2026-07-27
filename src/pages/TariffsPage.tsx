import { PageHeader } from '@/components/layout/PageHeader'
import { TariffList } from '@/components/tariffs/TariffList'

export function TariffsPage() {
  return (
    <>
      <PageHeader title="Tariff plans" description="Model your retailer's rates so you can compare and simulate against them." />
      <TariffList />
    </>
  )
}
