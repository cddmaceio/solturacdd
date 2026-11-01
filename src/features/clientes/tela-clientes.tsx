import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Upload, Users } from 'lucide-react'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { norm } from '@/lib/texto'
import { useClientes, useImportarBaseClientes } from './api'
import { localizarCliente, type TipoBase } from './lib'
import { DetalheCliente } from './detalhe-cliente'

export function TelaClientes() {
  const { pode } = useAuth()
  const [params, setParams] = useSearchParams()
  const busca = params.get('codigo') ?? ''
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const { data: clientes = [], isLoading, error } = useClientes()
  const importar = useImportarBaseClientes()
  const arquivoClientes = useRef<HTMLInputElement>(null)
  const arquivoRoteirizador = useRef<HTMLInputElement>(null)
  const indice = useMemo(() => new Map(clientes.map((c) => [c.codigo, c])), [clientes])
  const resultados = useMemo(() => {
    const q = norm(busca)
    if (!q) return []
    const exato = localizarCliente(busca, indice)
    if (exato) return [exato]
    return clientes.filter((c) => c.codigo.includes(q) || c.codigo_roteirizador?.includes(q) || norm(c.nome).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [clientes, busca, indice])
  const cliente = resultados.find((c) => c.codigo === selecionado) ?? resultados[0]

  function entrada(tipo: TipoBase, ref: React.RefObject<HTMLInputElement | null>) {
    return <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" aria-label={`Arquivo da base ${tipo}`}
      onChange={(e) => {
        const arquivo = e.target.files?.[0]
        if (arquivo) importar.mutate({ arquivo, tipo })
        e.target.value = ''
      }} />
  }

  return <div>
    <CabecalhoPagina titulo="Consulta Clientes" descricao="Busque pelo código ou nome e consulte os dados cruzados das duas bases." />
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {([
        ['clientes', 'Base clientes', 'Código e nome fantasia', arquivoClientes, clientes.filter((c) => c.na_base_clientes).length],
        ['roteirizador', 'Base roteirizador', 'Endereço, setor, coordenadas e compras · prefixo 157 tratado automaticamente', arquivoRoteirizador, clientes.filter((c) => c.na_base_roteirizador).length],
      ] as const).map(([tipo, titulo, descricao, ref, total]) => <div key={tipo} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div><h2 className="font-semibold">{titulo} <span className="ml-2 text-xs font-normal text-muted-foreground">{total.toLocaleString('pt-BR')} clientes</span></h2><p className="mt-1 text-xs text-muted-foreground">{descricao}</p></div>
        {pode('bases.editar') && <>{entrada(tipo, ref)}<Button variant="outline" size="sm" disabled={importar.isPending} onClick={() => ref.current?.click()}><Upload className="size-4" />Importar {tipo === 'clientes' ? 'clientes' : 'roteirizador'}</Button></>}
      </div>)}
    </div>
    <p className="mb-5 text-xs text-muted-foreground">A importação adiciona clientes e atualiza os códigos existentes; códigos ausentes no arquivo são preservados. Em códigos repetidos, vale a última linha do arquivo.</p>
    {importar.isPending && <p role="status" className="mb-4 text-sm">Importando base… Aguarde a confirmação.</p>}
    <div className="relative mb-5 max-w-xl"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input className="h-10 pl-9" aria-label="Buscar cliente por código ou nome" placeholder="Digite o código ou nome do cliente…" value={busca} onChange={(e) => { setParams(e.target.value ? { codigo: e.target.value } : {}, { replace: true }); setSelecionado(null) }} /></div>
    {isLoading ? <p role="status">Carregando clientes…</p> : error ? <p role="alert" className="text-destructive">{error.message}</p> : !busca.trim() ? <div className="grid min-h-64 place-content-center justify-items-center gap-3 rounded-xl border border-dashed text-center text-muted-foreground"><Users className="size-9" /><p>{clientes.length ? 'Informe um código ou nome para consultar.' : 'Importe uma base para começar a consultar clientes.'}</p></div> : !cliente ? <p role="status" className="rounded-xl border p-6 text-muted-foreground">Nenhum cliente encontrado para “{busca}”.</p> : <>
      <p className="mb-3 text-sm text-muted-foreground">{resultados.length} cliente(s) encontrado(s)</p>
      <div className={`grid gap-4 ${resultados.length > 1 ? 'xl:grid-cols-[280px_1fr]' : ''}`}>
        {resultados.length > 1 && <div className="max-h-[500px] overflow-auto rounded-xl border bg-card p-2" aria-label="Resultados da consulta">{resultados.slice(0, 100).map((c) => <button key={c.codigo} type="button" aria-pressed={c.codigo === cliente.codigo} onClick={() => setSelecionado(c.codigo)} className={`mb-1 block w-full rounded-lg p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${c.codigo === cliente.codigo ? 'bg-muted ring-1 ring-border' : ''}`}><span className="block text-xs text-muted-foreground">{c.codigo}</span><span className="font-medium">{c.nome}</span></button>)}{resultados.length > 100 && <p className="p-3 text-xs text-muted-foreground">Exibindo 100 resultados. Refine a busca.</p>}</div>}
        <div className="rounded-xl border bg-card p-5"><DetalheCliente cliente={cliente} /></div>
      </div>
    </>}
  </div>
}
