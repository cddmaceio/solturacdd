import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VeiculoEscala } from '@/features/escala/montagem'
import { AnaliseFidelizacao } from './analise-fidelizacao'

const { historico } = vi.hoisted(() => ({ historico: vi.fn() }))
vi.mock('./api', () => ({ useHistoricoFidelizacao: historico }))
vi.mock('@/lib/datas', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/datas')>(),
  dataHojeIso: () => '2026-10-21',
}))

describe('painel de análise da fidelização', () => {
  beforeEach(() => historico.mockReturnValue({ data: [], isPending: false, isError: false }))

  it('exibe gráficos e recalcula o Pareto ao alternar entre frota e ajudante', () => {
    const v = { chave: 'ABC', carregado: true, motorista_codigo: '10', ajudante_codigo: '30',
      ajudante_referencia: '20', base: { motorista_fixo_codigo: '10', motorista_fixo_nome: 'Ana' },
      observacao: 'Folga',
    } as VeiculoEscala
    render(<AnaliseFidelizacao dataIso="2026-10-21" veiculos={[v]} />)
    expect(screen.getByRole('img', { name: /Gráfico de colunas/ })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma quebra de fidelização no período.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ajudante' }))
    expect(screen.getByRole('img', { name: /Pareto de justificativas/ })).toBeInTheDocument()
    expect(screen.getByText('1. Folga', { selector: 'td' })).toBeInTheDocument()
    expect(historico).toHaveBeenLastCalledWith('2026-10-01', '2026-10-21')
    expect(screen.queryByRole('group', { name: 'Período da análise' })).not.toBeInTheDocument()
  })

  it('mantém o mês atual mesmo quando a data da escala pertence a outro mês', () => {
    render(<AnaliseFidelizacao dataIso="2026-09-28" veiculos={[]} />)
    expect(historico).toHaveBeenLastCalledWith('2026-10-01', '2026-10-21')
    expect(screen.getByText(/Mês atual · 01\/10\/2026 a 21\/10\/2026/)).toBeInTheDocument()
  })

  it('diferencia ausência de dados de falha no carregamento', () => {
    const { rerender } = render(<AnaliseFidelizacao dataIso="2026-10-21" veiculos={[]} />)
    expect(screen.getByText('Sem base elegível no período para analisar as justificativas.')).toBeInTheDocument()
    const refetch = vi.fn()
    historico.mockReturnValue({ isError: true, error: new Error('Falha de conexão'), refetch })
    rerender(<AnaliseFidelizacao dataIso="2026-10-21" veiculos={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de conexão')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
