-- 0006: seed de papéis, permissões e ajudantes reservados (800/801)

insert into public.papeis (chave, nome, descricao) values
  ('admin', 'Administrador', 'Acesso total, incluindo gestão de usuários e papéis'),
  ('supervisor', 'Supervisor', 'Monta e edita escalas, bases, importações e ausências'),
  ('operador', 'Operador', 'Consulta a escala, bases e indicadores e gera exportações')
on conflict (chave) do nothing;

insert into public.permissoes (chave, nome, dominio) values
  ('escala.visualizar', 'Ver a escala do dia', 'escala'),
  ('escala.editar', 'Montar e editar a escala', 'escala'),
  ('bases.visualizar', 'Ver as bases (veículos e equipes)', 'bases'),
  ('bases.editar', 'Editar veículos e equipes', 'bases'),
  ('pcd.visualizar', 'Ver o PCD', 'pcd'),
  ('pcd.importar', 'Importar o arquivo do PCD', 'pcd'),
  ('ausencias.visualizar', 'Ver ausências e folgas', 'ausencias'),
  ('ausencias.registrar', 'Registrar ausências e folgas', 'ausencias'),
  ('indicadores.visualizar', 'Ver indicadores', 'indicadores'),
  ('exportacoes.gerar', 'Gerar exportações e impressões', 'exportacoes'),
  ('usuarios.gerenciar', 'Gerenciar usuários e papéis', 'usuarios')
on conflict (chave) do nothing;

-- operador: somente leitura + exportações
insert into public.papeis_permissoes (papel_id, permissao_id)
select p.id, pm.id
from public.papeis p
join public.permissoes pm on pm.chave in (
  'escala.visualizar', 'bases.visualizar', 'pcd.visualizar',
  'ausencias.visualizar', 'indicadores.visualizar', 'exportacoes.gerar'
)
where p.chave = 'operador'
on conflict do nothing;

-- supervisor: tudo, exceto gestão de usuários
insert into public.papeis_permissoes (papel_id, permissao_id)
select p.id, pm.id
from public.papeis p
cross join public.permissoes pm
where p.chave = 'supervisor' and pm.chave <> 'usuarios.gerenciar'
on conflict do nothing;

-- admin: todas as permissões
insert into public.papeis_permissoes (papel_id, permissao_id)
select p.id, pm.id
from public.papeis p
cross join public.permissoes pm
where p.chave = 'admin'
on conflict do nothing;

-- Ajudantes reservados usados como valores fixos na escala:
-- 800 = SEM AJUDANTE · 801 = VAN
insert into public.colaboradores (codigo, nome, tipo, sala, status) values
  ('800', 'SEM AJUDANTE', 'ajudante', '', ''),
  ('801', 'VAN', 'ajudante', 'VANS', '')
on conflict (codigo, tipo) do nothing;
