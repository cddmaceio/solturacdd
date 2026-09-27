import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { code } from '@/lib/texto'
import { useVeiculos } from '@/features/veiculos/api'
import { useColaboradores, useEquipes } from '@/features/equipes/api'
import { usePcdMapas } from '@/features/pcd/api'
import { useEscalas } from '@/features/escala/api'
import { montarEscala, paraLinhasPersistencia, type VeiculoEscala } from '@/features/escala/montagem'
import type { Colaborador, EquipeComPessoas, EscalaLinha, PcdMapa, PapelEquipe, Veiculo } from '@/types/dominio'

export type EscalaCompleta = {
  veiculos: VeiculoEscala[]
  pessoas: Colaborador[]
  linhasSalvas: EscalaLinha[]
  entradas: { veiculosBase: Veiculo[]; mapas: PcdMapa[]; pessoas: Colaborador[]; equipes: EquipeComPessoas[] }
}

/** Tudo que a tela da escala precisa: montagem pura sobre as bases + estado salvo. */
export function useEscalaCompleta(dataIso: string) {
  const veiculos = useVeiculos()
  const mapas = usePcdMapas(dataIso)
  const colaboradores = useColaboradores()
  const equipes = useEquipes()
  const salvas = useEscalas(dataIso)

  const carregando = veiculos.isLoading || mapas.isLoading || colaboradores.isLoading || equipes.isLoading || salvas.isLoading
  const erro = veiculos.error ?? mapas.error ?? colaboradores.error ?? equipes.error ?? salvas.error

  const dados: EscalaCompleta | null =
    carregando || erro
      ? null
      : {
          veiculos: montarEscala({
            dataIso,
            veiculos: veiculos.data ?? [],
            mapas: mapas.data ?? [],
            pessoas: colaboradores.data ?? [],
            equipes: equipes.data ?? [],
            salvas: salvas.data ?? [],
          }),
          pessoas: colaboradores.data ?? [],
          linhasSalvas: salvas.data ?? [],
          entradas: {
            veiculosBase: veiculos.data ?? [],
            mapas: mapas.data ?? [],
            pessoas: colaboradores.data ?? [],
            equipes: equipes.data ?? [],
          },
        }

  return { dados, carregando, erro }
}

/** Congela a escala da data: insere apenas as placas ainda ausentes. */
export function useGarantirEscala(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: {
      veiculos: VeiculoEscala[]
      pessoas: Colaborador[]
      linhasSalvas: EscalaLinha[]
    }): Promise<number> => {
      const presentes = new Set(entrada.linhasSalvas.map((l) => l.veiculo_placa))
      const faltantes = paraLinhasPersistencia(
        entrada.veiculos.filter((v) => !presentes.has(v.chave)),
        dataIso,
        entrada.pessoas,
      )
      for (let i = 0; i < faltantes.length; i += 300) {
        const { error } = await obterSupabase()
          .from('escalas')
          .upsert(faltantes.slice(i, i + 300), {
            onConflict: 'data_operacao,veiculo_placa',
            ignoreDuplicates: true,
          })
        if (error) throw new Error(error.message)
      }
      return faltantes.length
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
    },
  })
}

export type AlteracaoSlot = {
  placa: string
  papel: PapelEquipe
  codigo: string
  origem?: string | null
  pessoas: Colaborador[]
}

/**
 * Atribui uma pessoa ao slot de um veículo (port de assignPerson): bloqueia
 * quem tem ausência registrada no dia e troca com quem já estava naquele slot.
 */
export function useAtribuirPessoa(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placa, papel, codigo, origem, pessoas }: AlteracaoSlot): Promise<void> => {
      const novoCodigo = code(codigo)
      if (!novoCodigo) return
      const campo = papel === 'motorista' ? 'motorista_codigo' : 'ajudante_codigo'
      const campoNome = papel === 'motorista' ? 'motorista_nome' : 'ajudante_nome'
      const db = obterSupabase()

      const { data: ausente, error: erroAusencia } = await db
        .from('ausencias')
        .select('id')
        .eq('data', dataIso)
        .eq('papel', papel)
        .eq('codigo', novoCodigo)
        .maybeSingle()
      if (erroAusencia) throw new Error(erroAusencia.message)
      if (ausente) {
        throw new Error('Remova o registro de ausência/folga antes de escalar esta pessoa')
      }

      const { data: linhas, error: erroLinhas } = await db
        .from('escalas')
        .select('*')
        .eq('data_operacao', dataIso)
      if (erroLinhas) throw new Error(erroLinhas.message)

      const todas = (linhas ?? []) as EscalaLinha[]
      const alvo = todas.find((l) => l.veiculo_placa === placa)
      if (!alvo) throw new Error('Veículo não encontrado na escala do dia')

      const nomeDe = (codigoBuscado: string, tipo: PapelEquipe) =>
        pessoas.find((p) => p.tipo === tipo && code(p.codigo) === codigoBuscado)?.nome ?? ''

      const origemLinha =
        origem != null
          ? todas.find((l) => l.veiculo_placa === origem)
          : todas.find((l) => l.veiculo_placa !== placa && code(l[campo]) === novoCodigo)

      const antigoCodigo = code(alvo[campo])
      const antigoNome = alvo[campoNome] ?? ''
      const campoManual = papel === 'motorista' ? 'motorista_manual' : 'ajudante_manual'
      const atualizacoes: { id: string; dados: Record<string, string | boolean> }[] = [
        {
          id: alvo.id,
          dados: {
            [campo]: novoCodigo,
            [campoNome]: nomeDe(novoCodigo, papel),
            [campoManual]: true,
          },
        },
      ]

      if (origemLinha && origemLinha.id !== alvo.id) {
        atualizacoes.push({
          id: origemLinha.id,
          dados: {
            [campo]: antigoCodigo,
            [campoNome]: antigoCodigo ? antigoNome : '',
            [campoManual]: true,
          },
        })
      }

      for (const u of atualizacoes) {
        const { error } = await db.from('escalas').update(u.dados).eq('id', u.id)
        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
    },
    onError: (e) => toast.error(e.message),
  })
}

export function useLimparSlot(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placa, papel }: { placa: string; papel: PapelEquipe }): Promise<void> => {
      const campo = papel === 'motorista' ? 'motorista_codigo' : 'ajudante_codigo'
      const campoNome = papel === 'motorista' ? 'motorista_nome' : 'ajudante_nome'
      const campoManual = papel === 'motorista' ? 'motorista_manual' : 'ajudante_manual'
      const { error } = await obterSupabase()
        .from('escalas')
        .update({ [campo]: '', [campoNome]: '', [campoManual]: true })
        .eq('data_operacao', dataIso)
        .eq('veiculo_placa', placa)
      if (error) throw new Error(error.message)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
    },
  })
}

export function useAtualizarLinha(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      placa,
      patch,
    }: {
      placa: string
      patch: { grupo?: string; observacao?: string }
    }): Promise<void> => {
      const { error } = await obterSupabase()
        .from('escalas')
        .update(patch)
        .eq('data_operacao', dataIso)
        .eq('veiculo_placa', placa)
      if (error) throw new Error(error.message)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
    },
  })
}

export type LinhaRestaurada = Omit<
  EscalaLinha,
  'id' | 'data_operacao' | 'veiculo_placa'
>

/** Restaura um veículo para a referência inicial (estado recomputado pela montagem). */
export function useRestaurarVeiculo(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      placa,
      dados,
    }: {
      placa: string
      dados: LinhaRestaurada
    }): Promise<void> => {
      const { error } = await obterSupabase()
        .from('escalas')
        .update(dados)
        .eq('data_operacao', dataIso)
        .eq('veiculo_placa', placa)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
      toast.success('Veículo restaurado para a referência inicial')
    },
    onError: (e) => toast.error(e.message),
  })
}

/** Restaura o dia inteiro: descarta ajustes e recalcula a montagem (admin). */
export function useRestaurarDia(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: {
      veiculosBase: Veiculo[]
      mapas: PcdMapa[]
      pessoas: Colaborador[]
      equipes: EquipeComPessoas[]
    }): Promise<number> => {
      const db = obterSupabase()
      const linhas = paraLinhasPersistencia(
        montarEscala({
          dataIso,
          veiculos: entrada.veiculosBase,
          mapas: entrada.mapas,
          pessoas: entrada.pessoas,
          equipes: entrada.equipes,
          salvas: [],
        }),
        dataIso,
        entrada.pessoas,
      )
      const { error: erroDelete } = await db.from('escalas').delete().eq('data_operacao', dataIso)
      if (erroDelete) throw new Error(erroDelete.message)
      for (let i = 0; i < linhas.length; i += 300) {
        const { error } = await db.from('escalas').insert(linhas.slice(i, i + 300))
        if (error) throw new Error(error.message)
      }
      return linhas.length
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
      toast.success('Ajustes do dia removidos')
    },
    onError: (e) => toast.error(e.message),
  })
}
