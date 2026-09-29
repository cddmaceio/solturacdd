import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { code, norm } from '@/lib/texto'
import { carregarPlanilha, encontrarAba, ler } from '@/lib/planilhas'
import type { Colaborador, EquipeComPessoas, TipoColaborador } from '@/types/dominio'

const CODIGOS_RESERVADOS = new Set(['800', '801'])

export function useColaboradores(tipo?: TipoColaborador) {
  return useQuery({
    queryKey: ['colaboradores', tipo ?? 'todos'],
    queryFn: async (): Promise<Colaborador[]> => {
      let consulta = obterSupabase()
        .from('colaboradores')
        .select('*')
        .order('nome', { ascending: true })
      if (tipo) consulta = consulta.eq('tipo', tipo)
      const { data, error } = await consulta
      if (error) throw new Error(error.message)
      return (data ?? []) as Colaborador[]
    },
  })
}

export function useEquipes() {
  return useQuery({
    queryKey: ['equipes'],
    queryFn: async (): Promise<EquipeComPessoas[]> => {
      const { data, error } = await obterSupabase()
        .from('equipes')
        .select(
          'id, motorista_id, ajudante_id, motorista:colaboradores!equipes_motorista_id_fkey ( * ), ajudante:colaboradores!equipes_ajudante_id_fkey ( * )',
        )
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as EquipeComPessoas[]
    },
  })
}

export type FormularioEquipe = {
  id?: string
  motorista_codigo: string
  motorista_nome: string
  ajudante_codigo: string
  ajudante_nome: string
  sala: string
  status: string
}

/**
 * Resolve (cria/atualiza) um colaborador pelo código, validando duplicidade
 * na aplicação — regra do legado (códigos reservados 800/801 são isentos).
 */
async function resolverColaborador(opcoes: {
  codigo: string
  nome: string
  tipo: TipoColaborador
  sala: string
  status: string
  equipeAtualId?: string
}): Promise<string | null> {
  const { codigo, nome, tipo, sala, status, equipeAtualId } = opcoes
  if (!codigo) return null

  const db = obterSupabase()
  const { data: existentes, error } = await db
    .from('colaboradores')
    .select('id, codigo')
    .eq('codigo', codigo)
    .eq('tipo', tipo)
  if (error) throw new Error(error.message)

  const existente = existentes?.[0]

  if (existente) {
    if (!CODIGOS_RESERVADOS.has(codigo)) {
      const { data: linhas, error: erroLinhas } = await db
        .from('equipes')
        .select('id')
        .or(`motorista_id.eq.${existente.id},ajudante_id.eq.${existente.id}`)
      if (erroLinhas) throw new Error(erroLinhas.message)
      const alheia = (linhas ?? []).find((l) => l.id !== equipeAtualId)
      if (alheia) {
        throw new Error(
          tipo === 'motorista'
            ? 'Este código de motorista já existe na Base Equipes'
            : 'Este código de ajudante já existe na Base Equipes',
        )
      }
      const { error: erroUpdate } = await db
        .from('colaboradores')
        .update({ nome, sala, status })
        .eq('id', existente.id)
      if (erroUpdate) throw new Error(erroUpdate.message)
    }
    return existente.id
  }

  const { data: criado, error: erroInsert } = await db
    .from('colaboradores')
    .insert({ codigo, nome, tipo, sala, status })
    .select('id')
    .single()
  if (erroInsert) throw new Error(erroInsert.message)
  return criado.id as string
}

export function useSalvarEquipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: FormularioEquipe): Promise<void> => {
      const dc = code(form.motorista_codigo)
      const dn = form.motorista_nome.trim()
      const hc = code(form.ajudante_codigo)
      const hn = form.ajudante_nome.trim()
      const sala = form.sala.trim().toUpperCase()
      const status = form.status.trim() || 'Disponivel'

      if (!dc && !dn && !hc && !hn) {
        throw new Error('Informe ao menos um motorista ou ajudante')
      }
      if ((dc && !dn) || (!dc && dn)) {
        throw new Error('Preencha código e nome do motorista juntos')
      }
      if ((hc && !hn) || (!hc && hn)) {
        throw new Error('Preencha código e nome do ajudante juntos')
      }

      const db = obterSupabase()

      // Linha atual (edição) — guarda códigos antigos para limpar a escala de hoje
      let equipeAtual: {
        motorista_id: string | null
        ajudante_id: string | null
        codigoAntigoMotorista: string
        codigoAntigoAjudante: string
      } | null = null

      if (form.id) {
        const { data, error } = await db
          .from('equipes')
          .select(
            'id, motorista_id, ajudante_id, motorista:colaboradores!equipes_motorista_id_fkey ( codigo ), ajudante:colaboradores!equipes_ajudante_id_fkey ( codigo )',
          )
          .eq('id', form.id)
          .single()
        if (error) throw new Error('Equipe não encontrada')
        const registro = data as unknown as {
          motorista_id: string | null
          ajudante_id: string | null
          motorista: { codigo: string } | null
          ajudante: { codigo: string } | null
        }
        equipeAtual = {
          motorista_id: registro.motorista_id,
          ajudante_id: registro.ajudante_id,
          codigoAntigoMotorista: registro.motorista?.codigo ?? '',
          codigoAntigoAjudante: registro.ajudante?.codigo ?? '',
        }
      }

      const motoristaId = await resolverColaborador({
        codigo: dc,
        nome: dn,
        tipo: 'motorista',
        sala,
        status,
        equipeAtualId: form.id,
      })
      const ajudanteId = await resolverColaborador({
        codigo: hc,
        nome: hn,
        tipo: 'ajudante',
        sala,
        status,
        equipeAtualId: form.id,
      })

      if (form.id) {
        const { error } = await db
          .from('equipes')
          .update({ motorista_id: motoristaId, ajudante_id: ajudanteId })
          .eq('id', form.id)
        if (error) throw new Error(error.message)

        // Remove colaboradores de códigos que saíram da linha (hard delete;
        // histórico preservado pelos snapshots em escalas/ausencias)
        const idsNovos = new Set([motoristaId, ajudanteId].filter(Boolean))
        for (const antigoId of [equipeAtual?.motorista_id, equipeAtual?.ajudante_id]) {
          if (!antigoId || idsNovos.has(antigoId)) continue
          await removerColaboradorSeDesvinculado(antigoId)
        }
      } else {
        const { error } = await db
          .from('equipes')
          .insert({ motorista_id: motoristaId, ajudante_id: ajudanteId })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['equipes'] })
      void qc.invalidateQueries({ queryKey: ['colaboradores'] })
      void qc.invalidateQueries({ queryKey: ['escalas'] })
    },
  })
}

async function removerColaboradorSeDesvinculado(id: string): Promise<void> {
  const db = obterSupabase()
  const { data: atual } = await db.from('colaboradores').select('codigo').eq('id', id).single()
  if (!atual || CODIGOS_RESERVADOS.has(atual.codigo)) return

  const { count } = await db
    .from('equipes')
    .select('id', { count: 'exact', head: true })
    .or(`motorista_id.eq.${id},ajudante_id.eq.${id}`)
  if (count) return

  await db.from('colaboradores').delete().eq('id', id)
}

export function useExcluirEquipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (equipe: EquipeComPessoas): Promise<void> => {
      const db = obterSupabase()
      const { error: erroEquipe } = await db.from('equipes').delete().eq('id', equipe.id)
      if (erroEquipe) throw new Error(erroEquipe.message)

      for (const id of [equipe.motorista_id, equipe.ajudante_id]) {
        if (id) await removerColaboradorSeDesvinculado(id)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['equipes'] })
      void qc.invalidateQueries({ queryKey: ['colaboradores'] })
      void qc.invalidateQueries({ queryKey: ['escalas'] })
    },
  })
}

const CABECALHOS_EQUIPES = ['CODM', 'MOTORISTA', 'CODA', 'AJUDANTE', 'SALA', 'STATUS']

/** Importa a Base Equipes (XLSX): SUBSTITUI todas as equipes e colaboradores. */
export function useImportarEquipes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (arquivo: File): Promise<{ linhas: number; pessoas: number }> => {
      const wb = await carregarPlanilha(arquivo)
      const aba = encontrarAba(wb, CABECALHOS_EQUIPES)
      if (!aba) {
        throw new Error(
          'Planilha inválida. Use: Cod. M., Motorista, Cod. A., Ajudante, SALA e Status.',
        )
      }

      type Linha = {
        dc: string
        dn: string
        hc: string
        hn: string
        sala: string
        status: string
      }
      const linhas: Linha[] = []
      for (let i = 1; i < aba.linhas.length; i++) {
        const linha = aba.linhas[i]
        const l: Linha = {
          dc: code(ler(linha, aba.chaves, 'CODM')),
          dn: ler(linha, aba.chaves, 'MOTORISTA'),
          hc: code(ler(linha, aba.chaves, 'CODA')),
          hn: ler(linha, aba.chaves, 'AJUDANTE'),
          sala: ler(linha, aba.chaves, 'SALA').toUpperCase(),
          status: ler(linha, aba.chaves, 'STATUS') || 'Disponivel',
        }
        if (!l.dc && !l.dn && !l.hc && !l.hn) continue
        linhas.push(l)
      }
      if (!linhas.length) throw new Error('Nenhuma equipe válida encontrada na planilha')

      const db = obterSupabase()

      // Substituição completa (regra do legado)
      const { error: erroEquipes } = await db.from('equipes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (erroEquipes) throw new Error(erroEquipes.message)
      const { error: erroColab } = await db
        .from('colaboradores')
        .delete()
        .not('codigo', 'in', '("800","801")')
      if (erroColab) throw new Error(erroColab.message)

      // Pessoas únicas (última ocorrência vence, como no Map do legado)
      const pessoas = new Map<string, { codigo: string; nome: string; tipo: TipoColaborador; sala: string; status: string }>()
      for (const l of linhas) {
        if (l.dc && l.dn) {
          pessoas.set(`m|${l.dc}`, { codigo: l.dc, nome: l.dn, tipo: 'motorista', sala: l.sala, status: l.status })
        }
        if (l.hc && l.hn) {
          pessoas.set(`a|${l.hc}`, { codigo: l.hc, nome: l.hn, tipo: 'ajudante', sala: l.sala, status: l.status })
        }
      }

      const lista = [...pessoas.values()]
      for (let i = 0; i < lista.length; i += 400) {
        const { error } = await db
          .from('colaboradores')
          .upsert(lista.slice(i, i + 400), { onConflict: 'codigo,tipo' })
        if (error) throw new Error(error.message)
      }

      const { data: todos, error: erroBusca } = await db
        .from('colaboradores')
        .select('id, codigo, tipo')
      if (erroBusca) throw new Error(erroBusca.message)
      const indice = new Map(
        (todos ?? []).map((c) => [`${c.tipo === 'motorista' ? 'm' : 'a'}|${c.codigo}`, c.id as string]),
      )

      const linhasEquipes = linhas
        .map((l) => ({
          motorista_id: l.dc && l.dn ? (indice.get(`m|${l.dc}`) ?? null) : null,
          ajudante_id: l.hc && l.hn ? (indice.get(`a|${l.hc}`) ?? null) : null,
        }))
        .filter((l) => l.motorista_id || l.ajudante_id)

      for (let i = 0; i < linhasEquipes.length; i += 400) {
        const { error } = await db.from('equipes').insert(linhasEquipes.slice(i, i + 400))
        if (error) throw new Error(error.message)
      }

      return { linhas: linhasEquipes.length, pessoas: lista.length }
    },
    onSuccess: (resultado) => {
      void qc.invalidateQueries({ queryKey: ['equipes'] })
      void qc.invalidateQueries({ queryKey: ['colaboradores'] })
      void qc.invalidateQueries({ queryKey: ['escalas'] })
      toast.success(
        `Base Equipes importada: ${resultado.linhas} linha(s) · ${resultado.pessoas} pessoa(s)`,
      )
    },
  })
}

export function filtrarEquipes(equipes: EquipeComPessoas[], busca: string): EquipeComPessoas[] {
  const q = norm(busca)
  if (!q) return equipes
  return equipes.filter((e) =>
    norm(
      [
        e.motorista?.codigo,
        e.motorista?.nome,
        e.ajudante?.codigo,
        e.ajudante?.nome,
        e.motorista?.sala,
        e.motorista?.status,
      ]
        .filter(Boolean)
        .join(' '),
    ).includes(q),
  )
}
