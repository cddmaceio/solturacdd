import { MarcaSoltura } from '@/app/marca'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function TelaConfiguracao() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <div className="mb-2">
            <MarcaSoltura escuro={false} />
          </div>
          <CardTitle>Configuração do Supabase ausente</CardTitle>
          <CardDescription>
            O aplicativo precisa das variáveis de ambiente do seu projeto Supabase para funcionar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            1. Copie o arquivo <code className="font-mono text-foreground">.env.example</code> para{' '}
            <code className="font-mono text-foreground">.env</code>.
          </p>
          <p>
            2. Preencha <code className="font-mono text-foreground">VITE_SUPABASE_URL</code> e{' '}
            <code className="font-mono text-foreground">VITE_SUPABASE_ANON_KEY</code> com os valores
            de <span className="text-foreground">Project Settings → API</span> no painel do Supabase.
          </p>
          <p>3. Reinicie o servidor de desenvolvimento (npm run dev).</p>
        </CardContent>
      </Card>
    </div>
  )
}
