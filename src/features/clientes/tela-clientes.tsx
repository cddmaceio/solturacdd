import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Upload, Users } from 'lucide-react'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { buscaClienteValida, TAMANHO_PAGINA_CLIENTES, usePesquisarClientes, useResumoBasesClientes, useImportarBaseClientes } from './api'
import { type TipoBase } from './lib'
import { DetalheCliente } from './detalhe-cliente'

export function TelaClientes() {
  const { pode } = useAuth()
  const [params, setParams] = useSearchParams()
  const busca = params.get('codigo') ?? ''
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [consulta, setConsulta] = useState({ termo: busca.trim(), pagina: 0 })
  const aguardando = consulta.termo !== busca.trim()
  const valida = buscaClienteValida(busca)
  const { data: resultado, isLoading, error } = usePesquisarClientes(consulta.termo, consulta.pagina, !aguardando)
  const resumo = useResumoBasesClientes()
  const importar = useImportarBaseClientes()
  const arquivoClientes = useRef<HTMLInputElement>(null)
  const arquivoRoteirizador = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => setConsulta((atual) => atual.termo === busca.trim() ? atual : { termo: busca.trim(), pagina: 0 }), 250)
    return () => clearTimeout(timer)
  }, [busca])
  const resultados = resultado?.clientes ?? []
  const cliente = resultados.find((c) => c.codigo === selecionado) ?? resultados[0]
  const pesquisando = valida && (aguardando || isLoading)

  function mudarPagina(pagina: number) {
    setSelecionado(null)
    setConsulta((atual) => ({ ...atual, pagina }))
  }

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
        ['clientes', 'Base clientes', 'Código e nome fantasia', arquivoClientes, resumo.data?.clientes],
        ['roteirizador', 'Base roteirizador', 'Endereço, setor, coordenadas e compras · prefixo 157 tratado automaticamente', arquivoRoteirizador, resumo.data?.roteirizador],
      ] as const).map(([tipo, titulo, descricao, ref, total]) => <div key={tipo} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div><h2 className="font-semibold">{titulo} <span className="ml-2 text-xs font-normal text-muted-foreground">{total == null ? resumo.error ? 'Total indisponível' : 'Consultando total…' : `${total.toLocaleString('pt-BR')} clientes`}</span></h2><p className="mt-1 text-xs text-muted-foreground">{descricao}</p></div>
        {pode('bases.editar') && <>{entrada(tipo, ref)}<Button variant="outline" size="sm" disabled={importar.isPending} onClick={() => ref.current?.click()}><Upload className="size-4" />Importar {tipo === 'clientes' ? 'clientes' : 'roteirizador'}</Button></>}
      </div>)}
    </div>
    <p className="mb-5 text-xs text-muted-foreground">A importação adiciona clientes e atualiza os códigos existentes; códigos ausentes no arquivo são preservados. Em códigos repetidos, vale a última linha do arquivo.</p>
    {importar.isPending && <p role="status" className="mb-4 text-sm">Importando base… Aguarde a confirmação.</p>}
    <div className="relative mb-5 max-w-xl"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input className="h-10 pl-9" aria-label="Buscar cliente por código ou nome" placeholder="Digite o código ou nome do cliente…" value={busca} onChange={(e) => { setParams(e.target.value ? { codigo: e.target.value } : {}, { replace: true }); setSelecionado(null) }} /></div>
    {!busca.trim() ? <div className="grid min-h-64 place-content-center justify-items-center gap-3 rounded-xl border border-dashed text-center text-muted-foreground"><Users className="size-9" /><p>{resumo.data?.clientes === 0 && resumo.data?.roteirizador === 0 ? 'Importe uma base para começar a consultar clientes.' : 'Informe um código ou nome para consultar.'}</p></div> : !valida ? <p role="status" className="text-sm text-muted-foreground">Digite um código ou pelo menos 3 letras do nome.</p> : pesquisando ? <p role="status">Buscando clientes…</p> : error ? <p role="alert" className="text-destructive">{error.message}</p> : <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>{resultados.length ? `Exibindo ${consulta.pagina * TAMANHO_PAGINA_CLIENTES + 1}–${consulta.pagina * TAMANHO_PAGINA_CLIENTES + resultados.length}${resultado?.temMais ? ' · Há mais resultados' : ''}` : `Nenhum cliente encontrado para “${busca}”.`}</p>
        {(consulta.pagina > 0 || resultado?.temMais) && <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={consulta.pagina === 0} onClick={() => mudarPagina(consulta.pagina - 1)}>Anterior</Button><span>Página {consulta.pagina + 1}</span><Button variant="outline" size="sm" disabled={!resultado?.temMais} onClick={() => mudarPagina(consulta.pagina + 1)}>Próxima</Button></div>}
      </div>
      {cliente && <>
      <div className={`grid gap-4 ${resultados.length > 1 ? 'xl:grid-cols-[280px_1fr]' : ''}`}>
        {resultados.length > 1 && <div className="max-h-[500px] overflow-auto rounded-xl border bg-card p-2" aria-label="Resultados da consulta">{resultados.map((c) => <button key={c.codigo} type="button" aria-pressed={c.codigo === cliente.codigo} onClick={() => setSelecionado(c.codigo)} className={`mb-1 block w-full rounded-lg p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${c.codigo === cliente.codigo ? 'bg-muted ring-1 ring-border' : ''}`}><span className="block text-xs text-muted-foreground">{c.codigo}</span><span className="font-medium">{c.nome}</span></button>)}</div>}
        <div className="rounded-xl border bg-card p-5"><DetalheCliente cliente={cliente} /></div>
      </div>
      </>}
    </>}
  </div>
}
