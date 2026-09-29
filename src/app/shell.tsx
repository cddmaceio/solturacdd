import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { MarcaSoltura } from '@/app/marca'
import { useAuth } from '@/features/autenticacao/auth-provider'
import { ROTULO_PAPEL, type PermissaoChave } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ItemNav = {
  para: string
  rotulo: string
  permissao: PermissaoChave
}

const ITENS_NAV: ItemNav[] = [
  { para: '/escala', rotulo: 'Escala do dia', permissao: 'escala.visualizar' },
  { para: '/dashboard', rotulo: 'Dashboard', permissao: 'indicadores.visualizar' },
  { para: '/veiculos', rotulo: 'Base Fidelização', permissao: 'bases.visualizar' },
  { para: '/equipes', rotulo: 'Base Equipes', permissao: 'bases.visualizar' },
  { para: '/ausencias', rotulo: 'Absenteísmo', permissao: 'ausencias.visualizar' },
  { para: '/pcd', rotulo: 'PCD', permissao: 'pcd.visualizar' },
  { para: '/indicadores', rotulo: 'Indicadores', permissao: 'indicadores.visualizar' },
  { para: '/admin/usuarios', rotulo: 'Usuários', permissao: 'usuarios.gerenciar' },
]

export function AppShell() {
  const { perfil, sessao, papel, pode, sair } = useAuth()
  const navegar = useNavigate()

  const nome = perfil?.nome?.trim() || sessao?.user.email || 'Usuário'
  const iniciais = nome
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function sairDoSistema() {
    await sair()
    navegar('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-[#16273f] bg-[#0a1626] text-white shadow-[0_10px_30px_-18px_rgba(6,16,32,0.9)]">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center gap-x-6 gap-y-3 px-5 pt-3.5">
          <NavLink to="/escala" className="shrink-0" aria-label="Página inicial">
            <MarcaSoltura />
          </NavLink>

          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1 lg:overflow-visible lg:pb-0">
            {ITENS_NAV.filter((item) => pode(item.permissao)).map((item) => (
              <NavLink
                key={item.para}
                to={item.para}
                className={({ isActive }) =>
                  [
                    'relative shrink-0 rounded-md px-3 py-2 text-[13px] font-semibold tracking-tight transition-colors outline-none',
                    isActive
                      ? 'bg-[#13253d] text-white after:absolute after:inset-x-2 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-[#e2b53c]'
                      : 'text-[#93a9c4] hover:bg-[#101e33] hover:text-white focus-visible:bg-[#101e33]',
                  ].join(' ')
                }
              >
                {item.rotulo}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-3 lg:order-none">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block max-w-44 truncate text-[13px] font-semibold">{nome}</span>
              <span className="block text-[10px] tracking-wider text-[#7f97b5] uppercase">
                {papel ? ROTULO_PAPEL[papel] : 'sem papel'}
              </span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger className="grid size-9 place-items-center rounded-full border border-[#243b5a] bg-[#13253d] text-xs font-bold text-[#f4d97c] outline-none focus-visible:ring-2 focus-visible:ring-[#e2b53c]/70">
                {iniciais}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="grid gap-0.5">
                  <span className="truncate text-sm">{nome}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {sessao?.user.email ?? ''}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  Papel: <Badge variant="secondary">{papel ? ROTULO_PAPEL[papel] : '—'}</Badge>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void sairDoSistema()}>
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1760px] px-3 py-4 sm:px-4 lg:py-5">
        <Outlet />
      </main>
    </div>
  )
}
