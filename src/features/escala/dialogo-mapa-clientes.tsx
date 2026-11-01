import { lazy, Suspense, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useClientesPorCodigos } from '@/features/clientes/api'
import { codigosDoMapa } from '@/features/clientes/lib'
import { paraDmy } from '@/lib/datas'
import { clientesDoVeiculo } from './clientes-veiculo'
import type { VeiculoEscala } from './montagem'

const MapaPontosClientes = lazy(() => import('./mapa-pontos-clientes'))

export function DialogoMapaClientes({ veiculo, dataIso, onClose }: { veiculo: VeiculoEscala; dataIso: string; onClose: () => void }) {
  const codigos = veiculo.rotas.flatMap((rota) => codigosDoMapa(rota.clientes))
  const { data: clientes = [], isLoading, error, refetch } = useClientesPorCodigos(codigos)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const lista = useMemo(() => clientesDoVeiculo(veiculo.rotas, clientes), [veiculo.rotas, clientes])
  const pontos = useMemo(() => lista.filter((c) => c.localizado), [lista])

  return <Dialog open onOpenChange={(aberto) => { if (!aberto) onClose() }}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-6xl">
      <DialogHeader>
        <DialogTitle>Clientes do veículo {veiculo.placa}</DialogTitle>
        <DialogDescription>Escala de {paraDmy(dataIso)} · Pontos dos clientes de todos os mapas vinculados a este veículo, incluindo pendências.</DialogDescription>
      </DialogHeader>
      {isLoading ? <p role="status" className="p-8 text-center">Carregando localização dos clientes…</p> : error ? <div role="alert" className="space-y-3 p-4"><p className="text-destructive">{error.message}</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{pontos.length} de {lista.length} cliente(s) com localização{lista.length > pontos.length ? ` · ${lista.length - pontos.length} sem coordenadas ou sem cadastro` : ''}</p>
          {pontos.length > 0 && <Button size="sm" variant="ghost" onClick={() => setSelecionado(null)}>Ver todos os pontos</Button>}
        </div>
        <div className="grid overflow-hidden rounded-xl border lg:grid-cols-[1fr_300px]">
          <div className="h-[45dvh] min-h-80 bg-muted/30 lg:h-[60dvh]">
            {pontos.length ? <Suspense fallback={<p role="status" className="p-8 text-center text-muted-foreground">Abrindo mapa…</p>}><MapaPontosClientes pontos={pontos} selecionado={selecionado} /></Suspense> : <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground"><MapPin className="size-8" /><p>Nenhum cliente deste veículo possui coordenadas válidas nas bases importadas.</p></div>}
          </div>
          <div className="max-h-60 overflow-y-auto border-t bg-card p-2 lg:max-h-[60dvh] lg:border-t-0 lg:border-l" aria-label="Clientes do veículo">
            {lista.map((ponto) => <button key={ponto.codigo} type="button" disabled={!ponto.localizado} aria-pressed={selecionado === ponto.codigo}
              onClick={() => setSelecionado(ponto.codigo)} className={`mb-1 block w-full rounded-lg p-3 text-left text-xs outline-none enabled:hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-70 ${selecionado === ponto.codigo ? 'bg-muted ring-1 ring-border' : ''}`}>
              <span className="block text-muted-foreground">{ponto.codigo} · Mapa(s) {ponto.mapas.join(', ')}</span>
              <span className="mt-1 block text-sm font-medium">{ponto.cliente?.nome ?? 'Cliente não encontrado na base'}</span>
              <span className="mt-1 block text-muted-foreground">{ponto.localizado ? [ponto.cliente?.setor, ponto.cliente?.cidade].filter(Boolean).join(' · ') || 'Ver no mapa' : 'Sem localização disponível'}</span>
            </button>)}
            {!lista.length && <p className="p-4 text-sm text-muted-foreground">Os mapas deste veículo não possuem códigos de clientes.</p>}
          </div>
        </div>
      </>}
    </DialogContent>
  </Dialog>
}
