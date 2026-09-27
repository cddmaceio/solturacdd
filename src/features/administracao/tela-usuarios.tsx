import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  useCriarUsuario,
  useDefinirAtivo,
  useDefinirPapel,
  useRedefinirSenha,
  useUsuarios,
} from '@/features/administracao/api'
import { PAPEIS, ROTULO_PAPEL } from '@/lib/rbac'
import { paraDmy } from '@/lib/datas'

export function TelaUsuarios() {
  const { sessao } = useAuth()
  const { data: usuarios, isLoading, error } = useUsuarios()
  const criar = useCriarUsuario()
  const definirPapel = useDefinirPapel()
  const definirAtivo = useDefinirAtivo()
  const redefinirSenha = useRedefinirSenha()

  const [dialogoCriar, setDialogoCriar] = useState(false)
  const [form, setForm] = useState({ email: '', senha: '', nome: '', papel: 'operador' })
  const [erroForm, setErroForm] = useState('')
  const [paraRedefinir, setParaRedefinir] = useState<{ id: string; nome: string } | null>(null)
  const [novaSenha, setNovaSenha] = useState('')

  const lista = useMemo(() => usuarios ?? [], [usuarios])

  function criarUsuario() {
    setErroForm('')
    if (!form.email.trim() || !form.senha) {
      setErroForm('Informe email e senha')
      return
    }
    if (form.senha.length < 8) {
      setErroForm('A senha precisa de ao menos 8 caracteres')
      return
    }
    criar.mutate(
      {
        email: form.email.trim(),
        senha: form.senha,
        nome: form.nome.trim(),
        papel: form.papel,
      },
      {
        onSuccess: () => {
          setDialogoCriar(false)
          setForm({ email: '', senha: '', nome: '', papel: 'operador' })
        },
        onError: (e) => setErroForm(e.message),
      },
    )
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Administração · Usuários"
        descricao="Usuários do sistema, papel de acesso e situação do cadastro."
        acoes={
          <Button size="sm" onClick={() => setDialogoCriar(true)}>
            <Plus className="size-4" /> Novo usuário
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="max-h-[calc(100dvh-240px)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Carregando usuários…
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    {(error as Error).message}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && lista.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
              {lista.map((u) => {
                const eu = u.id === sessao?.user.id
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold">
                      {u.nome || '—'}
                      {eu && (
                        <Badge variant="outline" className="ml-2 border-sky-200 bg-sky-50 text-sky-700">
                          você
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.papel || undefined}
                        onValueChange={(papel) =>
                          definirPapel.mutate(
                            { usuario_id: u.id, papel },
                            { onError: (e) => toast.error(e.message) },
                          )
                        }
                        disabled={eu}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue placeholder="Sem papel" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAPEIS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {ROTULO_PAPEL[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.ativo}
                          disabled={eu}
                          onCheckedChange={(ativo) =>
                            definirAtivo.mutate(
                              { usuario_id: u.id, ativo },
                              { onError: (e) => toast.error(e.message) },
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.criado_em ? paraDmy(u.criado_em.slice(0, 10)) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => {
                          setParaRedefinir({ id: u.id, nome: u.nome || u.email })
                          setNovaSenha('')
                        }}
                      >
                        <KeyRound className="size-3.5" /> Redefinir senha
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        A criação e a gestão de usuários exigem a permissão <b>usuarios.gerenciar</b>. Usuários
        inativos não conseguem entrar no sistema.
      </p>

      {/* Criar usuário */}
      <Dialog open={dialogoCriar} onOpenChange={(aberto) => !aberto && setDialogoCriar(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Nome</label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">E-mail</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Senha</label>
              <Input
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="mínimo de 8 caracteres"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Papel</label>
              <Select value={form.papel} onValueChange={(papel) => setForm({ ...form, papel })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ROTULO_PAPEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {erroForm && <p className="text-sm text-destructive">{erroForm}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoCriar(false)}>
              Cancelar
            </Button>
            <Button onClick={criarUsuario} disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redefinir senha */}
      <Dialog
        open={Boolean(paraRedefinir)}
        onOpenChange={(aberto) => !aberto && setParaRedefinir(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir senha de {paraRedefinir?.nome}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <label className="text-xs font-semibold text-muted-foreground">Nova senha</label>
            <Input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="mínimo de 8 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParaRedefinir(null)}>
              Cancelar
            </Button>
            <Button
              disabled={redefinirSenha.isPending || novaSenha.length < 8}
              onClick={() => {
                if (!paraRedefinir) return
                redefinirSenha.mutate(
                  { usuario_id: paraRedefinir.id, senha: novaSenha },
                  {
                    onSuccess: () => setParaRedefinir(null),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }}
            >
              {redefinirSenha.isPending ? 'Salvando…' : 'Redefinir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
