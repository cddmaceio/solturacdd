import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { textoDoArquivo } from '@/lib/csv'
import { codigoRoteirizador, parsearBase, type Cliente, type TipoBase } from './lib'
import { code } from '@/lib/texto'

export const TAMANHO_PAGINA_CLIENTES = 50

export function buscaClienteValida(termo: string) {
  return /^\d+$/.test(termo.trim()) || termo.trim().length >= 3
}

export function usePesquisarClientes(termo: string, pagina: number, habilitado = true) {
  return useQuery({
    queryKey: ['consulta_clientes', 'busca', termo.trim(), pagina],
    enabled: habilitado && buscaClienteValida(termo),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await obterSupabase().rpc('buscar_clientes', { termo: termo.trim(), pagina }).abortSignal(signal)
      if (error) throw new Error(`Não foi possível buscar clientes: ${error.message}`)
      const linhas = (data ?? []) as Cliente[]
      return { clientes: linhas.slice(0, TAMANHO_PAGINA_CLIENTES), temMais: linhas.length > TAMANHO_PAGINA_CLIENTES }
    },
  })
}

export function useResumoBasesClientes() {
  return useQuery({
    queryKey: ['consulta_clientes', 'resumo'],
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const [clientes, roteirizador] = await Promise.all([
        obterSupabase().from('base_clientes').select('codigo', { count: 'exact', head: true }).abortSignal(signal),
        obterSupabase().from('base_roteirizador').select('codigo', { count: 'exact', head: true }).abortSignal(signal),
      ])
      if (clientes.error || roteirizador.error) throw new Error('Não foi possível consultar os totais das bases.')
      return { clientes: clientes.count ?? 0, roteirizador: roteirizador.count ?? 0 }
    },
  })
}

export function useClientesPorCodigos(codigos: string[]) {
  const normalizados = [...new Set(codigos.flatMap((c) => [code(c), codigoRoteirizador(c)]))].filter(Boolean).sort()
  return useQuery({
    queryKey: ['consulta_clientes', 'codigos', normalizados],
    enabled: normalizados.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<Cliente[]> => {
      const clientes: Cliente[] = []
      // Lotes pequenos evitam URLs extensas e o limite de resultados do PostgREST.
      for (let inicio = 0; inicio < normalizados.length; inicio += 400) {
        const lotes = []
        for (let i = inicio; i < Math.min(inicio + 400, normalizados.length); i += 100) {
          lotes.push(obterSupabase().from('consulta_clientes').select('*').in('codigo', normalizados.slice(i, i + 100)).abortSignal(signal))
        }
        const resultados = await Promise.all(lotes)
        for (const { data, error } of resultados) {
          if (error) throw new Error(`Não foi possível carregar os clientes selecionados: ${error.message}`)
          clientes.push(...(data ?? []) as Cliente[])
        }
      }
      return clientes
    },
  })
}

export function useImportarBaseClientes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ arquivo, tipo }: { arquivo: File; tipo: TipoBase }) => {
      const { registros, duplicados, ignorados } = parsearBase(await textoDoArquivo(arquivo), tipo)
      const { data, error } = await obterSupabase().rpc('importar_base_clientes', { tipo, registros })
      if (error) throw new Error(error.message)
      return { total: data as number, duplicados, ignorados }
    },
    onSuccess: ({ total, duplicados, ignorados }) => {
      void qc.invalidateQueries({ queryKey: ['consulta_clientes'] })
      toast.success(`${total} cliente(s) importado(s).${duplicados ? ` ${duplicados} código(s) repetido(s): utilizada a última ocorrência.` : ''}${ignorados ? ` ${ignorados} linha(s) sem código ou nome válido ignorada(s).` : ''}`)
    },
    onError: (erro) => toast.error(erro.message),
  })
}
