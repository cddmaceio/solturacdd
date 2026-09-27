import { useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { useDataOperacao } from '@/hooks/use-data-operacao'
import { useEscalaCompleta } from '@/features/escala/mutacoes'
import {
  disponibilidade,
  estatisticasVeiculo,
  fidelidade,
  rotuloTipoVeiculo,
  type EstatisticasVeiculo,
  type VeiculoEscala,
} from '@/features/escala/montagem'
import { code, norm } from '@/lib/texto'
import { baixarCsv } from '@/lib/csv'
import { paraDmy } from '@/lib/datas'
import type { PapelEquipe } from '@/types/dominio'

const TR_CRITICO_MIN = 9 * 60 + 10
const TR_CRITICO_MAX = 9 * 60 + 25
const LIMITE_OCUPACAO_PESO = 90
const LIMITE_ENTREGAS = 20

function motivosCriticos(v: VeiculoEscala): { stats: EstatisticasVeiculo; motivos: string[] } {
  const stats = estatisticasVeiculo(v)
  const motivos: string[] = []
  const trNaFaixa = stats.tempoMinutos >= TR_CRITICO_MIN && stats.tempoMinutos <= TR_CRITICO_MAX
  if (!trNaFaixa) return { stats, motivos }
  if (stats.entregas >= LIMITE_ENTREGAS) motivos.push(`${stats.entregas} entregas`)
  if (stats.ocupacaoPeso >= LIMITE_OCUPACAO_PESO) motivos.push(`Ocupação ${Math.round(stats.ocupacaoPeso)}%`)
  return { stats, motivos }
}

export function TelaIndicadores() {
  const { pode } = useAuth()
  const podeExportar = pode('exportacoes.gerar')
  const { dataIso } = useDataOperacao()
  const { dados, carregando, erro } = useEscalaCompleta(dataIso)
  const [busca, setBusca] = useState('')

  const veiculos = useMemo(() => dados?.veiculos ?? [], [dados])
  const pessoas = useMemo(() => dados?.pessoas ?? [], [dados])

  const nomeDe = (papel: PapelEquipe, codigo: string): string => {
    const c = code(codigo)
    if (!c) return ''
    return pessoas.find((p) => p.tipo === papel && code(p.codigo) === c)?.nome ?? ''
  }

  const total = veiculos.length || 1

  const barrasSalas = useMemo(() => {
    const contagens = new Map<string, number>()
    for (const v of veiculos) contagens.set(v.grupo, (contagens.get(v.grupo) ?? 0) + 1)
    return [...contagens.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .map(([grupo, n]) => ({ grupo, n, pct: (n / total) * 100 }))
  }, [veiculos, total])

  const qualidade = useMemo(() => {
    const carregados = veiculos.filter((v) => v.carregado)
    const fix = carregados.filter(
      (v) =>
        code(v.base?.motorista_fixo_codigo) &&
        code(v.base?.motorista_fixo_codigo) !== '800' &&
        norm(v.base?.motorista_fixo_nome) !== 'PARADO',
    )
    const fok = fix.filter((v) => fidelidade(v, 'motorista') === 'ok').length
    const hfix = carregados.filter(
      (v) => code(v.ajudante_referencia) && code(v.ajudante_referencia) !== '800',
    )
    const hok = hfix.filter((v) => fidelidade(v, 'ajudante') === 'ok').length
    const comMotorista = carregados.filter((v) => code(v.motorista_codigo)).length
    return [
      { rotulo: 'Fidelização Frota', pct: fix.length ? (fok / fix.length) * 100 : 0 },
      { rotulo: 'Ajudante fiel', pct: hfix.length ? (hok / hfix.length) * 100 : 0 },
      {
        rotulo: 'Cargas c/ motorista',
        pct: carregados.length ? (comMotorista / carregados.length) * 100 : 0,
      },
    ]
  }, [veiculos])

  const criticos = useMemo(
    () =>
      veiculos
        .map((v) => ({ v, ...motivosCriticos(v) }))
        .filter((c) => c.motivos.length > 0)
        .sort(
          (a, b) =>
            b.motivos.length - a.motivos.length ||
            b.stats.tempoMinutos - a.stats.tempoMinutos ||
            b.stats.entregas - a.stats.entregas,
        ),
    [veiculos],
  )

  const alertas = useMemo(() => {
    const saida: { v: (typeof veiculos)[number]; lista: string[] }[] = []
    for (const v of veiculos) {
      const statusD = pessoas.find(
        (p) => p.tipo === 'motorista' && code(p.codigo) === code(v.motorista_codigo),
      )?.status
      const statusH = pessoas.find(
        (p) => p.tipo === 'ajudante' && code(p.codigo) === code(v.ajudante_codigo),
      )?.status
      const a: string[] = []
      if (v.carregado && !code(v.motorista_codigo)) a.push('Motorista pendente')
      if (v.carregado && fidelidade(v, 'motorista') === 'no') a.push('Fidelização Frota NOK')
      if (v.carregado && fidelidade(v, 'ajudante') === 'no') a.push('Troca de ajudante')
      if (v.temD1) a.push('Mapa D-1')
      if (statusD) a.push(`Motorista: ${statusD}`)
      if (statusH) a.push(`Ajudante: ${statusH}`)
      if (disponibilidade(v) === 'UNAVAILABLE') a.push('Veículo indisponível na base')
      const { stats: statsCrit, motivos } = motivosCriticos(v)
      if (motivos.length) a.push(`Crítico: TR ${statsCrit.tempoRotulo} · ${motivos.join(' · ')}`)
      if (a.length) saida.push({ v, lista: a })
    }
    const q = norm(busca)
    if (!q) return saida
    return saida.filter(({ v, lista }) =>
      norm([v.placa, v.grupo, ...lista].join(' ')).includes(q),
    )
  }, [veiculos, pessoas, busca])

  function exportarCsv() {
    const cabecalho = [
      'Data',
      'Sala',
      'Tipo Veículo',
      'Placa',
      'Frota',
      'Território',
      'Mapa(s)',
      'AS/Rota',
      'Motorista Cod',
      'Motorista',
      'Ajudante Cod',
      'Ajudante',
      'Ajudante 2 Cod',
      'Ajudante 2',
      'Chapa/PX Cod',
      'Chapa/PX',
      'Motorista Fixo',
      'Ajudante Fixo',
      'Fidelização Frota',
      'Fidelização Ajudante',
      'KM',
      'Entregas',
      'Ocupação Peso %',
      'Tempo Previsto',
      'Rota',
      'Observação',
    ]
    const linhas = veiculos.map((v) => {
      const stats = estatisticasVeiculo(v)
      return [
        paraDmy(dataIso),
        v.grupo,
        rotuloTipoVeiculo(v),
        v.placa,
        v.isSpot ? 'SPOT' : (v.base?.frota ?? ''),
        v.base?.territorio ?? '',
        v.rotas.map((r) => r.mapa).join(' | '),
        [...new Set(v.rotas.map((r) => r.as_rota).filter(Boolean))].join(' / '),
        v.motorista_codigo || '',
        nomeDe('motorista', v.motorista_codigo),
        v.ajudante_codigo || '',
        nomeDe('ajudante', v.ajudante_codigo),
        v.ajudante2_codigo || '',
        nomeDe('ajudante', v.ajudante2_codigo),
        v.chapa_codigo || '',
        v.chapa_nome || nomeDe('ajudante', v.chapa_codigo) || '',
        v.base?.motorista_fixo_codigo
          ? `${v.base.motorista_fixo_codigo} - ${v.base.motorista_fixo_nome ?? ''}`
          : '',
        v.ajudante_referencia
          ? `${v.ajudante_referencia} - ${nomeDe('ajudante', v.ajudante_referencia)}`
          : '',
        fidelidade(v, 'motorista'),
        fidelidade(v, 'ajudante'),
        stats.km,
        stats.entregas,
        stats.ocupacaoPeso,
        stats.tempoRotulo,
        v.rotas.map((r) => r.regiao).join(' | '),
        v.observacao || '',
      ]
    })
    baixarCsv(`escala_${dataIso}.csv`, [cabecalho, ...linhas])
  }

  if (carregando) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>
  if (erro || !dados) {
    return (
      <div className="p-8 text-center text-destructive">
        {(erro as Error)?.message ?? 'Não foi possível carregar os indicadores'}
      </div>
    )
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Indicadores"
        descricao={`Distribuição da escala, qualidade das equipes e alertas operacionais · ${paraDmy(dataIso)}`}
        acoes={
          <>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar alertas…"
              className="h-9 w-56"
              aria-label="Filtrar alertas"
            />
            {podeExportar && (
              <Button variant="outline" size="sm" onClick={exportarCsv}>
                <FileDown className="size-4" /> Exportar escala (CSV)
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Veículos por sala</h3>
          <div className="space-y-2">
            {barrasSalas.map((b) => (
              <div key={b.grupo} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate text-xs font-medium">{b.grupo}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
                <b className="w-8 text-right text-xs tabular-nums">{b.n}</b>
              </div>
            ))}
            {barrasSalas.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem veículos na escala.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Qualidade das equipes</h3>
          <div className="space-y-2">
            {qualidade.map((q) => (
              <div key={q.rotulo} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-xs font-medium">{q.rotulo}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${q.pct < 70 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${q.pct}%` }}
                  />
                </div>
                <b className="w-10 text-right text-xs tabular-nums">{Math.round(q.pct)}%</b>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Meta de fidelização: 70%.</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">Veículos críticos do dia</strong>
          <span className="text-xs text-muted-foreground">
            {criticos.length} veículo(s) · TR 09:10–09:25 com ≥{LIMITE_ENTREGAS} entregas ou
            {' '}≥{LIMITE_OCUPACAO_PESO}% ocupação · TR fora da faixa = LD/pernoite
          </span>
        </div>
        {criticos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum veículo acima dos limites para os filtros atuais.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {criticos.map(({ v, stats, motivos }) => {
              const trNaFaixa =
                stats.tempoMinutos >= TR_CRITICO_MIN && stats.tempoMinutos <= TR_CRITICO_MAX
              return (
                <div key={v.chave} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">{v.placa}</b>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {v.grupo} · {rotuloTipoVeiculo(v)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">TR</div>
                      <b
                        className={`text-sm tabular-nums ${trNaFaixa ? 'text-rose-700' : 'text-foreground'}`}
                      >
                        {stats.tempoRotulo}
                      </b>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Ocupação</div>
                      <b
                        className={`text-sm tabular-nums ${stats.ocupacaoPeso >= LIMITE_OCUPACAO_PESO ? 'text-rose-700' : 'text-foreground'}`}
                      >
                        {Math.round(stats.ocupacaoPeso)}%
                      </b>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Entregas</div>
                      <b
                        className={`text-sm tabular-nums ${stats.entregas >= LIMITE_ENTREGAS ? 'text-rose-700' : 'text-foreground'}`}
                      >
                        {stats.entregas}
                      </b>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {motivos.map((m) => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-[10px] font-medium text-rose-700"
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <strong className="text-sm">Alertas operacionais</strong>
          <span className="text-xs text-muted-foreground">
            {alertas.length} veículo(s) com alerta
          </span>
        </div>
        <div className="max-h-[calc(100dvh-540px)] min-h-40 overflow-auto">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Placa</TableHead>
                <TableHead className="whitespace-nowrap">Sala</TableHead>
                <TableHead className="whitespace-nowrap">Mapa(s)</TableHead>
                <TableHead className="whitespace-nowrap">Motorista escala</TableHead>
                <TableHead className="whitespace-nowrap">Motorista fixo</TableHead>
                <TableHead className="whitespace-nowrap">Ajudante escala</TableHead>
                <TableHead className="whitespace-nowrap">Ajudante fixo</TableHead>
                <TableHead className="sticky right-0 z-20 min-w-56 border-l bg-card px-3 whitespace-nowrap">
                  Alerta
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                    Nenhum alerta para os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
              {alertas.map(({ v, lista }) => (
                <TableRow key={v.chave}>
                  <TableCell className="font-semibold">{v.placa}</TableCell>
                  <TableCell>{v.grupo}</TableCell>
                  <TableCell className="max-w-40 truncate">
                    {v.rotas
                      .map((r) => `${r.mapa || '—'}${r.data_entrega !== dataIso ? ' D-1' : ''}`)
                      .join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    {v.motorista_codigo
                      ? `${v.motorista_codigo} · ${nomeDe('motorista', v.motorista_codigo) || ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.base?.motorista_fixo_codigo
                      ? `${v.base.motorista_fixo_codigo} · ${v.base.motorista_fixo_nome ?? ''}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {v.ajudante_codigo
                      ? `${v.ajudante_codigo} · ${nomeDe('ajudante', v.ajudante_codigo) || ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.ajudante_referencia
                      ? `${v.ajudante_referencia} · ${nomeDe('ajudante', v.ajudante_referencia)}`
                      : '—'}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 min-w-56 border-l bg-card px-3 whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {lista.map((item) => (
                        <Badge
                          key={item}
                          variant="outline"
                          className={`whitespace-normal text-[10px] font-medium leading-tight ${
                            item.startsWith('Crítico:')
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
