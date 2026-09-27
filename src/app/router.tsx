import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/shell'
import { ExigirLogin, Guard } from '@/features/autenticacao/guards'
import { TelaLogin } from '@/features/autenticacao/tela-login'
import { TelaEscala } from '@/features/escala/tela-escala'
import { TelaDashboard } from '@/features/dashboard/tela-dashboard'
import { TelaVeiculos } from '@/features/veiculos/tela-veiculos'
import { TelaEquipes } from '@/features/equipes/tela-equipes'
import { TelaAusencias } from '@/features/ausencias/tela-ausencias'
import { TelaPcd } from '@/features/pcd/tela-pcd'
import { TelaIndicadores } from '@/features/indicadores/tela-indicadores'
import { TelaUsuarios } from '@/features/administracao/tela-usuarios'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<TelaLogin />} />
      <Route
        element={
          <ExigirLogin>
            <AppShell />
          </ExigirLogin>
        }
      >
        <Route index element={<Navigate to="/escala" replace />} />
        <Route
          path="escala"
          element={
            <Guard permissao="escala.visualizar">
              <TelaEscala />
            </Guard>
          }
        />
        <Route
          path="dashboard"
          element={
            <Guard permissao="indicadores.visualizar">
              <TelaDashboard />
            </Guard>
          }
        />
        <Route
          path="veiculos"
          element={
            <Guard permissao="bases.visualizar">
              <TelaVeiculos />
            </Guard>
          }
        />
        <Route
          path="equipes"
          element={
            <Guard permissao="bases.visualizar">
              <TelaEquipes />
            </Guard>
          }
        />
        <Route
          path="ausencias"
          element={
            <Guard permissao="ausencias.visualizar">
              <TelaAusencias />
            </Guard>
          }
        />
        <Route
          path="pcd"
          element={
            <Guard permissao="pcd.visualizar">
              <TelaPcd />
            </Guard>
          }
        />
        <Route
          path="indicadores"
          element={
            <Guard permissao="indicadores.visualizar">
              <TelaIndicadores />
            </Guard>
          }
        />
        <Route
          path="admin/usuarios"
          element={
            <Guard permissao="usuarios.gerenciar">
              <TelaUsuarios />
            </Guard>
          }
        />
        <Route path="*" element={<Navigate to="/escala" replace />} />
      </Route>
    </Routes>
  )
}
