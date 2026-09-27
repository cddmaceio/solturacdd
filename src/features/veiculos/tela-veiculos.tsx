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
  useExcluirVeiculo,
  useImportarFidelidade,
  useSalvarVeiculo,
  useVeiculos,
  type NovoVeiculo,
} from '@/features/veiculos/api'
import { DialogoVeiculo } from '@/features/veiculos/dialogo-veiculo'
import { ordenarVeiculos, situacaoDisponibilidade, tipoNormalizado } from '@/features/veiculos/lib'
import { norm } from '@/lib/texto'
import type { Veiculo } from '@/types/dominio'

export function TelaVeiculos() {
  const { pode } = useAuth()
  const podeEditar = pode('bases.editar')
  const { data: veiculos, isLoading, error } = useVeiculos()
  const salvar = useSalvarVeiculo()
  const excluir = useExcluirVeiculo()
  const importar = useImportarFidelidade()

  const [busca, setBusca] = useState('')
  const [dialogo, setDialogo] = useState<{ aberto: boolean; veiculo: Veiculo | null }>({
    aberto: false,
    veiculo: null,
  })
  const [paraExcluir, setParaExcluir] = useState<Veiculo | null>(null)
  const inputArquivo = useRef<HTMLInputElement>(null)

  const lista = useMemo(() => {
    const ordenada = ordenarVeiculos(veiculos ?? [])
    const q = norm(busca)
    if (!q) return ordenada
    return ordenada.filter((v) =>
      norm(
        [
          v.placa,
          v.tipo_veiculo,
          v.frota,
          v.disponibilidade,
          v.motorista_fixo_codigo,
          v.motorista_fixo_nome,
        ].join(' '),
      ).includes(q),
    )
  }, [veiculos, busca])

  function aoSalvar(dados: { id?: string; veiculo: NovoVeiculo }) {
    salvar.mutate(dados, {
      onSuccess: () => {
        toast.success(dados.id ? 'Veículo atualizado' : 'Veículo adicionado')
        setDialogo({ aberto: false, veiculo: null })
      },
      onError: (e) => toast.error(e.message),
    })
  }

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
    excluir.mutate(paraExcluir.id, {
      onSuccess: () => {
        toast.success(`Veículo ${paraExcluir.placa} excluído`)
        setParaExcluir(null)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Base Fidelização"
        descricao="Referência de frota e motorista fidelizado. A placa vincula o veículo aos mapas do PCD; equipes e ajudantes são mantidos na Base Equipes."
        acoes={
          <>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar placa, tipo, frota, motorista…"
              className="h-9 w-64"
              aria-label="Buscar veículos"
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
                <Button size="sm" onClick={() => setDialogo({ aberto: true, veiculo: null })}>
                  <Plus className="size-4" /> Adicionar veículo
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-3 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          <b className="text-foreground">{veiculos?.length ?? 0}</b> veículo(s) cadastrado(s)
        </span>
        {lista.length !== (veiculos?.length ?? 0) && (
          <span>
            · <b className="text-foreground">{lista.length}</b> exibido(s) com a busca
          </span>
        )}
        {podeEditar && <span className="ml-auto text-xs">Alterações são salvas no banco</span>}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="max-h-[calc(100dvh-260px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Disp.</TableHead>
                <TableHead>Cod. M.</TableHead>
                <TableHead>Motorista</TableHead>
                {podeEditar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={podeEditar ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    Carregando base…
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={podeEditar ? 7 : 6} className="h-24 text-center text-destructive">
                    {error.message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={podeEditar ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    Nenhum veículo encontrado.
                  </TableCell>
                </TableRow>
              )}
              {lista.map((v) => {
                const situacao = situacaoDisponibilidade(v.disponibilidade)
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-bold">{v.placa}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tipoNormalizado(v.tipo_veiculo)}</Badge>
                    </TableCell>
                    <TableCell>{v.frota || '—'}</TableCell>
                    <TableCell>
                      <span
                        className={
                          situacao === 'ruim'
                            ? 'text-destructive'
                            : situacao === 'ok'
                              ? 'text-emerald-600'
                              : 'text-muted-foreground'
                        }
                      >
                        {v.disponibilidade || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{v.motorista_fixo_codigo || '—'}</TableCell>
                    <TableCell>{v.motorista_fixo_nome || '—'}</TableCell>
                    {podeEditar && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Editar"
                            onClick={() => setDialogo({ aberto: true, veiculo: v })}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setParaExcluir(v)}
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

      <DialogoVeiculo
        aberto={dialogo.aberto}
        veiculo={dialogo.veiculo}
        salvasExistentes={veiculos ?? []}
        onFechar={() => setDialogo({ aberto: false, veiculo: null })}
        onSalvar={aoSalvar}
      />

      <AlertDialog
        open={Boolean(paraExcluir)}
        onOpenChange={(aberto) => !aberto && setParaExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o veículo {paraExcluir?.placa}?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro sai da Base Fidelização. Escalas já salvas em datas anteriores são
              preservadas.
              {paraExcluir &&
                veiculos &&
                ` Se houver mapa do PCD para esta placa, ela passará a aparecer como SPOT.`}
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
