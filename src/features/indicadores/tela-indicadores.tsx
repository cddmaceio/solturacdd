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
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { useDataOperacao } from '@/hooks/use-data-operacao'
import { useEscalaCompleta } from '@/features/escala/mutacoes'
import {
  disponibilidade,
  estatisticasVeiculo,
  fidelidade,
  rotuloTipoVeiculo,
} from '@/features/escala/montagem'
import { code, norm } from '@/lib/texto'
import { baixarCsv } from '@/lib/csv'
import { paraDmy } from '@/lib/datas'
import type { PapelEquipe } from '@/types/dominio'

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
      'Mapa(s)',
      'AS/Rota',
      'Motorista Cod',
      'Motorista',
      'Ajudante Cod',
      'Ajudante',
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
        v.rotas.map((r) => r.mapa).join(' | '),
        [...new Set(v.rotas.map((r) => r.as_rota).filter(Boolean))].join(' / '),
        v.motorista_codigo || '',
        nomeDe('motorista', v.motorista_codigo),
        v.ajudante_codigo || '',
        nomeDe('ajudante', v.ajudante_codigo),
        v.base?.motorista_fixo_codigo
          ? `${v.base.motorista_fixo_codigo} - ${v.base.motorista_fixo_nome ?? ''}`
          : '',
        v.ajudante_referencia
          ? `${v.ajudante_referencia} - ${nomeDe('ajudante', v.ajudante_referencia)}`
          : '',
        fidelidade(v, 'motorista'),
        fidelidade(v, 'ajudante'),
        stats.km.toFixed(2),
        stats.entregas,
        stats.ocupacaoPeso.toFixed(2),
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

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <strong className="text-sm">Alertas operacionais</strong>
          <span className="text-xs text-muted-foreground">
            {alertas.length} veículo(s) com alerta
          </span>
        </div>
        <div className="max-h-[calc(100dvh-540px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead>Mapa(s)</TableHead>
                <TableHead>Motorista escala</TableHead>
                <TableHead>Motorista fixo</TableHead>
                <TableHead>Ajudante escala</TableHead>
                <TableHead>Ajudante fixo</TableHead>
                <TableHead>Alerta</TableHead>
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
                  <TableCell className="text-amber-700">{lista.join(' · ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
