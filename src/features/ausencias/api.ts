import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { code, norm } from '@/lib/texto'
import type { Ausencia, Colaborador, EscalaLinha, PapelEquipe, TipoAusencia } from '@/types/dominio'

export function useAusencias(dataIso: string) {
  return useQuery({
    queryKey: ['ausencias', dataIso],
    queryFn: async (): Promise<Ausencia[]> => {
      const { data, error } = await obterSupabase()
        .from('ausencias')
        .select('*')
        .eq('data', dataIso)
        .order('papel', { ascending: true })
        .order('nome', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as Ausencia[]
    },
  })
}

export function useHistoricoAusencias() {
  return useQuery({
    queryKey: ['ausencias', 'historico'],
    queryFn: async (): Promise<Ausencia[]> => {
      const registros: Ausencia[] = []
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await obterSupabase()
          .from('ausencias')
          .select('*')
          .order('data', { ascending: false })
          .order('id', { ascending: true })
          .range(inicio, inicio + 999)
        if (error) throw new Error(error.message)
        registros.push(...((data ?? []) as Ausencia[]))
        if ((data?.length ?? 0) < 1000) return registros
      }
    },
  })
}

export type FormularioAusencia = {
  papel: PapelEquipe
  codigo: string
  tipo: TipoAusencia
  justificativa: string
}

function codigosEscalados(
  linha: Pick<EscalaLinha, 'motorista_codigo' | 'ajudante_codigo' | 'ajudante2_codigo' | 'chapa_codigo'>,
  papel: PapelEquipe,
): string[] {
  return (papel === 'motorista'
    ? [linha.motorista_codigo]
    : [linha.ajudante_codigo, linha.ajudante2_codigo, linha.chapa_codigo]
  ).map(code).filter(Boolean)
}

/**
 * Pessoas fora da escala da data (regra do legado): exclui quem está escalado,
 * códigos fixos 800/801 de ajudantes e quem tem status de férias na base.
 */
export function pessoasForaDaEscala(
  colaboradores: Colaborador[],
  escalas: EscalaLinha[],
  papel: PapelEquipe,
): Colaborador[] {
  const escalados = new Set(escalas.flatMap((e) => codigosEscalados(e, papel)))
  return colaboradores.filter((p) => {
    const c = code(p.codigo)
    if (!c) return false
    if (papel === 'ajudante' && (c === '800' || c === '801')) return false
    if (norm(p.status).includes('FERIA')) return false
    return !escalados.has(c)
  })
}

export function useSalvarAusencia(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (form: FormularioAusencia): Promise<void> => {
      const codigo = code(form.codigo)
      if (!codigo) throw new Error('Selecione um colaborador')

      const db = obterSupabase()

      const { data: escalas, error: erroEscalas } = await db
        .from('escalas')
        .select('motorista_codigo, ajudante_codigo, ajudante2_codigo, chapa_codigo')
        .eq('data_operacao', dataIso)
      if (erroEscalas) throw new Error(erroEscalas.message)

      const escalado = (escalas ?? []).some((e) =>
        codigosEscalados(e, form.papel).includes(codigo),
      )
      if (escalado) {
        throw new Error('Esta pessoa está escalada. Retire da escala antes de registrar.')
      }

      const { data: colaborador, error: erroColab } = await db
        .from('colaboradores')
        .select('id, nome')
        .eq('codigo', codigo)
        .eq('tipo', form.papel)
        .maybeSingle()
      if (erroColab) throw new Error(erroColab.message)
      if (!colaborador) throw new Error('Colaborador não encontrado na Base Equipes')

      const { data: existente, error: erroExistente } = await db
        .from('ausencias')
        .select('id')
        .eq('data', dataIso)
        .eq('papel', form.papel)
        .eq('codigo', codigo)
        .maybeSingle()
      if (erroExistente) throw new Error(erroExistente.message)

      const registro = {
        nome: colaborador.nome,
        colaborador_id: colaborador.id as string,
        tipo: form.tipo,
        justificativa: form.justificativa.trim(),
      }

      if (existente) {
        const { error } = await db.from('ausencias').update(registro).eq('id', existente.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await db.from('ausencias').insert({
          data: dataIso,
          papel: form.papel,
          codigo,
          ...registro,
        })
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ausencias'] })
      toast.success('Registro salvo')
    },
  })
}

export function useRemoverAusencia(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await obterSupabase().from('ausencias').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ausencias', dataIso] })
      void qc.invalidateQueries({ queryKey: ['ausencias', 'historico'] })
      toast.success('Registro removido')
    },
  })
}

export function baldeAusencia(tipo: string): 'faltas' | 'folgas' | 'ferias' | 'atestado' | 'inss' | 'outros' {
  const n = norm(tipo)
  if (n.includes('FALTA')) return 'faltas'
  if (n.includes('FOLGA')) return 'folgas'
  if (n.includes('FERIA')) return 'ferias'
  if (n.includes('ATEST')) return 'atestado'
  if (n.includes('INSS')) return 'inss'
  return 'outros'
}

export type ResumoHistorico = {
  papel: PapelEquipe
  codigo: string
  nome: string
  faltas: number
  folgas: number
  ferias: number
  atestado: number
  inss: number
  outros: number
  total: number
  ultimo: string
}

export function consolidarHistorico(registros: Ausencia[]): ResumoHistorico[] {
  const mapa = new Map<string, ResumoHistorico>()
  for (const r of registros) {
    const chave = `${r.papel}|${code(r.codigo)}`
    let x = mapa.get(chave)
    if (!x) {
      x = {
        papel: r.papel,
        codigo: code(r.codigo),
        nome: r.nome,
        faltas: 0,
        folgas: 0,
        ferias: 0,
        atestado: 0,
        inss: 0,
        outros: 0,
        total: 0,
        ultimo: r.data,
      }
      mapa.set(chave, x)
    }
    x[baldeAusencia(r.tipo)]++
    x.total++
    if (r.data > x.ultimo) x.ultimo = r.data
  }
  return [...mapa.values()].sort(
    (a, b) => b.faltas - a.faltas || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}
