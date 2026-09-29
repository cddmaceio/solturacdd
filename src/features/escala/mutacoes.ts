import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { code, norm } from '@/lib/texto'
import { dataHojeIso } from '@/lib/datas'
import { useVeiculos } from '@/features/veiculos/api'
import { useColaboradores, useEquipes } from '@/features/equipes/api'
import { usePcdMapas } from '@/features/pcd/api'
import { useEscalas } from '@/features/escala/api'
import { montarEscala, montarReferenciaEscala, paraLinhasPersistencia, type VeiculoEscala } from '@/features/escala/montagem'
import type { Colaborador, EquipeComPessoas, EscalaLinha, PcdMapa, PapelEquipe, PapelSlot, Veiculo } from '@/types/dominio'

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

/** Acrescenta veículos e mapas em transação, preservando o arquivo e ajustes salvos. */
export function useGarantirEscala(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entrada: {
      veiculos: VeiculoEscala[]
      pessoas: Colaborador[]
      linhasSalvas: EscalaLinha[]
    }): Promise<number> => {
      const linhas = paraLinhasPersistencia(entrada.veiculos, dataIso, entrada.pessoas)
      for (const linha of linhas) {
        const salva = entrada.linhasSalvas.find((s) => norm(s.veiculo_placa) === norm(linha.veiculo_placa))
        if (!salva) continue
        for (const slot of ['motorista', 'ajudante', 'ajudante2', 'chapa'] as const) {
          if (code(linha[`${slot}_codigo`]) === code(salva[`${slot}_codigo`])) {
            linha[`${slot}_nome`] = salva[`${slot}_nome`]
          }
        }
      }
      const { data, error } = await obterSupabase().rpc('sincronizar_escala', {
        p_data: dataIso, p_hoje: dataHojeIso(), p_linhas: linhas,
      })
      if (error) throw new Error(error.message)
      return Number(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
    },
    onError: (e) => toast.error(`Falha ao salvar a escala: ${e.message}`),
  })
}

export type AlteracaoSlot = {
  placa: string
  slot: PapelSlot
  codigo: string
  nome?: string
  origem?: string | null
  origemSlot?: PapelSlot | null
  pessoas: Colaborador[]
}

type CamposSlot = {
  papel: PapelEquipe
  codigo: 'motorista_codigo' | 'ajudante_codigo' | 'ajudante2_codigo' | 'chapa_codigo'
  nome: 'motorista_nome' | 'ajudante_nome' | 'ajudante2_nome' | 'chapa_nome'
  manual: 'motorista_manual' | 'ajudante_manual' | 'ajudante2_manual' | 'chapa_manual'
}

function camposSlot(slot: PapelSlot): CamposSlot {
  if (slot === 'motorista') {
    return { papel: 'motorista', codigo: 'motorista_codigo', nome: 'motorista_nome', manual: 'motorista_manual' }
  }
  if (slot === 'ajudante2') {
    return { papel: 'ajudante', codigo: 'ajudante2_codigo', nome: 'ajudante2_nome', manual: 'ajudante2_manual' }
  }
  if (slot === 'chapa') {
    return { papel: 'ajudante', codigo: 'chapa_codigo', nome: 'chapa_nome', manual: 'chapa_manual' }
  }
  return { papel: 'ajudante', codigo: 'ajudante_codigo', nome: 'ajudante_nome', manual: 'ajudante_manual' }
}

/**
 * Atribui uma pessoa ao slot de um veículo (port de assignPerson): bloqueia
 * quem tem ausência registrada no dia e troca com quem já estava naquele slot.
 */
export function useAtribuirPessoa(dataIso: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ placa, slot, codigo, nome, origem, origemSlot, pessoas }: AlteracaoSlot): Promise<void> => {
      const novoCodigo = code(codigo)
      const destino = camposSlot(slot)
      if (!novoCodigo && !(slot === 'chapa' && nome?.trim())) return
      const db = obterSupabase()

      const pessoaDaBase = pessoas.find((p) => p.tipo === destino.papel && code(p.codigo) === novoCodigo)
      if (novoCodigo && (slot !== 'chapa' || pessoaDaBase)) {
        const { data: ausente, error: erroAusencia } = await db
          .from('ausencias')
          .select('id')
          .eq('data', dataIso)
          .eq('papel', destino.papel)
          .eq('codigo', novoCodigo)
          .maybeSingle()
        if (erroAusencia) throw new Error(erroAusencia.message)
        if (ausente) {
          throw new Error('Remova o registro de ausência/folga antes de escalar esta pessoa')
        }
      }

      const { data: linhas, error: erroLinhas } = await db
        .from('escalas')
        .select('*')
        .eq('data_operacao', dataIso)
      if (erroLinhas) throw new Error(erroLinhas.message)

      const todas = (linhas ?? []) as EscalaLinha[]
      const alvo = todas.find((l) => l.veiculo_placa === placa)
      if (!alvo) throw new Error('Veículo não encontrado na escala do dia')

      const origemLinha = origem != null
        ? todas.find((l) => l.veiculo_placa === origem)
        : novoCodigo ? todas.find((l) => {
            if (l.veiculo_placa === placa) return false
            const codigos = destino.papel === 'motorista'
              ? [l.motorista_codigo]
              : [l.ajudante_codigo, l.ajudante2_codigo, l.chapa_codigo]
            return codigos.some((c) => code(c) === novoCodigo)
          }) : undefined
      const slotsOrigemAvaliaveis: PapelSlot[] = destino.papel === 'motorista'
        ? ['motorista']
        : ['ajudante', 'ajudante2', 'chapa']
      const slotOrigemReal = origemSlot ?? (origemLinha
        ? slotsOrigemAvaliaveis.find((slot) => code(origemLinha[camposSlot(slot).codigo]) === novoCodigo) ?? null
        : null)
      const campoOrigem = slotOrigemReal ? camposSlot(slotOrigemReal) : null

      const antigoCodigo = code(alvo[destino.codigo])
      const antigoNome = alvo[destino.nome] ?? ''
      const nomeDestino = nome?.trim() || pessoaDaBase?.nome || ''
      const atualizacoes = new Map<string, Record<string, string | boolean>>()
      atualizacoes.set(alvo.id, {
        [destino.codigo]: novoCodigo,
        [destino.nome]: nomeDestino,
        [destino.manual]: true,
        ...(slot === 'ajudante2'
          ? { chapa_codigo: '', chapa_nome: '', chapa_manual: true }
          : slot === 'chapa'
            ? { ajudante2_codigo: '', ajudante2_nome: '', ajudante2_manual: true }
            : {}),
      })

      if (origemLinha && campoOrigem && (origemLinha.id !== alvo.id || campoOrigem.codigo !== destino.codigo)) {
        const updateOrigem = atualizacoes.get(origemLinha.id) ?? {}
        Object.assign(updateOrigem, {
          [campoOrigem.codigo]: antigoCodigo,
          [campoOrigem.nome]: antigoCodigo ? antigoNome : '',
          [campoOrigem.manual]: true,
        })
        atualizacoes.set(origemLinha.id, updateOrigem)
      }

      for (const [id, dados] of atualizacoes) {
        const { error } = await db.from('escalas').update(dados).eq('id', id)
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
    mutationFn: async ({ placa, slot }: { placa: string; slot: PapelSlot }): Promise<void> => {
      const campos = camposSlot(slot)
      const atualizacao = slot === 'ajudante2' || slot === 'chapa'
        ? {
            ajudante2_codigo: '',
            ajudante2_nome: '',
            ajudante2_manual: true,
            chapa_codigo: '',
            chapa_nome: '',
            chapa_manual: true,
          }
        : { [campos.codigo]: '', [campos.nome]: '', [campos.manual]: true }
      const { error } = await obterSupabase()
        .from('escalas')
        .update(atualizacao)
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
        .update({ ...(patch.grupo !== undefined ? { sala: patch.grupo } : {}), ...(patch.observacao !== undefined ? { observacao: patch.observacao } : {}) })
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
        .update(camposEquipe(dados))
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

/** Restaura as equipes do dia, preservando os mapas arquivados (admin). */
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
      const { data: salvas, error: erroLeitura } = await db.from('escalas').select('*').eq('data_operacao', dataIso)
      if (erroLeitura) throw new Error(erroLeitura.message)
      const arquivo = montarEscala({ dataIso,
        veiculos: entrada.veiculosBase, mapas: entrada.mapas, pessoas: entrada.pessoas,
        equipes: entrada.equipes, salvas: (salvas ?? []) as EscalaLinha[],
      })
      const referencia = montarReferenciaEscala({
        dataIso, veiculos: arquivo.flatMap((v) => v.base ? [v.base] : []),
        mapas: arquivo.flatMap((v) => v.rotas), pessoas: entrada.pessoas,
        equipes: entrada.equipes, salvas: [],
      })
      const linhas = paraLinhasPersistencia(referencia, dataIso, entrada.pessoas)
      const { data, error } = await db.rpc('sincronizar_escala', {
        p_data: dataIso, p_hoje: dataHojeIso(), p_linhas: linhas, p_restaurar: true,
      })
      if (error) throw new Error(error.message)
      return Number(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['escalas', dataIso] })
      toast.success('Ajustes do dia removidos')
    },
    onError: (e) => toast.error(e.message),
  })
}

/** O comando de restaurar equipe não modifica mapas, data ou placa. */
function camposEquipe(dados: LinhaRestaurada) {
  return Object.fromEntries(Object.entries(dados).filter(([campo]) =>
    /^(motorista|ajudante|ajudante2|chapa)_(codigo|nome|manual)$/.test(campo) ||
    campo === 'sala' || campo === 'observacao',
  ))
}
