import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  ClipboardList,
  Printer,
  RotateCcw,
  Search,
  Truck,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import {
  AreaImpressao,
  DialogoImpressao,
  type ModoImpressao,
} from '@/features/escala/impressao'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { useDataOperacao } from '@/hooks/use-data-operacao'
import { useAusencias } from '@/features/ausencias/api'
import { usePcdMapas } from '@/features/pcd/api'
import { opcoesSala } from '@/features/escala/montagem'
import {
  useEscalaCompleta,
  useAtribuirPessoa,
  useAtualizarLinha,
  useGarantirEscala,
  useLimparSlot,
  useRestaurarDia,
  useRestaurarVeiculo,
} from '@/features/escala/mutacoes'
import {
  disponibilidade,
  ehMapaCritico,
  estatisticasVeiculo,
  fidelidade,
  mapaPendencia,
  paraLinhasPersistencia,
  montarEscala,
  rotuloTipoVeiculo,
  type VeiculoEscala,
} from '@/features/escala/montagem'
import {
  classeClassificacao,
  classeFaseMpd,
  pendenciaAnterior,
  ehZumpy,
  rotuloClassificacao,
  rotuloFaseMpd,
} from '@/features/pcd/lib'
import { code, norm } from '@/lib/texto'
import { difDiasIso, paraDmy } from '@/lib/datas'
import type { Colaborador, PapelEquipe, PapelSlot } from '@/types/dominio'

// ---------------------------------------------------------------------------
// Drag & drop
// ---------------------------------------------------------------------------

/** Colunas do quadro (cabeçalho e linhas usam o mesmo template para alinhar). */
const COLUNAS_QUADRO =
  'grid grid-cols-[140px_minmax(255px,1.15fr)_minmax(205px,0.95fr)_minmax(205px,0.9fr)_minmax(260px,1fr)_110px_160px]'

type CargaArrasto = {
  papel: PapelEquipe
  codigo: string
  nome?: string
  origem: string | null
  origemSlot: PapelSlot | null
}

function papelPessoaDoSlot(slot: PapelSlot): PapelEquipe {
  return slot === 'motorista' ? 'motorista' : 'ajudante'
}

function PessoaArrastavel({
  papel,
  codigo,
  nome,
  origem,
  origemSlot,
  conteudo,
  className,
}: {
  papel: PapelEquipe
  codigo: string
  nome?: string
  origem: string | null
  origemSlot: PapelSlot | null
  conteudo: React.ReactNode
  className?: string
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pessoa:${papel}:${codigo}:${origem ?? 'pool'}:${origemSlot ?? 'pool'}`,
    data: { papel, codigo, nome, origem, origemSlot } satisfies CargaArrasto,
    disabled: !codigo,
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={className}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {conteudo}
    </div>
  )
}

function SlotAlocacao({
  papel,
  placa,
  children,
  onAbrir,
  ativo,
  compacto = false,
}: {
  papel: PapelSlot
  placa: string
  children: React.ReactNode
  onAbrir: () => void
  ativo: boolean
  compacto?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${papel}:${placa}` })
  return (
    <div
      ref={setNodeRef}
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={`${compacto ? 'min-h-[46px] p-2' : 'min-h-[68px] p-2.5'} cursor-pointer rounded-lg border transition-[background-color,border-color,box-shadow] ${
        isOver
          ? 'border-sky-400 bg-sky-50 shadow-[0_0_0_2px_rgba(14,165,233,0.14)]'
          : ativo
            ? 'border-slate-200 bg-white hover:border-sky-200'
            : 'border-dashed border-slate-300 bg-slate-50/70 hover:border-sky-300 hover:bg-sky-50/40'
      }`}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function CartaoKpi({
  rotulo,
  valor,
  sub,
  cor,
  onClick,
  ativo = false,
  Icone,
  progresso,
}: {
  rotulo: string
  valor: number | string
  sub: string
  cor?: string
  onClick?: () => void
  ativo?: boolean
  Icone: React.ComponentType<{ className?: string }>
  progresso?: number | null
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick ? ativo : undefined}
      className={`group relative min-w-0 px-3 py-3 text-left transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500' : 'cursor-default'} ${ativo ? 'bg-sky-50/80' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        <Icone className={`size-3.5 shrink-0 ${cor ?? 'text-slate-500'}`} />
        <span className="truncate">{rotulo}</span>
      </div>
      <div className={`mt-1 text-[19px] font-bold leading-none tabular-nums ${cor ?? 'text-foreground'}`}>
        {valor}
      </div>
      <div className="mt-1.5 min-h-7 text-[10px] leading-snug text-muted-foreground">{sub}</div>
      {progresso != null && (
        <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-[width] ${progresso < 70 ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.max(0, Math.min(100, progresso))}%` }}
          />
          <span className="absolute inset-y-0 left-[70%] w-px bg-slate-600/70" title="Meta: 70%" />
        </div>
      )}
      {ativo && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-600" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function TelaEscala() {
  const { pode } = useAuth()
  const podeEditar = pode('escala.editar')
  const { dataIso, definirData } = useDataOperacao()
  const { dados, carregando, erro } = useEscalaCompleta(dataIso)
  const { data: mapas } = usePcdMapas(dataIso)
  const { data: ausencias } = useAusencias(dataIso)

  const garantir = useGarantirEscala(dataIso)
  const atribuir = useAtribuirPessoa(dataIso)
  const limpar = useLimparSlot(dataIso)
  const atualizar = useAtualizarLinha(dataIso)
  const restaurarVeiculo = useRestaurarVeiculo(dataIso)
  const restaurarDia = useRestaurarDia(dataIso)

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const [busca, setBusca] = useState('')
  const [salaFiltro, setSalaFiltro] = useState('ALL')
  const [statusFiltro, setStatusFiltro] = useState('ALL')
  const [dispFiltro, setDispFiltro] = useState('ALL')
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([])
  const [soComMapa, setSoComMapa] = useState(false)
  const [papelPool, setPapelPool] = useState<PapelEquipe>('motorista')
  const [buscaPool, setBuscaPool] = useState('')
  const [mostrarOcupados, setMostrarOcupados] = useState(false)
  const [arrastoAtivo, setArrastoAtivo] = useState<CargaArrasto | null>(null)
  const [modal, setModal] = useState<{ placa: string; papel: PapelSlot } | null>(null)
  const [buscaModal, setBuscaModal] = useState('')
  const [modoChapa, setModoChapa] = useState(false)
  const [chapaCodigo, setChapaCodigo] = useState('')
  const [chapaNome, setChapaNome] = useState('')
  const [dialogoImpressao, setDialogoImpressao] = useState(false)
  const [impressao, setImpressao] = useState<{ modo: ModoImpressao; selo: number } | null>(null)
  const sequenciaImpressao = useRef(0)

  // Dispara a impressão e restaura a tela quando o diálogo do navegador fecha.
  useEffect(() => {
    if (!impressao) return
    const classe = impressao.modo === 'salas' ? 'print-rooms' : 'print-all'
    document.body.classList.add('printing', classe)
    // Aguarda a animação de fechamento do diálogo terminar antes do snapshot.
    const timer = setTimeout(() => window.print(), 300)
    const aoTerminar = () => {
      document.body.classList.remove('printing', 'print-all', 'print-rooms')
      setImpressao(null)
    }
    window.addEventListener('afterprint', aoTerminar)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', aoTerminar)
      document.body.classList.remove('printing', 'print-all', 'print-rooms')
    }
  }, [impressao])

  // Congela a escala da data: cria as linhas ainda ausentes (uma única vez por estado).
  const garantidoRef = useRef<string | null>(null)
  const { mutate: garantirMutate } = garantir
  useEffect(() => {
    if (!dados || !podeEditar) return
    const selo = `${dataIso}|${dados.linhasSalvas.length}|${dados.veiculos.length}`
    if (garantidoRef.current === selo) return
    garantidoRef.current = selo
    const faltantes = dados.veiculos.filter(
      (v) => !dados.linhasSalvas.some((l) => l.veiculo_placa === v.chave),
    )
    if (faltantes.length) {
      garantirMutate({
        veiculos: dados.veiculos,
        pessoas: dados.pessoas,
        linhasSalvas: dados.linhasSalvas,
      })
    }
  }, [dados, dataIso, podeEditar, garantirMutate])

  const veiculos = useMemo(() => dados?.veiculos ?? [], [dados])
  const pessoas = useMemo(() => dados?.pessoas ?? [], [dados])
  const salvas = useMemo(() => dados?.linhasSalvas ?? [], [dados])

  const ausentes = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of ausencias ?? []) m.set(`${a.papel}|${code(a.codigo)}`, a.tipo)
    return m
  }, [ausencias])

  const nomeDe = (papel: PapelEquipe, codigo: string): string | null => {
    const c = code(codigo)
    if (!c) return null
    const vivo = pessoas.find((p) => p.tipo === papel && code(p.codigo) === c)
    if (vivo) return vivo.nome
    for (const l of salvas) {
      const snapshots: [string | null, string | null][] = papel === 'motorista'
        ? [[l.motorista_codigo, l.motorista_nome]]
        : [
            [l.ajudante_codigo, l.ajudante_nome],
            [l.ajudante2_codigo, l.ajudante2_nome],
            [l.chapa_codigo, l.chapa_nome],
          ]
      for (const [codigoLinha, snapshot] of snapshots) {
        if (code(codigoLinha) === c && snapshot) return snapshot
      }
    }
    return ''
  }

  const localDe = (papel: PapelEquipe, codigo: string): { placa: string; slot: PapelSlot } | null => {
    const c = code(codigo)
    if (!c) return null
    for (const v of veiculos) {
      const slots: PapelSlot[] = papel === 'motorista'
        ? ['motorista']
        : ['ajudante', 'ajudante2', 'chapa']
      const slot = slots.find((s) => {
        const valor = s === 'motorista' ? v.motorista_codigo
          : s === 'ajudante' ? v.ajudante_codigo
            : s === 'ajudante2' ? v.ajudante2_codigo
              : v.chapa_codigo
        return code(valor) === c
      })
      if (slot) return { placa: v.chave, slot }
    }
    return null
  }

  const escaladoEm = (papel: PapelEquipe, codigo: string): string | null => {
    return localDe(papel, codigo)?.placa ?? null
  }

  const pessoasDoPapel = (papel: PapelEquipe): Colaborador[] =>
    pessoas.filter((p) => p.tipo === papel && !(papel === 'ajudante' && ['800', '801'].includes(code(p.codigo))))

  const disponivelNaBase = (p: Colaborador): boolean => {
    const n = norm(p.status)
    return !n || n.includes('DISPON')
  }

  // ------------------------------------------------------------------ KPIs
  const kpis = useMemo(() => {
    const d0 = (mapas ?? []).filter((m) => m.data_entrega === dataIso)
    const pendencias = (mapas ?? []).filter((m) => pendenciaAnterior(m, dataIso))
    const fixos = veiculos.filter((v) => !v.isSpot)
    const carregados = veiculos.filter((v) => v.carregado)
    const comFixo = carregados.filter(
      (v) =>
        code(v.base?.motorista_fixo_codigo) &&
        code(v.base?.motorista_fixo_codigo) !== '800' &&
        norm(v.base?.motorista_fixo_nome) !== 'PARADO',
    )
    const fok = comFixo.filter((v) => fidelidade(v, 'motorista') === 'ok').length
    const fixosAj = carregados.filter(
      (v) => code(v.ajudante_referencia) && code(v.ajudante_referencia) !== '800',
    )
    const hok = fixosAj.filter((v) => fidelidade(v, 'ajudante') === 'ok').length
    const pendentes = carregados.filter((v) => !code(v.motorista_codigo)).length
    const indisponiveis = fixos.filter((v) => disponibilidade(v) === 'UNAVAILABLE').length
    const semMapa = fixos.filter((v) => !v.carregado).length
    const freteiroD0 = d0.filter((m) => norm(m.carga) === 'FRETEIRO').length
    const recD0 = d0.filter(
      (m) => /^REC\d+$/.test(norm(m.placa)) || norm(m.carga_atual).includes('RECARGA'),
    ).length
    const zumpyD0 = d0.filter(ehZumpy).length
    const fixoD0 = fixos.filter((v) => v.rotas.some((r) => r.data_entrega === dataIso)).length
    return {
      d0: d0.length,
      pendencias: pendencias.length,
      fixos: fixos.length,
      fixoD0,
      freteiroD0,
      recD0,
      zumpyD0,
      fidMotorista: comFixo.length ? Math.round((fok / comFixo.length) * 100) : null,
      fok,
      totalFixo: comFixo.length,
      fidAjudante: fixosAj.length ? Math.round((hok / fixosAj.length) * 100) : null,
      hok,
      totalAjudante: fixosAj.length,
      pendentes,
      indisponiveis,
      semMapa,
    }
  }, [mapas, dataIso, veiculos])

  // --------------------------------------------------------------- Filtros
  const visiveis = useMemo(() => {
    const q = norm(busca)
    return veiculos.filter((v) => {
      if (soComMapa && !v.carregado) return false
      if (salaFiltro !== 'ALL' && v.grupo !== salaFiltro) return false
      const disp = disponibilidade(v)
      if (dispFiltro === 'AVAILABLE' && disp !== 'AVAILABLE') return false
      if (dispFiltro === 'UNAVAILABLE' && disp !== 'UNAVAILABLE') return false
      const fid = fidelidade(v, 'motorista')
      if (statusFiltro === 'DIVERGENT' && fid !== 'no') return false
      if (statusFiltro === 'FIDELIZED' && fid !== 'ok') return false
      if (statusFiltro === 'PENDING' && (!v.carregado || code(v.motorista_codigo))) return false
      if (statusFiltro === 'NO_MAP' && (v.isSpot || v.carregado)) return false
      if (tiposSelecionados.length && !tiposSelecionados.includes(rotuloTipoVeiculo(v))) return false
      if (q) {
        const texto = norm(
          [
            v.placa,
            v.base?.frota,
            v.base?.tipo_veiculo,
            v.base?.disponibilidade,
            v.base?.motorista_fixo_nome,
            nomeDe('ajudante', v.ajudante2_codigo),
            v.chapa_nome,
            ...v.rotas.flatMap((r) => [r.mapa, r.regiao, r.cidades]),
            nomeDe('motorista', v.motorista_codigo),
            nomeDe('ajudante', v.ajudante_codigo),
          ]
            .filter(Boolean)
            .join(' '),
        )
        if (!texto.includes(q)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculos, busca, salaFiltro, statusFiltro, dispFiltro, soComMapa, tiposSelecionados, salvas])

  const pool = useMemo(() => {
    const q = norm(buscaPool)
    const lista = pessoasDoPapel(papelPool).filter((p) => {
      if (!disponivelNaBase(p)) return false
      const esc = escaladoEm(papelPool, p.codigo)
      const ausente = ausentes.has(`${papelPool}|${code(p.codigo)}`)
      if ((esc || ausente) && !mostrarOcupados) return false
      if (q && !norm(`${p.codigo} ${p.nome} ${p.status}`).includes(q)) return false
      return true
    })
    return [...lista].sort(
      (a, b) =>
        Number(ausentes.has(`${papelPool}|${code(a.codigo)}`)) -
          Number(ausentes.has(`${papelPool}|${code(b.codigo)}`)) ||
        Number(Boolean(escaladoEm(papelPool, a.codigo))) -
          Number(Boolean(escaladoEm(papelPool, b.codigo))) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, papelPool, buscaPool, mostrarOcupados, veiculos, ausentes])

  const resumoPool = useMemo(() => {
    const elegiveis = pessoasDoPapel(papelPool).filter(disponivelNaBase)
    const escalados = elegiveis.filter((p) => escaladoEm(papelPool, p.codigo))
    const ausentesNoDia = elegiveis.filter((p) => ausentes.has(`${papelPool}|${code(p.codigo)}`))
    return {
      disponiveis: elegiveis.filter(
        (p) => !escaladoEm(papelPool, p.codigo) && !ausentes.has(`${papelPool}|${code(p.codigo)}`),
      ).length,
      escalados: escalados.length,
      ausentes: ausentesNoDia.length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, papelPool, veiculos, ausentes])

  const filtrosAtivos =
    Number(Boolean(busca.trim())) +
    Number(salaFiltro !== 'ALL') +
    Number(statusFiltro !== 'ALL') +
    Number(dispFiltro !== 'ALL') +
    Number(soComMapa) +
    Number(tiposSelecionados.length > 0)

  function limparFiltros() {
    setBusca('')
    setSalaFiltro('ALL')
    setStatusFiltro('ALL')
    setDispFiltro('ALL')
    setSoComMapa(false)
    setTiposSelecionados([])
  }

  const salas = useMemo(() => opcoesSala(pessoas, salvas), [pessoas, salvas])
  const tiposDisponiveis = useMemo(
    () => [...new Set(veiculos.map(rotuloTipoVeiculo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [veiculos],
  )

  // ------------------------------------------------------------ Interações
  function aoSoltar(evento: DragEndEvent) {
    const carga = evento.active.data.current as CargaArrasto | undefined
    const alvo = evento.over?.id
    if (!carga || !alvo) return
    if (!podeEditar) {
      toast.error('Seu perfil não tem permissão para editar a escala')
      return
    }
    if (alvo === 'pool') {
      if (carga.origem && carga.origemSlot) {
        limpar.mutate({ placa: carga.origem, slot: carga.origemSlot })
      }
      return
    }
    const [tipo, papelAlvo, placa] = String(alvo).split(':')
    if (tipo !== 'slot' || !papelAlvo || !placa) return
    const slot = papelAlvo as PapelSlot
    if (!['motorista', 'ajudante', 'ajudante2', 'chapa'].includes(slot) || papelPessoaDoSlot(slot) !== carga.papel) {
      toast.error(papelPessoaDoSlot(slot) === 'motorista' ? 'Este campo aceita motoristas' : 'Este campo aceita ajudantes')
      return
    }
    atribuir.mutate({
      placa,
      slot,
      codigo: carga.codigo,
      nome: carga.nome,
      origem: carga.origem,
      origemSlot: carga.origemSlot,
      pessoas,
    })
  }

  function aoIniciarArrasto(evento: DragStartEvent) {
    setArrastoAtivo(evento.active.data.current as CargaArrasto | null)
  }

  function aoTerminarArrasto(evento: DragEndEvent) {
    aoSoltar(evento)
    setArrastoAtivo(null)
  }

  function abrirModal(placa: string, papel: PapelSlot) {
    setModal({ placa, papel })
    const v = veiculos.find((item) => item.chave === placa)
    const temChapa = Boolean(v?.chapa_codigo || v?.chapa_nome)
    setModoChapa(papel === 'ajudante2' && !v?.ajudante2_codigo && temChapa)
    if ((papel === 'chapa' || papel === 'ajudante2') && v) {
      setChapaCodigo(v.chapa_codigo)
      setChapaNome(v.chapa_nome)
    }
    setBuscaModal('')
  }

  function selecionarNoModal(codigo: string | null) {
    if (!modal) return
    if (codigo === null) {
      limpar.mutate({ placa: modal.placa, slot: modal.papel })
    } else {
      atribuir.mutate({
        placa: modal.placa,
        slot: modal.papel,
        codigo,
        origem: escaladoEm(papelPessoaDoSlot(modal.papel), codigo),
        origemSlot: localDe(papelPessoaDoSlot(modal.papel), codigo)?.slot,
        pessoas,
      })
    }
    setModal(null)
    setBuscaModal('')
    setModoChapa(false)
  }

  function salvarChapa() {
    if (!modal || (modal.papel !== 'chapa' && !(modal.papel === 'ajudante2' && modoChapa))) return
    const nome = chapaNome.trim()
    const codigo = code(chapaCodigo)
    if (!nome && !codigo) {
      toast.error('Informe o nome ou código do Chapa/PX')
      return
    }
    atribuir.mutate({
      placa: modal.placa,
      slot: 'chapa',
      codigo,
      nome,
      pessoas,
    })
    setModal(null)
    setModoChapa(false)
  }

  function restaurar(v: VeiculoEscala) {
    if (!dados) return
    const recomputada = montarEscala({
      dataIso,
      veiculos: dados.entradas.veiculosBase,
      mapas: dados.entradas.mapas,
      pessoas: dados.entradas.pessoas,
      equipes: dados.entradas.equipes,
      salvas: salvas.filter((l) => l.veiculo_placa !== v.chave),
    })
    const linha = recomputada.find((r) => r.chave === v.chave)
    if (!linha) return
    restaurarVeiculo.mutate({
      placa: v.chave,
      dados: paraLinhasPersistencia([linha], dataIso, pessoas)[0],
    })
  }

  function restaurarTudo() {
    if (!dados) return
    if (!confirm('Remover todos os ajustes desta data e voltar para a referência inicial?')) return
    restaurarDia.mutate(dados.entradas)
  }

  const pessoasModal = useMemo(() => {
    if (!modal || modal.papel === 'chapa' || (modal.papel === 'ajudante2' && modoChapa)) return []
    const q = norm(buscaModal)
    const papel = papelPessoaDoSlot(modal.papel)
    return pessoasDoPapel(papel).filter((p) => {
      if (!disponivelNaBase(p)) return false
      if (ausentes.has(`${papel}|${code(p.codigo)}`)) return false
      if (q && !norm(`${p.codigo} ${p.nome}`).includes(q)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, modoChapa, buscaModal, pessoas, ausentes])

  if (carregando) {
    return (
      <div className="p-8 text-center text-muted-foreground">Carregando escala…</div>
    )
  }
  if (erro || !dados) {
    return (
      <div className="p-8 text-center text-destructive">
        {(erro as Error)?.message ?? 'Não foi possível carregar a escala'}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={aoIniciarArrasto}
      onDragEnd={aoTerminarArrasto}
      onDragCancel={() => setArrastoAtivo(null)}
    >
      <div>
        <CabecalhoPagina
          titulo="Escala do Dia"
          descricao="Equipe por veículo com mapa do dia, pernoite e fidelização da frota fixa."
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
                placeholder="Buscar placa, mapa, região…"
                className="h-9 w-60"
                aria-label="Buscar veículo"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogoImpressao(true)}
              >
                <Printer className="size-4" /> Imprimir
              </Button>
              {podeEditar && (
                <Button variant="outline" size="sm" onClick={restaurarTudo} disabled={restaurarDia.isPending}>
                  <RotateCcw className="size-4" /> Restaurar dia
                </Button>
              )}
            </>
          }
        />

        {/* KPIs */}
        <div className="mb-4 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 xl:grid-cols-8 xl:divide-x">
          <CartaoKpi Icone={ClipboardList} rotulo="Mapas D0" valor={kpis.d0} sub={`${paraDmy(dataIso)}${kpis.recD0 ? ` · ${kpis.recD0} REC` : ''}${kpis.zumpyD0 ? ` · ${kpis.zumpyD0} Zumpy` : ''}`} cor="text-sky-700" />
          <CartaoKpi Icone={AlertTriangle} rotulo="Pendências D-1+" valor={kpis.pendencias} sub="mapas anteriores em aberto" cor="text-amber-700" />
          <CartaoKpi Icone={Truck} rotulo="Frota fixa" valor={kpis.fixos} sub={`${kpis.fixoD0} com mapa D0 · ${kpis.freteiroD0} spot`} />
          <CartaoKpi
            Icone={UserRoundCheck}
            rotulo="Fidelização Frota"
            valor={kpis.fidMotorista != null ? `${kpis.fidMotorista}%` : '—'}
            sub={`${kpis.fok}/${kpis.totalFixo} no carro fixo · meta 70%`}
            cor={kpis.fidMotorista != null && kpis.fidMotorista < 70 ? 'text-rose-700' : 'text-emerald-700'}
            onClick={() => setStatusFiltro(statusFiltro === 'DIVERGENT' ? 'ALL' : 'DIVERGENT')}
            ativo={statusFiltro === 'DIVERGENT'}
            progresso={kpis.fidMotorista}
          />
          <CartaoKpi Icone={Users} rotulo="Fidelização ajudante" valor={kpis.fidAjudante != null ? `${kpis.fidAjudante}%` : '—'} sub={`${kpis.hok}/${kpis.totalAjudante} com referência`} cor="text-emerald-700" />
          <CartaoKpi Icone={UserRoundX} rotulo="Motorista pendente" valor={kpis.pendentes} sub="com carga e sem motorista" cor="text-rose-700" onClick={() => setStatusFiltro(statusFiltro === 'PENDING' ? 'ALL' : 'PENDING')} ativo={statusFiltro === 'PENDING'} />
          <CartaoKpi Icone={CircleHelp} rotulo="Sem mapa" valor={kpis.semMapa} sub="frota fixa sem D0 ou pendência" cor="text-amber-700" onClick={() => setStatusFiltro(statusFiltro === 'NO_MAP' ? 'ALL' : 'NO_MAP')} ativo={statusFiltro === 'NO_MAP'} />
          <CartaoKpi Icone={AlertTriangle} rotulo="Indisponíveis" valor={kpis.indisponiveis} sub="alertas na base de frota" cor="text-rose-700" />
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
          <Select value={salaFiltro} onValueChange={setSalaFiltro}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as salas</SelectItem>
              {salas.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              <SelectItem value="DIVERGENT">Divergentes do fixo</SelectItem>
              <SelectItem value="FIDELIZED">Fidelizados</SelectItem>
              <SelectItem value="PENDING">Pendentes (sem motorista)</SelectItem>
              <SelectItem value="NO_MAP">Sem mapa D0 ou pendência</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dispFiltro} onValueChange={setDispFiltro}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Disponibilidade: todas</SelectItem>
              <SelectItem value="AVAILABLE">Disponíveis</SelectItem>
              <SelectItem value="UNAVAILABLE">Indisponíveis</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-1" aria-label="Filtrar por tipo de veículo">
            <span className="mr-1 text-[11px] font-semibold text-muted-foreground">Tipo:</span>
            {tiposDisponiveis.map((tipo) => {
              const ativo = tiposSelecionados.includes(tipo)
              return (
                <Button
                  key={tipo}
                  type="button"
                  variant={ativo ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  aria-pressed={ativo}
                  onClick={() => setTiposSelecionados((atuais) =>
                    ativo ? atuais.filter((item) => item !== tipo) : [...atuais, tipo],
                  )}
                >
                  {tipo}
                </Button>
              )
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={soComMapa} onCheckedChange={(v) => setSoComMapa(v === true)} />
            Somente com mapa D0
          </label>
          {filtrosAtivos > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-sky-700" onClick={limparFiltros}>
              <X className="size-3.5" /> Limpar filtros ({filtrosAtivos})
            </Button>
          )}
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            <strong className="text-foreground">{visiveis.length}</strong> de {veiculos.length} veículos
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Quadro */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="max-h-[calc(100dvh-390px)] min-h-64 overflow-auto">
              {/* Largura mínima única: cabeçalho e linhas compartilham o mesmo
                  box, garantindo colunas alinhadas com rolagem horizontal. */}
              <div className="min-w-[1400px]">
                <div
                  className={`sticky top-0 z-10 ${COLUNAS_QUADRO} gap-2 border-b border-slate-200 bg-slate-100/95 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-600 backdrop-blur`}
                >
                  <div>Veículo</div>
                  <div>Mapa / carga</div>
                  <div>Rota</div>
                  <div>Motorista</div>
                  <div>Equipe de ajudantes</div>
                  <div>Sala</div>
                  <div>Observação</div>
                </div>
                {visiveis.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum veículo encontrado com os filtros atuais.
                  </p>
                )}
                {visiveis.map((v) => (
                  <LinhaVeiculo
                    key={v.chave}
                    v={v}
                    dataIso={dataIso}
                    salas={salas}
                    nomeDe={nomeDe}
                    statusDe={(papel, codigo) =>
                      pessoas.find((p) => p.tipo === papel && code(p.codigo) === code(codigo))?.status ?? ''
                    }
                    podeEditar={podeEditar}
                    onAbrirModal={(papel) => abrirModal(v.chave, papel)}
                    onGrupo={(grupo) => atualizar.mutate({ placa: v.chave, patch: { grupo } })}
                    onObservacao={(observacao) => atualizar.mutate({ placa: v.chave, patch: { observacao } })}
                    onRestaurar={() => restaurar(v)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Pool de pessoas */}
          <div className="rounded-xl border bg-card">
            <div className="border-b p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight">Equipe disponível</h3>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{resumoPool.disponiveis} disp.</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Arraste para o slot ou clique no slot para escolher.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {resumoPool.escalados} escalados <span className="px-1 text-slate-300">·</span> {resumoPool.ausentes} ausentes
              </p>
            </div>
            <div className="flex gap-1 border-b px-3 py-2">
              {(['motorista', 'ajudante'] as const).map((p) => (
                <Button
                  key={p}
                  variant={papelPool === p ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 capitalize"
                  onClick={() => setPapelPool(p)}
                >
                  {p}s
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${papelPool === p ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {pessoasDoPapel(p).filter((pessoa) =>
                      disponivelNaBase(pessoa) &&
                      !escaladoEm(p, pessoa.codigo) &&
                      !ausentes.has(`${p}|${code(pessoa.codigo)}`),
                    ).length}
                  </span>
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                value={buscaPool}
                onChange={(e) => setBuscaPool(e.target.value)}
                placeholder="Buscar pessoa…"
                className="h-8"
              />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={mostrarOcupados} onCheckedChange={(v) => setMostrarOcupados(v === true)} />
              Mostrar escalados/ausentes
            </label>
            <div className="max-h-[calc(100dvh-480px)] min-h-40 space-y-2 overflow-auto p-3">
              <AreaSoltarPool mostrarDica={arrastoAtivo?.origem != null}>
                {pool.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma pessoa disponível com este filtro.</p>
                )}
                {pool.map((p) => {
                  const codigo = code(p.codigo)
                  const esc = escaladoEm(papelPool, codigo)
                  const slotEscalado = localDe(papelPool, codigo)?.slot ?? null
                  const tipoAusencia = ausentes.get(`${papelPool}|${codigo}`)
                  return (
                    <PessoaArrastavel
                      key={p.id}
                      papel={papelPool}
                      codigo={codigo}
                      nome={p.nome}
                      origem={esc}
                      origemSlot={slotEscalado}
                      className={`rounded-lg border bg-background px-2.5 py-2 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition hover:-translate-y-px hover:shadow-sm ${tipoAusencia ? 'border-rose-200 bg-rose-50/70' : esc ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 hover:border-sky-200'}`}
                      conteudo={
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 min-w-9 place-items-center rounded-md bg-slate-100 px-1 text-[11px] font-bold tabular-nums text-slate-700">{codigo}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold">{p.nome}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {tipoAusencia
                                ? `${tipoAusencia} · registrado no dia`
                                : esc
                                  ? `escalado em ${esc}`
                                  : p.status || 'Disponível'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold tracking-wide ${tipoAusencia ? 'text-rose-700' : esc ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {tipoAusencia ? 'AUSENTE' : esc ? `→ ${esc}` : 'DISP.'}
                          </span>
                        </div>
                      }
                    />
                  )
                })}
              </AreaSoltarPool>
            </div>
          </div>
        </div>

        {/* Modal de seleção */}
        <Dialog open={Boolean(modal)} onOpenChange={(aberto) => !aberto && setModal(null)}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {modal?.papel === 'ajudante2' && modoChapa
                  ? 'Cadastrar Chapa / PX'
                  : modal?.papel === 'motorista'
                  ? 'Selecionar motorista'
                  : modal?.papel === 'ajudante2'
                    ? 'Selecionar segundo ajudante'
                    : modal?.papel === 'chapa'
                      ? 'Cadastrar Chapa / PX'
                      : 'Selecionar ajudante'}
                {modal ? ` · ${modal.placa}` : ''}
              </DialogTitle>
            </DialogHeader>
            {modal?.papel === 'chapa' || (modal?.papel === 'ajudante2' && modoChapa) ? (
              <>
                <p className="text-xs text-muted-foreground">Chapa/PX é um trabalhador avulso. Informe o nome e, se houver, o código.</p>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="grid min-w-0 gap-1.5">
                    <label htmlFor="chapa-codigo" className="text-xs font-medium">Código</label>
                    <Input id="chapa-codigo" value={chapaCodigo} onChange={(e) => setChapaCodigo(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <label htmlFor="chapa-nome" className="text-xs font-medium">Nome</label>
                    <Input id="chapa-nome" autoFocus value={chapaNome} onChange={(e) => setChapaNome(e.target.value)} placeholder="Nome do Chapa/PX" />
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="w-full sm:w-auto" variant="outline" onClick={() => selecionarNoModal(null)}>Limpar</Button>
                    {modal.papel === 'ajudante2' && (
                      <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setModoChapa(false)}>Ajudante da base</Button>
                    )}
                  </div>
                  <Button className="w-full sm:w-auto" onClick={salvarChapa}>Salvar</Button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-lg border border-dashed bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                  onClick={() => selecionarNoModal(null)}
                >
                  — Deixar sem {modal?.papel === 'motorista' ? 'motorista' : modal?.papel === 'ajudante2' ? 'segundo ajudante' : 'ajudante'}
                  <div className="text-xs font-normal text-muted-foreground">Remove a pessoa atual deste slot</div>
                </button>
                <Input
                  autoFocus
                  value={buscaModal}
                  onChange={(e) => setBuscaModal(e.target.value)}
                  placeholder="Buscar por código ou nome…"
                />
                <div className="max-h-80 space-y-1 overflow-auto">
                  {pessoasModal.map((p) => {
                    const codigo = code(p.codigo)
                    const papelPessoa = papelPessoaDoSlot(modal!.papel)
                    const esc = escaladoEm(papelPessoa, codigo)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/70"
                        onClick={() => selecionarNoModal(codigo)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 min-w-10 place-items-center rounded-md bg-slate-100 px-1 text-[11px] font-bold tabular-nums text-slate-700">{codigo}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nome}</span>
                          {esc && <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">Escalado</Badge>}
                        </div>
                        <div className="mt-1 pl-12 text-[11px] text-muted-foreground">
                          {p.status ? `${p.status} · ` : ''}{esc ? `Já escalado em ${esc}` : 'Disponível'}
                        </div>
                      </button>
                    )
                  })}
                  {pessoasModal.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhuma pessoa disponível.</p>}
                </div>
                {modal?.papel === 'ajudante2' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start border-dashed"
                    onClick={() => setModoChapa(true)}
                  >
                    + Usar Chapa/PX neste slot
                  </Button>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Impressão da escala */}
        <DialogoImpressao
          aberto={dialogoImpressao}
          onFechar={() => setDialogoImpressao(false)}
          aoEscolher={(modo) => {
            setDialogoImpressao(false)
            setImpressao({ modo, selo: ++sequenciaImpressao.current })
          }}
          dataIso={dataIso}
        />
        {impressao && (
          <AreaImpressao
            modo={impressao.modo}
            veiculos={veiculos}
            dataIso={dataIso}
            nomeDe={nomeDe}
          />
        )}
      </div>
    </DndContext>
  )
}

function AreaSoltarPool({ children, mostrarDica }: { children: React.ReactNode; mostrarDica: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-16 rounded-lg border border-dashed p-1 transition-colors ${isOver ? 'border-sky-500 bg-sky-50' : mostrarDica ? 'border-slate-300 bg-slate-50/70' : 'border-transparent'}`}
    >
      {mostrarDica && (
        <div className={`mb-2 flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors ${isOver ? 'border-sky-300 bg-sky-100 text-sky-800' : 'border-slate-200 bg-white text-slate-600'}`}>
          <ArrowLeftRight className="size-3.5" />
          Solte aqui para remover da escala
        </div>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Linha do veículo
// ---------------------------------------------------------------------------

function LinhaVeiculo({
  v,
  dataIso,
  salas,
  nomeDe,
  statusDe,
  podeEditar,
  onAbrirModal,
  onGrupo,
  onObservacao,
  onRestaurar,
}: {
  v: VeiculoEscala
  dataIso: string
  salas: string[]
  nomeDe: (papel: PapelEquipe, codigo: string) => string | null
  statusDe: (papel: PapelEquipe, codigo: string) => string
  podeEditar: boolean
  onAbrirModal: (papel: PapelSlot) => void
  onGrupo: (grupo: string) => void
  onObservacao: (observacao: string) => void
  onRestaurar: () => void
}) {
  const [equipeExpandida, setEquipeExpandida] = useState(
    () => Boolean(v.ajudante2_codigo || v.chapa_codigo || v.chapa_nome),
  )
  const stats = estatisticasVeiculo(v)
  const disp = disponibilidade(v)
  const carry = v.isSpot ? null : mapaPendencia(v, dataIso)
  const regioesRota = v.rotas.map((r) => r.regiao).filter(Boolean).join(' | ')
  const cidadesRota = v.rotas.map((r) => r.cidades).filter(Boolean).join(' | ')
  const rotaTexto = regioesRota || cidadesRota || 'Sem mapa/rota no PCD'
  const qtdD0 = v.rotas.filter((r) => r.data_entrega === dataIso).length
  const qtdPend = v.rotas.filter((r) => r.data_entrega !== dataIso).length
  const tipo = rotuloTipoVeiculo(v)
  const equipeExtraResumo = [
    {
      slot: 'A2',
      codigo: code(v.ajudante2_codigo),
      nome: v.ajudante2_codigo ? nomeDe('ajudante', v.ajudante2_codigo) : '',
    },
    {
      slot: 'Chapa/PX',
      codigo: code(v.chapa_codigo),
      nome: v.chapa_nome || (v.chapa_codigo ? nomeDe('ajudante', v.chapa_codigo) : ''),
    },
  ].filter((extra) => extra.codigo || extra.nome)
  const statusLinha =
    disp === 'UNAVAILABLE'
      ? 'shadow-[inset_3px_0_0_#e11d48] bg-rose-50/35'
      : v.carregado && !code(v.motorista_codigo)
        ? 'shadow-[inset_3px_0_0_#d97706] bg-amber-50/45'
        : v.carregado && code(v.motorista_codigo)
          ? 'shadow-[inset_3px_0_0_#059669]'
          : 'shadow-[inset_3px_0_0_#cbd5e1]'

  const renderSlot = (slot: 'motorista' | 'ajudante' | 'ajudante2') => {
    const papel = papelPessoaDoSlot(slot)
    const entradas = slot === 'ajudante2'
      ? [
          {
            slot: 'ajudante2' as const,
            rotulo: 'A2',
            codigo: code(v.ajudante2_codigo),
            nome: v.ajudante2_codigo ? nomeDe('ajudante', v.ajudante2_codigo) : '',
          },
          {
            slot: 'chapa' as const,
            rotulo: 'CHAPA/PX',
            codigo: code(v.chapa_codigo),
            nome: v.chapa_nome || (v.chapa_codigo ? nomeDe('ajudante', v.chapa_codigo) : ''),
          },
        ].filter((entrada) => entrada.codigo || entrada.nome)
      : [{
          slot,
          rotulo: slot === 'motorista' ? 'MOTORISTA' : 'AJUDANTE',
          codigo: code(slot === 'motorista' ? v.motorista_codigo : v.ajudante_codigo),
          nome: slot === 'motorista'
            ? (v.motorista_codigo ? nomeDe('motorista', v.motorista_codigo) : '')
            : (v.ajudante_codigo ? nomeDe('ajudante', v.ajudante_codigo) : ''),
        }].filter((entrada) => entrada.codigo || entrada.nome)
    const codigo = slot === 'motorista' ? code(v.motorista_codigo) : code(v.ajudante_codigo)
    const temFidelidade = slot === 'motorista' || slot === 'ajudante'
    const fid = temFidelidade ? fidelidade(v, papel) : null
    const fixoCodigo = code(slot === 'motorista' ? v.base?.motorista_fixo_codigo : slot === 'ajudante' ? v.ajudante_referencia : '')
    const fixoNome = slot === 'motorista'
      ? v.base?.motorista_fixo_nome
      : slot === 'ajudante' ? nomeDe('ajudante', fixoCodigo) : ''
    const ehCarry = slot === 'motorista' && carry && codigo === code(carry.motorista_codigo)
    const rotuloSlot = slot === 'motorista' ? 'Motorista' : slot === 'ajudante' ? 'Ajudante' : 'Ajudante 2 / Chapa/PX'

    return (
      <div className="min-w-0">
        <div className={`mb-1 flex items-center justify-between gap-1 font-semibold text-muted-foreground ${slot === 'ajudante2' ? 'text-[10px]' : 'text-[11px]'}`}>
          <span>{rotuloSlot}</span>
          {fid && (
            <span
              className={`inline-flex items-center gap-1 ${
                fid === 'ok'
                  ? 'text-emerald-700'
                  : fid === 'no'
                    ? 'text-amber-700'
                    : 'text-slate-400'
              }`}
              title={fid === 'ok' ? 'Equipe fixa' : fid === 'no' ? 'Diferente da equipe fixa' : 'Sem referência fixa'}
            >
              {fid === 'ok' ? <Check className="size-3" /> : fid === 'no' ? <ArrowLeftRight className="size-3" /> : <CircleHelp className="size-3" />}
              {fid === 'ok' ? 'Fixo' : fid === 'no' ? 'Troca' : 'S/ ref.'}
            </span>
          )}
        </div>
        <SlotAlocacao
          papel={slot}
          placa={v.chave}
          ativo={entradas.length > 0}
          compacto={slot === 'ajudante2'}
          onAbrir={() => podeEditar && onAbrirModal(slot)}
        >
          {entradas.length ? (
            <div className="space-y-1.5">
              {entradas.map((entrada) => {
                const eChapa = entrada.slot === 'chapa'
                const pessoaSlot = papelPessoaDoSlot(entrada.slot)
                const statusEntrada = entrada.codigo && !eChapa ? statusDe(pessoaSlot, entrada.codigo) : ''
                const nomeEntrada = entrada.nome || (entrada.codigo ? 'Código não cadastrado' : 'Nome não informado')
                const conteudo = (
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {slot === 'ajudante2' && (
                        <Badge variant="outline" className={`shrink-0 text-[9px] ${eChapa ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                          {entrada.rotulo}
                        </Badge>
                      )}
                      {entrada.codigo && <span className="grid h-5 min-w-9 shrink-0 place-items-center rounded bg-slate-100 px-1 text-[10px] font-bold tabular-nums text-slate-700">{entrada.codigo}</span>}
                      <span className="ml-auto flex min-w-0 items-center gap-1">
                        {statusEntrada && <span className="max-w-28 truncate text-[9px] text-amber-700">⚠ {statusEntrada}</span>}
                        {ehCarry && !eChapa && <span className="shrink-0 text-[9px] text-amber-800">↺ Pernoite</span>}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 min-w-0 line-clamp-2 break-words text-[12px] font-semibold leading-tight text-slate-800"
                      title={nomeEntrada}
                    >
                      {nomeEntrada}
                    </div>
                  </div>
                )
                if (!entrada.codigo) return <div key={entrada.slot}>{conteudo}</div>
                return (
                  <PessoaArrastavel
                    key={entrada.slot}
                    papel="ajudante"
                    codigo={entrada.codigo}
                    nome={entrada.nome ?? ''}
                    origem={v.chave}
                    origemSlot={entrada.slot}
                    className="cursor-grab active:cursor-grabbing"
                    conteudo={conteudo}
                  />
                )
              })}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><Users className="size-3.5" /> Solte ajudante ou clique para escolher</span>
          )}
        </SlotAlocacao>
        {temFidelidade && (
          <div className="mt-1 truncate text-[10px] text-slate-500" title={fixoCodigo ? `Referência fixa: ${fixoCodigo} · ${fixoNome ?? ''}` : 'Sem referência fixa'}>
            Ref. fixa: <strong className="font-semibold text-slate-600">
              {fixoCodigo ? `${fixoCodigo} · ${fixoNome ?? ''}` : '—'}
            </strong>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`${COLUNAS_QUADRO} ${statusLinha} gap-2 border-b border-slate-100 px-3 py-3 transition-colors hover:bg-slate-50/80 last:border-b-0`}
    >
      {/* Veículo */}
      <div>
        <div className="text-[13px] font-extrabold tracking-tight tabular-nums text-slate-900">{v.placa}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {v.isSpot ? 'Veículo spot' : v.base?.frota ? `Frota ${v.base.frota}` : 'Sem frota fixa'}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="outline" className={`text-[10px] font-bold tracking-wide ${
            tipo === 'VAN' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' :
            tipo === 'VULCK' ? 'border-indigo-200 bg-indigo-50 text-indigo-800' :
            tipo === 'TRUCK' ? 'border-slate-300 bg-slate-100 text-slate-800' :
            tipo === 'SIDER' ? 'border-orange-200 bg-orange-50 text-orange-800' :
            'border-violet-200 bg-violet-50 text-violet-800'
          }`}>
            {tipo}
          </Badge>
          {disp === 'AVAILABLE' && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
              DISP
            </Badge>
          )}
          {disp === 'UNAVAILABLE' && (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">
              INDISP
            </Badge>
          )}
          {qtdPend > 0 && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
              {qtdPend} pend.
            </Badge>
          )}
        </div>
      </div>

      {/* Mapa / carga */}
      <div>
        {v.rotas.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="space-y-1">
            {v.rotas.map((r) => {
              const antigo = r.data_entrega !== dataIso
              const dias = difDiasIso(r.data_entrega, dataIso)
              return (
                <div
                  key={r.id}
                  className={`rounded-md border px-2.5 py-1.5 ${antigo ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-extrabold tracking-tight text-slate-900">{r.mapa || '—'}</span>
                    {antigo && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
                        {dias === -1 ? 'D-1' : `D-${Math.abs(dias)}`}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${classeFaseMpd(r.mpd)}`}>
                      {rotuloFaseMpd(r.mpd)}
                    </Badge>
                    {r.classificacao && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${classeClassificacao(r.classificacao)}`}
                      >
                        {rotuloClassificacao(r.classificacao)}
                      </Badge>
                    )}
                    {ehMapaCritico(r) && (
                      <Badge variant="outline" className="border-rose-300 bg-rose-100 text-[10px] font-bold text-rose-800">
                        CRÍTICO · &gt;90% + &gt;09:00
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      <b className="text-foreground">{r.entregas ?? 0}</b> entregas
                    </span>
                    <span>
                      <b className="text-foreground">
                        {r.ocupacao_peso_pct != null ? `${Math.round(r.ocupacao_peso_pct)}%` : '—'}
                      </b>{' '}
                      ocup. peso
                    </span>
                    <span>
                      <b className="text-foreground">{r.tempo_previsto?.slice(0, 5) || '—'}</b> previsto
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-1 text-[10px] text-muted-foreground">
          {v.rotas.length
            ? [
                qtdD0 ? `${qtdD0} mapa(s) D0` : null,
                qtdPend ? `${qtdPend} pendência(s) anterior(es)` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Sem mapa D0 ou pendência aberta — equipe liberada'}
        </div>
      </div>

      {/* Rota */}
      <div className="text-[12px] leading-relaxed break-words" title={rotaTexto}>
        {v.rotas.length === 0 ? (
          <span className="text-muted-foreground">Sem mapa/rota no PCD</span>
        ) : (
          <>
            <div className="line-clamp-3 font-medium text-slate-700">{regioesRota || '—'}</div>
            {cidadesRota && (
              <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {cidadesRota}
              </div>
            )}
          </>
        )}
      </div>

      {renderSlot('motorista')}
      <div className="min-w-0">
        {renderSlot('ajudante')}
        {equipeExpandida && <div className="mt-2">{renderSlot('ajudante2')}</div>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={equipeExpandida}
          aria-label={equipeExpandida ? `Recolher equipe extra do veículo ${v.placa}` : `Expandir equipe extra do veículo ${v.placa}`}
          className="mt-1 h-6 gap-1 px-1.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 hover:text-sky-800"
          onClick={() => setEquipeExpandida((aberta) => !aberta)}
        >
          {equipeExpandida ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {equipeExpandida ? 'Recolher' : '+ A2 / Chapa'}
        </Button>
        {!equipeExpandida && equipeExtraResumo.length > 0 && (
          <div className="ml-1 mt-0.5 space-y-0.5">
            {equipeExtraResumo.map((extra) => (
              <div
                key={extra.slot}
                className="line-clamp-2 break-words text-[9px] leading-tight text-slate-600"
                title={`${extra.slot}${extra.codigo ? ` · ${extra.codigo}` : ''}${extra.nome ? ` · ${extra.nome}` : ''}`}
              >
                <strong className="text-slate-700">{extra.slot}</strong>
                {extra.codigo ? ` · ${extra.codigo}` : ''}{extra.nome ? ` · ${extra.nome}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Sala */}
      <Select value={v.grupo} onValueChange={onGrupo} disabled={!podeEditar}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {salas.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Observação */}
      <div className="flex items-start gap-1">
        <Input
          defaultValue={v.observacao}
          key={`${v.chave}-${v.observacao}`}
          onBlur={(e) => {
            const valor = e.target.value
            if (valor !== v.observacao) onObservacao(valor)
          }}
          placeholder="Observação…"
          disabled={!podeEditar}
          className="h-8 text-xs"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          title="restaurar"
          disabled={!podeEditar}
          onClick={onRestaurar}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      {/* estatísticas usadas em título */}
      <span className="sr-only">
        {stats.km} km · {stats.entregas} entregas · {stats.tempoRotulo}
      </span>
    </div>
  )
}
