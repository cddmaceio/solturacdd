import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useClientes } from './api'
import { codigosDoMapa, localizarCliente } from './lib'
import { norm } from '@/lib/texto'

export function DialogoClientesMapa({ mapa, onClose, podeConsultar }: {
  mapa: { mapa: string; clientes: string | null } | null
  onClose: () => void
  podeConsultar: boolean
}) {
  const { data: clientes = [], isLoading, error } = useClientes(!!mapa)
  const [busca, setBusca] = useState('')
  const indice = useMemo(() => new Map(clientes.map((c) => [c.codigo, c])), [clientes])
  const codigos = codigosDoMapa(mapa?.clientes ?? null)
  const linhas = codigos.map((codigo) => ({ codigo, cliente: localizarCliente(codigo, indice) }))
    .filter(({ codigo, cliente }) => norm(`${codigo} ${cliente?.nome ?? ''} ${cliente?.setor ?? ''}`).includes(norm(busca)))
    .sort((a, b) => (a.cliente?.nome ?? a.codigo).localeCompare(b.cliente?.nome ?? b.codigo, 'pt-BR', { numeric: true }))
  return <Dialog open={!!mapa} onOpenChange={(aberto) => { if (!aberto) { setBusca(''); onClose() } }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Clientes do mapa {mapa?.mapa}</DialogTitle><DialogDescription>{codigos.length} cliente(s) · Nomes cruzados com as bases importadas.</DialogDescription></DialogHeader>
      <Input aria-label="Filtrar clientes do mapa" placeholder="Filtrar por código, nome ou setor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {isLoading ? <p role="status">Carregando nomes dos clientes…</p> : <>
        {error && <p role="alert" className="text-destructive">{error.message} Os códigos do mapa continuam disponíveis.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3">Código</th><th className="p-3">Nome do cliente</th><th className="p-3">Setor / cidade</th></tr></thead><tbody>{linhas.map(({ codigo, cliente }) => <tr key={codigo} className="border-b last:border-0"><td className="p-3 tabular-nums">{codigo}</td><td className="p-3 font-medium">{cliente ? podeConsultar ? <Link onClick={onClose} className="text-primary underline underline-offset-4" to={`/clientes?codigo=${cliente.codigo}`}>{cliente.nome}</Link> : cliente.nome : <span className="font-normal text-muted-foreground">Não encontrado nas bases importadas</span>}</td><td className="p-3 text-muted-foreground">{[cliente?.setor, cliente?.cidade].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div>
        {!linhas.length && <p className="py-6 text-center text-muted-foreground">Nenhum cliente para exibir.</p>}
      </>}
    </DialogContent>
  </Dialog>
}
