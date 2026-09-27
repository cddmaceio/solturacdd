import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FileDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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
import { useEscalas } from '@/features/escala/api'
import {
  baldeAusencia,
  consolidarHistorico,
  pessoasForaDaEscala,
  useAusencias,
  useHistoricoAusencias,
  useRemoverAusencia,
  useSalvarAusencia,
} from '@/features/ausencias/api'
import { useColaboradores } from '@/features/equipes/api'
import { norm } from '@/lib/texto'
import { paraDmy } from '@/lib/datas'
import { baixarCsv } from '@/lib/csv'
import { TIPOS_AUSENCIA, type PapelEquipe, type TipoAusencia } from '@/types/dominio'

function corTipo(tipo: string): string {
  const n = norm(tipo)
  if (n.includes('FALTA')) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (n.includes('FOLGA')) return 'border-sky-200 bg-sky-50 text-sky-700'
  if (n.includes('FERIA')) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (n.includes('ATEST')) return 'border-violet-200 bg-violet-50 text-violet-700'
  if (n.includes('INSS')) return 'border-orange-200 bg-orange-50 text-orange-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function TelaAusencias() {
  const { pode } = useAuth()
  const podeRegistrar = pode('ausencias.registrar')
  const podeExportar = pode('exportacoes.gerar')
  const { dataIso } = useDataOperacao()

  const { data: colaboradores, isLoading: carregandoPessoas } = useColaboradores()
  const { data: escalas } = useEscalas(dataIso)
  const { data: registros } = useAusencias(dataIso)
  const { data: historico } = useHistoricoAusencias()
  const salvar = useSalvarAusencia(dataIso)
  const remover = useRemoverAusencia(dataIso)

  const [busca, setBusca] = useState('')
  const [papel, setPapel] = useState<PapelEquipe>('motorista')
  const [selecionado, setSelecionado] = useState<{ codigo: string; nome: string } | null>(null)
  const [tipo, setTipo] = useState<TipoAusencia>('Folga')
  const [justificativa, setJustificativa] = useState('')

  const motoristas = useMemo(
    () =>
      pessoasForaDaEscala(
        (colaboradores ?? []).filter((c) => c.tipo === 'motorista'),
        escalas ?? [],
        'motorista',
      ),
    [colaboradores, escalas],
  )
  const ajudantes = useMemo(
    () =>
      pessoasForaDaEscala(
        (colaboradores ?? []).filter((c) => c.tipo === 'ajudante'),
        escalas ?? [],
        'ajudante',
      ),
    [colaboradores, escalas],
  )

  const filtrar = (lista: typeof motoristas) => {
    const q = norm(busca)
    if (!q) return lista
    return lista.filter((p) => norm(`${p.codigo} ${p.nome} ${p.status}`).includes(q))
  }
  const listaPapel = papel === 'motorista' ? filtrar(motoristas) : filtrar(ajudantes)

  const registrosOrdenados = useMemo(() => [...(registros ?? [])], [registros])
  const resumo = useMemo(() => consolidarHistorico(historico ?? []), [historico])

  const contagens = useMemo(() => {
    const c = { faltas: 0, folgas: 0, ferias: 0, outros: 0 }
    for (const r of registros ?? []) {
      const b = baldeAusencia(r.tipo)
      if (b === 'faltas') c.faltas++
      else if (b === 'folgas') c.folgas++
      else if (b === 'ferias') c.ferias++
      else c.outros++
    }
    return c
  }, [registros])

  function selecionarPessoa(p: { codigo: string; nome: string; status: string }) {
    setSelecionado({ codigo: p.codigo, nome: p.nome })
    const st = norm(p.status)
    setTipo(st.includes('FERIA') ? 'Férias' : st.includes('INSS') ? 'INSS' : 'Folga')
    setJustificativa('')
  }

  function registrar() {
    if (!selecionado) {
      toast.error('Selecione primeiro um colaborador fora da escala')
      return
    }
    salvar.mutate(
      { papel, codigo: selecionado.codigo, tipo, justificativa },
      {
        onSuccess: () => {
          setSelecionado(null)
          setJustificativa('')
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  function exportarDia() {
    const linhas: (string | number | null)[][] = [
      ['Tipo', 'Código', 'Colaborador', 'Classificação', 'Justificativa'],
      ...registrosOrdenados.map((r) => [
        r.papel === 'motorista' ? 'Motorista' : 'Ajudante',
        r.codigo,
        r.nome,
        r.tipo,
        r.justificativa || '',
      ]),
    ]
    baixarCsv(`ausencias_${dataIso.replaceAll('-', '-')}.csv`, linhas)
  }

  function exportarHistorico() {
    const linhas: (string | number | null)[][] = [
      ['Tipo', 'Código', 'Colaborador', 'Faltas', 'Folgas', 'Férias', 'Atestado', 'INSS', 'Outros', 'Total', 'Último registro'],
      ...resumo.map((x) => [
        x.papel === 'motorista' ? 'Motorista' : 'Ajudante',
        x.codigo,
        x.nome,
        x.faltas,
        x.folgas,
        x.ferias,
        x.atestado,
        x.inss,
        x.outros,
        x.total,
        paraDmy(x.ultimo),
      ]),
    ]
    baixarCsv('historico_absenteismo.csv', linhas)
  }

  const kpis: { rotulo: string; valor: number; sub: string; cor: string }[] = [
    {
      rotulo: 'Fora da escala',
      valor: motoristas.length + ajudantes.length,
      sub: `${motoristas.length} motoristas · ${ajudantes.length} ajudantes`,
      cor: 'text-sky-700',
    },
    { rotulo: 'Faltas', valor: contagens.faltas, sub: 'registradas no dia', cor: 'text-rose-700' },
    { rotulo: 'Folgas', valor: contagens.folgas, sub: 'registradas no dia', cor: 'text-sky-700' },
    { rotulo: 'Férias', valor: contagens.ferias, sub: 'registradas no dia', cor: 'text-amber-700' },
    { rotulo: 'Outros', valor: contagens.outros, sub: 'atestado, INSS, treinamento etc.', cor: 'text-slate-700' },
  ]

  return (
    <div>
      <CabecalhoPagina
        titulo="Absenteísmo / Folgas"
        descricao="Equipe fora da escala da data selecionada. O registro fica vinculado à data e impede o escalamento no dia."
        acoes={
          podeExportar && (
            <>
              <Button variant="outline" size="sm" onClick={exportarDia}>
                <FileDown className="size-4" /> Registros do dia
              </Button>
              <Button variant="outline" size="sm" onClick={exportarHistorico}>
                <FileDown className="size-4" /> Histórico completo
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.rotulo} className="rounded-xl border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">{k.rotulo}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${k.cor}`}>{k.valor}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.55fr_.75fr]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b p-3">
            <div>
              <h3 className="text-sm font-semibold">Equipe fora da escala</h3>
              <p className="text-xs text-muted-foreground">
                Somente quem não está escalado no dia. Você decide se registra como folga, falta
                ou outro motivo.
              </p>
            </div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pessoa…"
              className="ml-auto h-8 w-56"
              aria-label="Buscar pessoa"
            />
          </div>

          <div className="flex gap-1 border-b px-3 py-2">
            {(['motorista', 'ajudante'] as const).map((p) => (
              <Button
                key={p}
                variant={papel === p ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setPapel(p)
                  setSelecionado(null)
                }}
                className="h-7 capitalize"
              >
                {p}s
              </Button>
            ))}
          </div>

          <div className="grid max-h-96 gap-2 overflow-auto p-3">
            {carregandoPessoas && (
              <p className="p-2 text-sm text-muted-foreground">Carregando equipe…</p>
            )}
            {!carregandoPessoas && listaPapel.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                Nenhuma pessoa disponível com este filtro.
              </p>
            )}
            {listaPapel.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <span className="w-10 text-sm font-bold tabular-nums">{p.codigo}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.status || 'Disponível'}
                    {p.sala ? ` · ${p.sala}` : ''}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7" disabled={!podeRegistrar} onClick={() => selecionarPessoa(p)}>
                  Registrar
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-3">
            <h3 className="text-sm font-semibold">Registrar ocorrência</h3>
            <p className="text-xs text-muted-foreground">
              O registro fica vinculado à data {paraDmy(dataIso)}.
            </p>
          </div>

          <div className="m-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
            {selecionado ? (
              <>
                <b>
                  {papel === 'motorista' ? 'Motorista' : 'Ajudante'} · {selecionado.codigo} ·{' '}
                  {selecionado.nome}
                </b>
              </>
            ) : (
              <span className="text-muted-foreground">
                Selecione uma pessoa na lista ao lado.
              </span>
            )}
          </div>

          <div className="grid gap-3 px-3 pb-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Classificação</label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAusencia)} disabled={!podeRegistrar}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_AUSENCIA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Justificativa / observação
              </label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex.: folga programada, falta sem justificativa, atestado entregue…"
                disabled={!podeRegistrar}
                className="min-h-24"
              />
            </div>
            <Button onClick={registrar} disabled={!podeRegistrar || salvar.isPending || !selecionado}>
              {salvar.isPending ? 'Salvando…' : 'Salvar registro'}
            </Button>
            {!podeRegistrar && (
              <p className="text-xs text-muted-foreground">
                Seu perfil não tem permissão para registrar ausências.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <strong className="text-sm">Registros de {paraDmy(dataIso)}</strong>
        </div>
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Justificativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrosOrdenados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    Nenhum registro de ausência ou folga para esta data.
                  </TableCell>
                </TableRow>
              )}
              {registrosOrdenados.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="capitalize">{r.papel}</TableCell>
                  <TableCell className="font-medium tabular-nums">{r.codigo}</TableCell>
                  <TableCell className="font-semibold">{r.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={corTipo(r.tipo)}>
                      {r.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={r.justificativa ?? ''}>
                    {r.justificativa || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Remover registro"
                      className="text-destructive hover:text-destructive"
                      disabled={!podeRegistrar}
                      onClick={() => remover.mutate(r.id, { onError: (e) => toast.error(e.message) })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <strong className="text-sm">Histórico acumulado de absenteísmo / folgas</strong>
          <span className="text-xs text-muted-foreground">
            Consolida todos os registros por colaborador.
          </span>
        </div>
        <div className="max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead className="text-right">Faltas</TableHead>
                <TableHead className="text-right">Folgas</TableHead>
                <TableHead className="text-right">Férias</TableHead>
                <TableHead className="text-right">Atestado</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">Outros</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Último registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-16 text-center text-muted-foreground">
                    Ainda não há histórico acumulado.
                  </TableCell>
                </TableRow>
              )}
              {resumo.map((x) => (
                <TableRow key={`${x.papel}-${x.codigo}`}>
                  <TableCell className="capitalize">{x.papel}</TableCell>
                  <TableCell className="font-medium tabular-nums">{x.codigo}</TableCell>
                  <TableCell className="font-semibold">{x.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.faltas}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.folgas}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.ferias}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.atestado}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.inss}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.outros}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{x.total}</TableCell>
                  <TableCell>{paraDmy(x.ultimo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
