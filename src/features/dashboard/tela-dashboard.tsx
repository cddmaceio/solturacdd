import { useMemo } from 'react'
import { AlertTriangle, CalendarDays, ClipboardList, RefreshCw, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { useColaboradores } from '@/features/equipes/api'
import { useDataOperacao } from '@/hooks/use-data-operacao'
import { usePcdMapas } from '@/features/pcd/api'
import { useVeiculos } from '@/features/veiculos/api'
import { difDiasIso, paraDmy } from '@/lib/datas'
import { code, norm } from '@/lib/texto'
import { resumoOperacional } from './lib'

const TONS: Record<string, string> = {
  frota: 'border-sky-200 bg-sky-50 text-sky-800',
  vans: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  as: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  spot: 'border-amber-200 bg-amber-50 text-amber-800',
  zumpy: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  outros: 'border-slate-200 bg-slate-100 text-slate-700',
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  Icone,
  cor,
}: {
  rotulo: string
  valor: number
  detalhe: string
  Icone: React.ComponentType<{ className?: string }>
  cor: string
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        <Icone className={`size-4 ${cor}`} />
        <span className="truncate">{rotulo}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold leading-none tabular-nums ${cor}`}>{valor}</div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{detalhe}</p>
    </div>
  )
}

export function TelaDashboard() {
  const { dataIso, definirData } = useDataOperacao()
  const pcd = usePcdMapas(dataIso)
  const base = useVeiculos()
  const equipe = useColaboradores()

  const resumo = useMemo(
    () => resumoOperacional(pcd.data ?? [], base.data ?? [], dataIso),
    [pcd.data, base.data, dataIso],
  )

  if ((pcd.isLoading || base.isLoading || equipe.isLoading) && !pcd.data && !base.data) {
    return <div className="p-8 text-center text-muted-foreground">Carregando dashboard operacional…</div>
  }
  const erro = pcd.error ?? base.error ?? equipe.error
  if (erro) return <div className="p-8 text-center text-destructive">{erro.message}</div>

  const maiorCategoria = Math.max(1, ...resumo.categorias.map((categoria) => categoria.mapas))

  return (
    <div>
      <CabecalhoPagina
        titulo="Dashboard Operacional"
        descricao={`Visão do PCD do dia selecionado, com mapas, veículos e pendências · ${paraDmy(dataIso)}`}
        acoes={
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="sr-only">Data da operação</span>
            <Input
              type="date"
              value={dataIso}
              onChange={(e) => e.target.value && definirData(e.target.value)}
              className="h-9 w-40"
              aria-label="Data da operação"
            />
          </label>
        }
      />

      <div className="mb-5 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Indicador
            rotulo="Mapas D0"
            valor={resumo.mapasD0}
            detalhe={`Entregas em ${paraDmy(dataIso)}`}
            Icone={ClipboardList}
            cor="text-sky-700"
          />
          <Indicador
            rotulo="Carros no dia"
            valor={resumo.carrosD0}
            detalhe="placas distintas · sem recargas"
            Icone={Truck}
            cor="text-indigo-700"
          />
          <Indicador
            rotulo="Pernoites"
            valor={resumo.pernoites}
            detalhe={`${resumo.carrosPernoite} veículo(s) com mapas abertos anteriores`}
            Icone={AlertTriangle}
            cor={resumo.pernoites ? 'text-amber-700' : 'text-emerald-700'}
          />
          <Indicador
            rotulo="Recargas D0"
            valor={resumo.recargasD0}
            detalhe="mapas REC identificados no dia"
            Icone={RefreshCw}
            cor="text-cyan-700"
          />
        </div>
      </div>

      <section className="mb-5 rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Mapas D0 por operação</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Categorias exclusivas. Zumpy → Spot → AS → Vans → frota fixa.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">{resumo.mapasD0} mapas no PCD</Badge>
        </div>
        {resumo.categorias.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum mapa para a data selecionada.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resumo.categorias.map((categoria) => (
              <article key={categoria.chave} className="rounded-lg border border-slate-200 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={TONS[categoria.chave]}>{categoria.rotulo}</Badge>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {categoria.carros} carro(s)
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <strong className="text-2xl leading-none tabular-nums text-slate-900">{categoria.mapas}</strong>
                  <span className="text-xs text-muted-foreground">mapas</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${categoria.chave === 'zumpy' ? 'bg-fuchsia-500' : categoria.chave === 'spot' ? 'bg-amber-500' : categoria.chave === 'as' ? 'bg-indigo-500' : categoria.chave === 'vans' ? 'bg-cyan-500' : categoria.chave === 'frota' ? 'bg-sky-500' : 'bg-slate-400'}`}
                    style={{ width: `${(categoria.mapas / maiorCategoria) * 100}%` }}
                  />
                </div>
                <p className="mt-2 truncate text-[10px] text-muted-foreground" title={categoria.placas.join(', ')}>
                  {categoria.placas.length ? `Placas: ${categoria.placas.join(', ')}` : 'Sem placa identificada'}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
          <div>
            <h2 className="text-sm font-bold tracking-tight">Pernoites · mapas anteriores em aberto</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Pendências anteriores à data de operação selecionada.</p>
          </div>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
            {resumo.pernoites} mapa(s) · {resumo.carrosPernoite} carro(s)
          </Badge>
        </div>
        {resumo.pernoitesPorPlaca.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum pernoite em aberto.</p>
        ) : (
          <div className="divide-y">
            {resumo.pernoitesPorPlaca.map(({ placa, mapas }) => (
              <div key={placa} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="min-w-24 pt-0.5 text-sm font-bold tabular-nums text-slate-800">{placa}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  {mapas.map((mapa) => {
                    const codigoMotorista = code(mapa.motorista_codigo)
                    const motorista = equipe.data?.find(
                      (pessoa) => pessoa.tipo === 'motorista' && code(pessoa.codigo) === codigoMotorista,
                    )
                    const tipoRota = norm(mapa.as_rota)
                    const rotuloRota = tipoRota === 'AS' ? 'AS' : tipoRota.includes('ROTA') ? 'ROTA' : mapa.as_rota || '—'
                    const diasAberto = Math.max(1, difDiasIso(dataIso, mapa.data_entrega))
                    return (
                      <div
                        key={`${mapa.data_entrega}-${mapa.mapa}`}
                        className="grid gap-x-4 gap-y-2 rounded-lg border border-amber-100 bg-amber-50/35 px-3 py-2 sm:grid-cols-[minmax(120px,0.8fr)_minmax(190px,1.5fr)_90px_minmax(130px,0.8fr)] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-800">Mapa {mapa.mapa}</div>
                          <div className="text-[10px] text-muted-foreground">Entrega {paraDmy(mapa.data_entrega)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Motorista do mapa</div>
                          <div className="truncate text-[11px] font-medium text-slate-700">
                            {codigoMotorista
                              ? `${codigoMotorista} · ${motorista?.nome ?? 'Nome não cadastrado'}`
                              : 'Motorista não informado no PCD'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Operação</div>
                          <Badge variant="outline" className={rotuloRota === 'AS' ? 'border-indigo-200 bg-indigo-50 text-[10px] text-indigo-800' : 'border-sky-200 bg-sky-50 text-[10px] text-sky-800'}>
                            {rotuloRota}
                          </Badge>
                        </div>
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Tempo em aberto</div>
                          <div className={`text-[11px] font-bold tabular-nums ${diasAberto >= 3 ? 'text-rose-700' : 'text-amber-800'}`}>
                            {diasAberto} {diasAberto === 1 ? 'dia' : 'dias'} em aberto
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
