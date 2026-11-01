import { MapPin } from 'lucide-react'
import { paraDmy } from '@/lib/datas'
import { temLocalizacao, type Cliente } from './lib'

export function DetalheCliente({ cliente }: { cliente: Cliente }) {
  const localizacao = temLocalizacao(cliente)
  const lat = cliente.latitude ?? 0
  const lon = cliente.longitude ?? 0
  const bbox = [lon - 0.005, lat - 0.005, lon + 0.005, lat + 0.005].join(',')
  const campos = [
    ['Endereço', [cliente.endereco, cliente.cidade, cliente.estado].filter(Boolean).join(' · ')],
    ['Setor', cliente.setor],
    ['Última compra', cliente.ultima_compra ? paraDmy(cliente.ultima_compra) : null],
    ['Penúltima compra', cliente.penultima_compra ? paraDmy(cliente.penultima_compra) : null],
    ['Antepenúltima compra', cliente.antepenultima_compra ? paraDmy(cliente.antepenultima_compra) : 'Não informada na base'],
  ]
  return <div className="grid gap-5 lg:grid-cols-2">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente {cliente.codigo}</p>
      <h2 className="mt-1 text-xl font-semibold">{cliente.nome}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{cliente.na_base_clientes ? 'Base clientes' : 'Somente no roteirizador'}{cliente.codigo_roteirizador ? ` · Código roteirizador: ${cliente.codigo_roteirizador}` : ' · Sem correspondência no roteirizador'}</p>
      <dl className="mt-5 divide-y">{campos.map(([titulo, valor]) => <div key={titulo} className="grid grid-cols-[150px_1fr] gap-3 py-3 text-sm">
        <dt className="text-muted-foreground">{titulo}</dt><dd className="font-medium">{valor || 'Não informado'}</dd>
      </div>)}</dl>
    </div>
    <div className="overflow-hidden rounded-xl border bg-muted/30">
      {localizacao ? <>
        <iframe title={`Localização de ${cliente.nome}`} className="h-72 w-full border-0" loading="lazy" referrerPolicy="no-referrer"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`} />
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
          <span>{lat}, {lon}</span>
          <a className="font-medium text-primary underline" href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`} target="_blank" rel="noreferrer">Abrir no Google Maps</a>
        </div>
      </> : <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"><MapPin className="size-8" />Localização não informada. Importe a base do roteirizador com latitude e longitude válidas.</div>}
    </div>
  </div>
}
