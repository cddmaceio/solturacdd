import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { norm } from '@/lib/texto'
import { carregarPlanilha, encontrarAba, ler } from '@/lib/planilhas'
import type { Veiculo } from '@/types/dominio'

const CABECALHOS_FIDELIDADE = [
  'PLACA',
  'FROTA',
  'DISP',
  'CODM',
  'MOTORISTA',
  'TIPOVEICULO',
]

export function useVeiculos() {
  return useQuery({
    queryKey: ['veiculos'],
    queryFn: async (): Promise<Veiculo[]> => {
      const { data, error } = await obterSupabase()
        .from('veiculos')
        .select('*')
        .order('placa', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as Veiculo[]
    },
  })
}

export type NovoVeiculo = Omit<Veiculo, 'id' | 'ativo'>

export function useSalvarVeiculo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, veiculo }: { id?: string; veiculo: NovoVeiculo }) => {
      const db = obterSupabase()
      if (id) {
        const { error } = await db.from('veiculos').update(veiculo).eq('id', id)
        if (error) throw traduzErro(error.message)
      } else {
        const { error } = await db.from('veiculos').insert(veiculo)
        if (error) throw traduzErro(error.message)
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['veiculos'] }),
  })
}

export function useExcluirVeiculo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await obterSupabase().from('veiculos').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['veiculos'] }),
  })
}

function traduzErro(mensagem: string): Error {
  if (mensagem.includes('veiculos_placa_key')) return new Error('Esta placa já existe na base')
  return new Error(mensagem)
}

function montarLinha(linha: unknown[], chaves: string[]): NovoVeiculo {
  return {
    placa: ler(linha, chaves, 'PLACA').toUpperCase(),
    tipo_veiculo: ler(linha, chaves, 'TIPOVEICULO') || 'OUTRO',
    frota: ler(linha, chaves, 'FROTA'),
    disponibilidade: ler(linha, chaves, 'DISP'),
    motorista_fixo_codigo: ler(linha, chaves, 'CODM'),
    motorista_fixo_nome: ler(linha, chaves, 'MOTORISTA'),
  }
}

/** Importa a Base Fidelização (XLSX): SUBSTITUI toda a base existente. */
export function useImportarFidelidade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (arquivo: File): Promise<{ total: number; duplicadas: number }> => {
      const wb = await carregarPlanilha(arquivo)
      const aba = encontrarAba(wb, CABECALHOS_FIDELIDADE)
      if (!aba) {
        throw new Error(
          'Planilha inválida. Use as colunas: Placa, Frota, DISP, Cod. M., Motorista e tipo veículo.',
        )
      }
      const linhas: NovoVeiculo[] = []
      const vistas = new Set<string>()
      let duplicadas = 0
      for (let i = 1; i < aba.linhas.length; i++) {
        const linha = aba.linhas[i]
        const veiculo = montarLinha(linha, aba.chaves)
        if (!veiculo.placa) continue
        const chave = norm(veiculo.placa)
        if (vistas.has(chave)) {
          duplicadas++
          continue
        }
        vistas.add(chave)
        linhas.push(veiculo)
      }
      if (!linhas.length) throw new Error('Nenhuma placa válida encontrada na planilha')

      const db = obterSupabase()
      const { error: erroExcluir } = await db.from('veiculos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (erroExcluir) throw new Error(erroExcluir.message)

      for (let i = 0; i < linhas.length; i += 400) {
        const fatia = linhas.slice(i, i + 400)
        const { error } = await db.from('veiculos').insert(fatia)
        if (error) throw new Error(error.message)
      }
      return { total: linhas.length, duplicadas }
    },
    onSuccess: (resultado) => {
      void qc.invalidateQueries({ queryKey: ['veiculos'] })
      toast.success(
        `Base Fidelização importada: ${resultado.total} placa(s)` +
          (resultado.duplicadas ? ` · ${resultado.duplicadas} duplicada(s) ignorada(s)` : ''),
      )
    },
  })
}
