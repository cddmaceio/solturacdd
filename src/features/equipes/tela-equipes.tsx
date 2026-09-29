import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { useAuth } from '@/features/autenticacao/auth-provider'
import {
  filtrarEquipes,
  useEquipes,
  useExcluirEquipe,
  useImportarEquipes,
} from '@/features/equipes/api'
import { DialogoEquipe } from '@/features/equipes/dialogo-equipe'
import { norm } from '@/lib/texto'
import type { EquipeComPessoas } from '@/types/dominio'

function situacaoStatus(status: string | undefined): 'ok' | 'aviso' | 'ruim' {
  const n = norm(status)
  if (!n || n.includes('DISPON')) return 'ok'
  if (n.includes('FERIA') || n.includes('INSS')) return 'aviso'
  return 'ruim'
}

export function TelaEquipes() {
  const { pode } = useAuth()
  const podeEditar = pode('bases.editar')
  const { data: equipes, isLoading, error } = useEquipes()
  const excluir = useExcluirEquipe()
  const importar = useImportarEquipes()

  const [busca, setBusca] = useState('')
  const [dialogo, setDialogo] = useState<{ aberto: boolean; equipe: EquipeComPessoas | null }>({
    aberto: false,
    equipe: null,
  })
  const [paraExcluir, setParaExcluir] = useState<EquipeComPessoas | null>(null)
  const inputArquivo = useRef<HTMLInputElement>(null)

  const lista = useMemo(() => filtrarEquipes(equipes ?? [], busca), [equipes, busca])

  const salas = useMemo(() => {
    const conjunto = new Set<string>()
    for (const e of equipes ?? []) {
      if (e.motorista?.sala) conjunto.add(e.motorista.sala)
      if (e.ajudante?.sala) conjunto.add(e.ajudante.sala)
    }
    return [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [equipes])

  const totalMotoristas = (equipes ?? []).filter((e) => e.motorista).length
  const totalAjudantes = (equipes ?? []).filter((e) => e.ajudante).length

  function aoImportar(arquivo: File) {
    importar.mutate(arquivo, {
      onError: (e) => toast.error(e.message),
      onSettled: () => {
        if (inputArquivo.current) inputArquivo.current.value = ''
      },
    })
  }

  function confirmarExclusao() {
    if (!paraExcluir) return
    const rotulo =
      [paraExcluir.motorista?.nome, paraExcluir.ajudante?.nome].filter(Boolean).join(' / ') ||
      'este registro'
    excluir.mutate(paraExcluir, {
      onSuccess: () => {
        toast.success(`${rotulo} excluído(s) da Base Equipes`)
        setParaExcluir(null)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Base Equipes"
        descricao="Pessoas disponíveis para montar a escala. Duplas de motorista × ajudante com sala e status base."
        acoes={
          <>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar motorista, ajudante, código…"
              className="h-9 w-64"
              aria-label="Buscar equipes"
            />
            {podeEditar && (
              <>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0]
                    if (arquivo) aoImportar(arquivo)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={importar.isPending}
                  onClick={() => inputArquivo.current?.click()}
                >
                  <Upload className="size-4" />
                  {importar.isPending ? 'Importando…' : 'Importar XLSX'}
                </Button>
                <Button size="sm" onClick={() => setDialogo({ aberto: true, equipe: null })}>
                  <Plus className="size-4" /> Adicionar equipe
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <b className="text-foreground">{equipes?.length ?? 0}</b> equipe(s)
        </span>
        <span>
          <b className="text-foreground">{totalMotoristas}</b> motorista(s)
        </span>
        <span>
          <b className="text-foreground">{totalAjudantes}</b> ajudante(s)
        </span>
        {podeEditar && <span className="ml-auto text-xs">Alterações são salvas no banco</span>}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cod. M.</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Cod. A.</TableHead>
                <TableHead>Ajudante</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead>Status base</TableHead>
                {podeEditar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Carregando equipes…
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    {error.message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhuma equipe encontrada.
                  </TableCell>
                </TableRow>
              )}
              {lista.map((e) => {
                const status = e.motorista?.status || e.ajudante?.status || ''
                const situacao = situacaoStatus(status)
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.motorista?.codigo || '—'}</TableCell>
                    <TableCell className="font-semibold">
                      {e.motorista?.nome || '—'}
                    </TableCell>
                    <TableCell className="font-medium">{e.ajudante?.codigo || '—'}</TableCell>
                    <TableCell>{e.ajudante?.nome || '—'}</TableCell>
                    <TableCell>{e.motorista?.sala || e.ajudante?.sala || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          situacao === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : situacao === 'aviso'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                        }
                      >
                        {status || '—'}
                      </Badge>
                    </TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Editar"
                            onClick={() => setDialogo({ aberto: true, equipe: e })}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setParaExcluir(e)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <DialogoEquipe
        aberto={dialogo.aberto}
        equipe={dialogo.equipe}
        salas={salas}
        onFechar={() => setDialogo({ aberto: false, equipe: null })}
      />

      <AlertDialog
        open={Boolean(paraExcluir)}
        onOpenChange={(aberto) => !aberto && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {[paraExcluir?.motorista?.nome, paraExcluir?.ajudante?.nome]
                .filter(Boolean)
                .join(' / ') || 'esta equipe'}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O cadastro sai da Base Equipes. As pessoas permanecem nas escalas já salvas,
              e os registros de ausência são preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmarExclusao}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
