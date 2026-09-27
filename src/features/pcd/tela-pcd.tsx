import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { useDataOperacao } from '@/hooks/use-data-operacao'
import { useImportarPcd, usePcdMapas } from '@/features/pcd/api'
import {
  classeClassificacao,
  classeFaseMpd,
  ehFreteiro,
  ehRecarga,
  ehZumpy,
  mapasVisiveis,
  pendenciaAnterior,
  rotuloClassificacao,
  rotuloFaseMpd,
  situacaoMpd,
} from '@/features/pcd/lib'
import { norm } from '@/lib/texto'
import { paraDmy } from '@/lib/datas'

function badgeDias(mapa: { data_entrega: string }, dataSelecionadaIso: string) {
  const [aaaammdd, iso] = [
    mapa.data_entrega,
    dataSelecionadaIso,
  ] as const
  if (aaaammdd === iso) {
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        D0
      </Badge>
    )
  }
  const ontem = new Date(`${iso}T12:00:00`)
  ontem.setDate(ontem.getDate() - 1)
  const isoOntem = ontem.toISOString().slice(0, 10)
  if (aaaammdd === isoOntem) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        D-1
      </Badge>
    )
  }
  const d0 = new Date(`${iso}T12:00:00`)
  const anterior = new Date(`${aaaammdd}T12:00:00`)
  const dias = Math.round((d0.getTime() - anterior.getTime()) / 86_400_000)
  return (
    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
      D-{dias}
    </Badge>
  )
}

export function TelaPcd() {
  const { pode } = useAuth()
  const podeImportar = pode('pcd.importar')
  const { dataIso, definirData } = useDataOperacao()
  const { data: mapas, isLoading, error } = usePcdMapas(dataIso)
  const importar = useImportarPcd()

  const [busca, setBusca] = useState('')
  const inputArquivo = useRef<HTMLInputElement>(null)

  const visiveis = useMemo(() => mapasVisiveis(mapas ?? [], dataIso), [mapas, dataIso])
  const anteriores = useMemo(
    () => visiveis.filter((m) => pendenciaAnterior(m, dataIso)),
    [visiveis, dataIso],
  )

  const lista = useMemo(() => {
    const q = norm(busca)
    const filtrada = q
      ? visiveis.filter((m) =>
          norm(
            [m.mapa, m.placa, m.carga, m.carga_atual, m.regiao, m.cidades, m.roadshow, m.classificacao, m.motorista_codigo, m.clientes]
              .filter(Boolean)
              .join(' '),
          ).includes(q),
        )
      : visiveis
    return [...filtrada].sort((a, b) => (b.data_entrega < a.data_entrega ? -1 : b.data_entrega > a.data_entrega ? 1 : a.mapa.localeCompare(b.mapa, 'pt-BR', { numeric: true })))
  }, [visiveis, busca])

  const totalEntregas = lista.reduce((s, m) => s + (m.entregas ?? 0), 0)
  const totalFreteiro = lista.filter(ehFreteiro).length
  const totalRec = lista.filter(ehRecarga).length

  function aoImportar(arquivo: File) {
    importar.mutate(arquivo, {
      onError: (e) => toast.error(e.message),
      onSettled: () => {
        if (inputArquivo.current) inputArquivo.current.value = ''
      },
    })
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="PCD"
        descricao="Mapas do dia selecionado e pendências de datas anteriores que seguem em aberto."
        acoes={
          <>
            <Input
              type="date"
              value={dataIso}
              onChange={(e) => e.target.value && definirData(e.target.value)}
              className="h-9 w-40"
              aria-label="Data de operação"
            />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar mapa, placa, região…"
              className="h-9 w-64"
              aria-label="Buscar mapas"
            />
            {podeImportar && (
              <>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0]
                    if (arquivo) aoImportar(arquivo)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importar.isPending}
                  onClick={() => inputArquivo.current?.click()}
                >
                  <Upload className="size-4" />
                  {importar.isPending ? 'Importando…' : 'Importar CSV'}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <b className="text-foreground">{lista.length}</b> mapa(s)
        </span>
        <span>
          <b className="text-foreground">{anteriores.length}</b> pendência(s) anteriores
        </span>
        <span>
          <b className="text-foreground">{totalEntregas}</b> entrega(s)
        </span>
        <span>
          <b className="text-foreground">{totalFreteiro}</b> freteiro(s)
        </span>
        <span>
          <b className="text-foreground">{totalRec}</b> recarga(s)
        </span>
        <span className="ml-auto text-xs">Data de operação: {paraDmy(dataIso)}</span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data entrega</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Mapa</TableHead>
                <TableHead>TR (tempo em rota)</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>MPD</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead className="text-right">Entregas</TableHead>
                <TableHead className="text-right">TT CX</TableHead>
                <TableHead className="text-right">Peso</TableHead>
                <TableHead className="text-right">Ocup. peso</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Clientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">
                  Carregando mapas…
                </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                <TableCell colSpan={17} className="h-24 text-center text-destructive">
                  {error.message}
                </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && lista.length === 0 && (
                <TableRow>
                <TableCell colSpan={17} className="h-24 text-center text-muted-foreground">
                  Nenhum mapa para esta data.
                </TableCell>
                </TableRow>
              )}
              {lista.map((m) => {
                const freteiro = ehFreteiro(m)
                const rec = ehRecarga(m)
                const tipoOperacao = norm(m.as_rota) === 'AS' ? 'AS' : norm(m.as_rota) === 'ROTA' ? 'ROTA' : ''
                const situacao = situacaoMpd(m.mpd)
                return (
                  <TableRow
                    key={`${m.data_entrega}-${m.mapa}`}
                    className={
                      m.data_entrega !== dataIso ? 'bg-amber-50 hover:bg-amber-100/70' : undefined
                    }
                  >
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {paraDmy(m.data_entrega)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{badgeDias(m, dataIso)}</TableCell>
                    <TableCell className="font-medium">{m.mapa}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {m.tempo_previsto ? m.tempo_previsto.slice(0, 5) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {tipoOperacao && (
                          <Badge
                            variant="outline"
                            className={tipoOperacao === 'AS'
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                              : 'border-sky-200 bg-sky-50 text-sky-700'}
                          >
                            {tipoOperacao}
                          </Badge>
                        )}
                        {ehZumpy(m) && (
                          <Badge variant="outline" className="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">
                            ZUMPY
                          </Badge>
                        )}
                        {freteiro && (
                          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                            FRETEIRO
                          </Badge>
                        )}
                        {rec && (
                          <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">
                            REC
                          </Badge>
                        )}
                        {situacao === 'Aberto' && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            ABERTO
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={classeFaseMpd(m.mpd)}>
                        {rotuloFaseMpd(m.mpd)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {m.classificacao ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${classeClassificacao(m.classificacao)}`}
                        >
                          {rotuloClassificacao(m.classificacao)}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{m.placa || '—'}</TableCell>
                    <TableCell>{m.tipo_veiculo || '—'}</TableCell>
                    <TableCell className="tabular-nums">{m.motorista_codigo || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.entregas ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.total_caixas != null ? Math.round(m.total_caixas) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.total_peso != null ? `${Math.round(m.total_peso)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.ocupacao_peso_pct != null ? `${Math.round(m.ocupacao_peso_pct)}%` : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{m.carga || '—'}</TableCell>
                    <TableCell className="max-w-40 truncate" title={m.cidades || ''}>
                      {m.regiao || '—'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={m.clientes || ''}>
                      {m.clientes || '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
