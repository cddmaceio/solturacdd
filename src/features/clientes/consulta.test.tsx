import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TelaClientes } from './tela-clientes'
import { DialogoClientesMapa } from './dialogo-clientes-mapa'
import type { Cliente } from './lib'

const cliente: Cliente = {
  codigo: '42234', nome: 'Mercado Central', codigo_roteirizador: '15742234',
  endereco: 'Rua A, 9', cidade: 'Maceió', estado: 'AL', setor: '121 - Barro duro',
  latitude: -9.616584, longitude: -35.719296, ultima_compra: '2026-10-16',
  penultima_compra: '2026-10-02', antepenultima_compra: null,
  na_base_clientes: true, na_base_roteirizador: true,
}
vi.mock('./api', () => ({
  useClientes: () => ({ data: [cliente], isLoading: false, error: null }),
  useImportarBaseClientes: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/autenticacao/auth-provider', () => ({ useAuth: () => ({ pode: (permissao: string) => permissao === 'bases.visualizar' }) }))

describe('consulta de clientes', () => {
  it('consulta por código prefixado e apresenta mapa e datas corretas', () => {
    render(<MemoryRouter initialEntries={['/clientes?codigo=15742234']}><TelaClientes /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Mercado Central' })).toBeInTheDocument()
    expect(screen.getByText('16/10/2026')).toBeInTheDocument()
    expect(screen.getByText('02/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Não informada na base')).toBeInTheDocument()
    expect(screen.getByTitle('Localização de Mercado Central')).toHaveAttribute('src', expect.stringContaining('marker=-9.616584,-35.719296'))
    expect(screen.queryByRole('button', { name: 'Importar clientes' })).not.toBeInTheDocument()
  })
  it('mostra nomes e códigos não encontrados no drilldown do PCD e permite filtrar', () => {
    render(<MemoryRouter><DialogoClientesMapa mapa={{ mapa: '100', clientes: '0042234/0099999/42234' }} onClose={vi.fn()} podeConsultar /></MemoryRouter>)
    expect(screen.getByText('2 cliente(s) · Nomes cruzados com as bases importadas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mercado Central' })).toHaveAttribute('href', '/clientes?codigo=42234')
    expect(screen.getByText('Não encontrado nas bases importadas')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Filtrar clientes do mapa' }), { target: { value: 'central' } })
    expect(screen.queryByText('Não encontrado nas bases importadas')).not.toBeInTheDocument()
    expect(screen.getByText('Mercado Central')).toBeInTheDocument()
  })
})
