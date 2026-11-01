import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DialogoMapaClientes } from './dialogo-mapa-clientes'
import { montarEscala } from './montagem'
import { entrada } from './fixtures-arquivo'

vi.mock('@/features/clientes/api', () => ({ useClientes: () => ({
  data: [{ codigo: '42234', nome: 'Mercado Central', latitude: -9.6, longitude: -35.7 }, { codigo: '12', nome: 'Sem coordenadas', latitude: null, longitude: null }],
  isLoading: false, error: null,
}) }))
vi.mock('./mapa-pontos-clientes', () => ({ default: ({ pontos, selecionado }: { pontos: unknown[]; selecionado: string | null }) => <div data-testid="mapa">{pontos.length} ponto(s) · {selecionado ?? 'todos'}</div> }))

describe('mapa de clientes da escala', () => {
  it('mostra a cobertura e permite localizar um cliente e voltar à visão geral', async () => {
    const [veiculo] = montarEscala(entrada())
    veiculo.rotas = [{ ...veiculo.rotas[0], clientes: '0042234/12/99' }]
    render(<DialogoMapaClientes veiculo={veiculo} dataIso="2026-09-28" onClose={vi.fn()} />)
    expect(screen.getByText('1 de 3 cliente(s) com localização · 2 sem coordenadas ou sem cadastro')).toBeInTheDocument()
    expect(await screen.findByTestId('mapa')).toHaveTextContent('1 ponto(s) · todos')
    fireEvent.click(screen.getByRole('button', { name: /Mercado Central/ }))
    expect(screen.getByTestId('mapa')).toHaveTextContent('42234')
    expect(screen.getByRole('button', { name: /Sem coordenadas/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os pontos' }))
    expect(screen.getByTestId('mapa')).toHaveTextContent('todos')
  })
})
