import { useQuery } from '@tanstack/react-query'
import { obterSupabase } from '@/lib/supabase'
import type { EscalaLinha } from '@/types/dominio'

export function useHistoricoFidelizacao(inicio: string, fim: string) {
  return useQuery({
    queryKey: ['escalas', fim, 'fidelizacao', inicio],
    queryFn: async () => {
      const linhas: EscalaLinha[] = []
      // Paginação evita truncar períodos que ultrapassem o limite de resposta do banco.
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await obterSupabase().from('escalas').select('*')
          .gte('data_operacao', inicio).lte('data_operacao', fim)
          .order('data_operacao').order('id').range(offset, offset + 999)
        if (error) throw new Error(error.message)
        linhas.push(...(data ?? []) as EscalaLinha[])
        if (!data || data.length < 1000) break
      }
      return linhas
    },
  })
}
