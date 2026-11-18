-- Último acesso de cada usuário (execute no SQL Editor do Supabase, depois do 08_data_lancamento.sql).
-- A cada login bem-sucedido grava a data e a hora em app_users.ultimo_acesso; a tela Usuários mostra esse valor.
-- Quem nunca entrou depois desta atualização aparece como "Nunca acessou" até o próximo login.

alter table public.app_users add column if not exists ultimo_acesso timestamptz;

create or replace function public.app_login(p_user text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u app_users; t uuid;
begin
  select * into u from app_users where lower(username) = lower(trim(p_user)) and ativo;
  if u.username is null or u.pass_hash <> crypt(p_pass, u.pass_hash) then
    perform pg_sleep(0.8);
    return null;
  end if;
  delete from app_sessions where expires_at < now();
  insert into app_sessions (username) values (u.username) returning token into t;
  update app_users set ultimo_acesso = now() where username = u.username;
  return jsonb_build_object('token', t, 'username', u.username, 'nome', u.nome, 'role', u.role, 'must_change', u.must_change);
end $$;

-- Inclui o último acesso no que a tela Usuários recebe (stable: a data depende do fuso da sessão)
create or replace function public._usr_json(u app_users)
returns jsonb language sql stable as $$
  select jsonb_build_object('username', u.username, 'nome', u.nome, 'role', u.role, 'chapa', u.chapa,
    'funcao', u.funcao, 'base', u.base, 'processo', u.processo, 'gerencia', u.gerencia, 'ativo', u.ativo,
    'ultimoAcesso', u.ultimo_acesso)
$$;

revoke all on function public._usr_json(app_users) from public, anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
