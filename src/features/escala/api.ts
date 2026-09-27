import { useQuery } from '@tanstack/react-query'
import { obterSupabase } from '@/lib/supabase'
import type { EscalaLinha } from '@/types/dominio'

/** Linhas de escala persistidas para a data (inclui placas vazias — estado completo). */
export function useEscalas(dataIso: string) {
  return useQuery({
    queryKey: ['escalas', dataIso],
    queryFn: async (): Promise<EscalaLinha[]> => {
      const { data, error } = await obterSupabase()
        .from('escalas')
        .select('*')
        .eq('data_operacao', dataIso)
        .order('veiculo_placa', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as EscalaLinha[]
    },
  })
}
