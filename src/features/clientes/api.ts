import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { obterSupabase } from '@/lib/supabase'
import { textoDoArquivo } from '@/lib/csv'
import { parsearBase, type Cliente, type TipoBase } from './lib'

export function useClientes(habilitado = true) {
  return useQuery({
    queryKey: ['consulta_clientes'],
    enabled: habilitado,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Cliente[]> => {
      const clientes: Cliente[] = []
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await obterSupabase().from('consulta_clientes').select('*')
          .order('codigo').range(inicio, inicio + 999)
        if (error) throw new Error(`Não foi possível carregar a base de clientes: ${error.message}`)
        clientes.push(...(data ?? []) as Cliente[])
        if ((data?.length ?? 0) < 1000) return clientes
      }
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
