import { createPortal } from 'react-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { code } from '@/lib/texto'
import { paraDmy, rotuloDiaRelativo } from '@/lib/datas'
import { rotuloFaseMpd } from '@/features/pcd/lib'
import type { VeiculoEscala } from '@/features/escala/montagem'
import type { PapelEquipe } from '@/types/dominio'

/** Opções do diálogo de impressão (fiel ao legado). */
export type ModoImpressao = 'geral' | 'salas'

type NomeDe = (papel: PapelEquipe, codigo: string) => string | null

const ORDEM_SALAS = ['ELITE', 'FORÇA', 'VANS', 'VESPERTINA', 'AS', 'SPOT', 'OUTROS']

function densidade(n: number): string {
  if (n > 38) return ' density-ultra'
  if (n > 22) return ' density-tight'
  if (n <= 8) return ' density-roomy'
  return ''
}

function pessoaImpressao(codigo: string, nome: string | null): string {
  const c = code(codigo)
  if (!c) return '—'
  return `${c} · ${nome || 'NÃO CADASTRADO'}`
}

// ---------------------------------------------------------------------------
// Folha impressa
// ---------------------------------------------------------------------------

function MapasImpressao({ v, dataIso }: { v: VeiculoEscala; dataIso: string }) {
  if (!v.rotas.length) return <>—</>
  return (
    <span className="print-map-list">
      {v.rotas.map((r) => {
        const carry = r.data_entrega !== dataIso
        const rotulo = `${r.mapa || '—'} · ${rotuloFaseMpd(r.mpd)}${
          carry
            ? ` · ${rotuloDiaRelativo(paraDmy(r.data_entrega), paraDmy(dataIso))}`
            : ''
        }`
        return (
          <span key={r.id} className={`print-map-item${carry ? ' carry' : ''}`}>
            {rotulo}
          </span>
        )
      })}
    </span>
  )
}

function TabelaImpressao({
  veiculos,
  dataIso,
  nomeDe,
  comSala,
}: {
  veiculos: VeiculoEscala[]
  dataIso: string
  nomeDe: NomeDe
  comSala: boolean
}) {
  return (
    <table className={`print-table${comSala ? '' : ' room-table'}`}>
      <colgroup>
        {comSala && <col className="col-room" />}
        <col className="col-plate" />
        <col className="col-fleet" />
        <col className="col-map" />
        <col className="col-driver" />
        <col className="col-helper" />
      </colgroup>
      <thead>
        <tr>
          {comSala && <th className="col-room">Sala</th>}
          <th>Placa</th>
          <th>Frota</th>
          <th>Mapa</th>
          <th>Motorista</th>
          <th>Equipe de ajudantes</th>
        </tr>
      </thead>
      <tbody>
        {veiculos.map((v) => (
          <tr key={v.chave}>
            {comSala && <td className="strong">{v.grupo || 'OUTROS'}</td>}
            <td className="strong">{v.placa}</td>
            <td>{v.base?.frota || '—'}</td>
            <td className="map-cell">
              <MapasImpressao v={v} dataIso={dataIso} />
            </td>
            <td className="print-person">
              {pessoaImpressao(v.motorista_codigo, nomeDe('motorista', v.motorista_codigo))}
            </td>
            <td className="print-person">
              <span className="print-team-list">
                <span className="print-team-item">
                  <strong>A1</strong> {pessoaImpressao(v.ajudante_codigo, nomeDe('ajudante', v.ajudante_codigo))}
                </span>
                {code(v.ajudante2_codigo) && (
                  <span className="print-team-item">
                    <strong>A2</strong> {pessoaImpressao(v.ajudante2_codigo ?? '', nomeDe('ajudante', v.ajudante2_codigo ?? ''))}
                  </span>
                )}
                {(code(v.chapa_codigo) || v.chapa_nome) && (
                  <span className="print-team-item">
                    <strong>CHAPA/PX</strong> {v.chapa_codigo ? `${code(v.chapa_codigo)} · ` : ''}{v.chapa_nome || nomeDe('ajudante', v.chapa_codigo ?? '') || '—'}
                  </span>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FolhaImpressao({
  titulo,
  veiculos,
  dataIso,
  nomeDe,
  comSala,
  rodape,
  agora,
}: {
  titulo: string
  veiculos: VeiculoEscala[]
  dataIso: string
  nomeDe: NomeDe
  comSala: boolean
  rodape: string
  agora: string
}) {
  const mapas = veiculos.reduce((n, v) => n + v.rotas.length, 0)
  const pendentes = veiculos.filter((v) => !code(v.motorista_codigo)).length
  return (
    <section className={`print-sheet${densidade(veiculos.length)}`}>
      <div className="print-head">
        <div>
          <div className="print-title">{titulo}</div>
          <div className="print-subtitle">
            CDD Maceió · Data: {paraDmy(dataIso)} · Somente veículos com mapa vinculado
          </div>
        </div>
        <div className="print-summary">
          <strong>
            {veiculos.length} veículo(s) · {mapas} mapa(s)
          </strong>
          <br />
          {pendentes ? `${pendentes} motorista(s) pendente(s)` : 'Todos com motorista definido'}
        </div>
      </div>
      <TabelaImpressao veiculos={veiculos} dataIso={dataIso} nomeDe={nomeDe} comSala={comSala} />
      <div className="print-footer">
        <span>{rodape}</span>
        <span>Gerado em {agora}</span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Área de impressão (portal fora do #root; visível só em @media print)
// ---------------------------------------------------------------------------

export function AreaImpressao({
  modo,
  veiculos,
  dataIso,
  nomeDe,
}: {
  modo: ModoImpressao
  veiculos: VeiculoEscala[]
  dataIso: string
  nomeDe: NomeDe
}) {
  const agora = new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  const comMapa = veiculos.filter((v) => v.rotas.length > 0)

  if (!comMapa.length) {
    return createPortal(
      <div className="area-impressao">
        <section className="print-sheet">
          <div className="print-head">
            <div>
              <div className="print-title">Escala — CDD Maceió</div>
              <div className="print-subtitle">Data: {paraDmy(dataIso)}</div>
            </div>
          </div>
          <p className="print-vazio">Nenhum veículo com mapa vinculado nesta data.</p>
        </section>
      </div>,
      document.body,
    )
  }

  if (modo === 'geral') {
    return createPortal(
      <div className="area-impressao">
        <FolhaImpressao
          titulo="Escala do dia — CDD Maceió"
          veiculos={comMapa}
          dataIso={dataIso}
          nomeDe={nomeDe}
          comSala
          rodape={`Resumo geral · ${comMapa.length} veículo(s) com mapa`}
          agora={agora}
        />
      </div>,
      document.body,
    )
  }

  const grupos = new Map<string, VeiculoEscala[]>()
  for (const v of comMapa) {
    const g = v.grupo || 'OUTROS'
    const lista = grupos.get(g)
    if (lista) lista.push(v)
    else grupos.set(g, [v])
  }
  const chaves = [
    ...ORDEM_SALAS.filter((g) => grupos.has(g)),
    ...[...grupos.keys()]
      .filter((g) => !ORDEM_SALAS.includes(g))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ]

  return createPortal(
    <div className="area-impressao">
      {chaves.map((g) => {
        const lista = grupos.get(g)!
        return (
          <FolhaImpressao
            key={g}
            titulo={`Escala — ${g} · CDD Maceió`}
            veiculos={lista}
            dataIso={dataIso}
            nomeDe={nomeDe}
            comSala={false}
            rodape={`Sala ${g} · ${lista.length} veículo(s) com mapa`}
            agora={agora}
          />
        )
      })}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Diálogo de escolha
// ---------------------------------------------------------------------------

export function DialogoImpressao({
  aberto,
  onFechar,
  aoEscolher,
  dataIso,
}: {
  aberto: boolean
  onFechar: () => void
  aoEscolher: (modo: ModoImpressao) => void
  dataIso: string
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Imprimir escala · {paraDmy(dataIso)}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Escolha como deseja gerar a versão resumida da escala de {paraDmy(dataIso)}.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-xl border bg-card p-3.5 text-left transition hover:-translate-y-px hover:border-sky-300 hover:bg-sky-50/40"
            onClick={() => aoEscolher('geral')}
          >
            <b className="block text-sm">▣ Resumo geral</b>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Somente veículos com mapa vinculado, em A4 retrato: Sala, Placa, Frota, Mapa,
              Motorista e equipe completa (Ajudante 1/2 e Chapa/PX).
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl border bg-card p-3.5 text-left transition hover:-translate-y-px hover:border-sky-300 hover:bg-sky-50/40"
            onClick={() => aoEscolher('salas')}
          >
            <b className="block text-sm">▤ Uma folha por sala</b>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              Uma página por sala, mostrando somente veículos que possuem mapa vinculado na
              data selecionada.
            </span>
          </button>
        </div>
        <p className="rounded-lg bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          A impressão mostra Placa, Frota, Mapa, Motorista e equipe de ajudantes (e Sala no
          resumo geral). Rota, observações, filtros e veículos sem mapa não são impressos.
        </p>
      </DialogContent>
    </Dialog>
  )
}
