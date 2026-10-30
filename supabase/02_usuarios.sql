-- Gestão de usuários (execute no SQL Editor do Supabase, depois do schema.sql)

alter table public.app_users
  add column if not exists chapa bigint,
  add column if not exists funcao text not null default '',
  add column if not exists base text not null default '',
  add column if not exists processo text not null default '',
  add column if not exists gerencia text not null default '',
  add column if not exists ativo boolean not null default true;

-- Login e sessões passam a respeitar usuários inativos
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
  return jsonb_build_object('token', t, 'username', u.username, 'nome', u.nome, 'role', u.role);
end $$;

create or replace function public._sess(p_token uuid)
returns text language sql security definer set search_path = public as $$
  select s.username from app_sessions s join app_users u on u.username = s.username
  where s.token = p_token and s.expires_at > now() and u.ativo
$$;

create or replace function public._is_admin(p_token uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_sessions s join app_users u on u.username = s.username
                 where s.token = p_token and s.expires_at > now() and u.role = 'admin' and u.ativo)
$$;

create or replace function public._usr_json(u app_users)
returns jsonb language sql immutable as $$
  select jsonb_build_object('username', u.username, 'nome', u.nome, 'role', u.role, 'chapa', u.chapa,
    'funcao', u.funcao, 'base', u.base, 'processo', u.processo, 'gerencia', u.gerencia, 'ativo', u.ativo)
$$;

create or replace function public.usr_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_agg(_usr_json(u) order by u.nome) from app_users u), '[]'::jsonb);
end $$;

-- Cria ou atualiza um usuário. Senha só é alterada quando informada.
create or replace function public.usr_save(p_token uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  me text; t app_users; r app_users;
  v_user text := trim(coalesce(p->>'username', ''));
  v_pass text := nullif(p->>'senha', '');
  v_role text := coalesce(nullif(p->>'role', ''), 'viewer');
  v_ativo boolean := coalesce((p->>'ativo')::boolean, true);
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  me := _sess(p_token);
  if v_user = '' then raise exception 'usuário obrigatório'; end if;
  if left(v_user, 1) <> '@' then v_user := '@' || v_user; end if;
  if v_role not in ('admin', 'viewer') then raise exception 'perfil inválido'; end if;
  if v_pass is not null and length(v_pass) < 5 then raise exception 'senha deve ter ao menos 5 caracteres'; end if;
  if coalesce(trim(p->>'nome'), '') = '' then raise exception 'nome obrigatório'; end if;

  select * into t from app_users where lower(username) = lower(v_user);
  if t.username is null then
    if v_pass is null then raise exception 'senha obrigatória para novo usuário'; end if;
    insert into app_users (username, nome, role, pass_hash, chapa, funcao, base, processo, gerencia, ativo)
    values (v_user, trim(p->>'nome'), v_role, crypt(v_pass, gen_salt('bf')), nullif(p->>'chapa', '')::bigint,
            coalesce(p->>'funcao', ''), coalesce(p->>'base', ''), coalesce(p->>'processo', ''), coalesce(p->>'gerencia', ''), v_ativo)
    returning * into r;
  else
    if t.username = me and (v_role <> 'admin' or not v_ativo) then
      raise exception 'você não pode remover o próprio acesso de administrador';
    end if;
    update app_users set
      nome = trim(p->>'nome'), role = v_role, chapa = nullif(p->>'chapa', '')::bigint,
      funcao = coalesce(p->>'funcao', ''), base = coalesce(p->>'base', ''), processo = coalesce(p->>'processo', ''),
      gerencia = coalesce(p->>'gerencia', ''), ativo = v_ativo,
      pass_hash = case when v_pass is not null then crypt(v_pass, gen_salt('bf')) else pass_hash end
    where username = t.username returning * into r;
    if not v_ativo or v_pass is not null then delete from app_sessions where username = t.username and token <> p_token; end if;
  end if;
  return _usr_json(r);
end $$;

create or replace function public.usr_delete(p_token uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if lower(p_username) = lower(_sess(p_token)) then raise exception 'você não pode excluir o próprio usuário'; end if;
  delete from app_users where lower(username) = lower(p_username);
end $$;

-- Importação em lote. Usuários existentes mantêm perfil e senha, salvo quando p_reset = true (senha)
-- ou quando a linha traz "role" explícito.
create or replace function public.usr_import(p_token uuid, p jsonb, p_reset boolean default false)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  e jsonb; v_user text; v_pass text; v_role text; t app_users;
  criados int := 0; atualizados int := 0; ignorados int := 0;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  for e in select * from jsonb_array_elements(p) loop
    v_user := trim(coalesce(e->>'username', ''));
    v_pass := nullif(e->>'senha', '');
    v_role := nullif(e->>'role', '');
    if v_user = '' or coalesce(trim(e->>'nome'), '') = '' then ignorados := ignorados + 1; continue; end if;
    if left(v_user, 1) <> '@' then v_user := '@' || v_user; end if;
    if v_role is not null and v_role not in ('admin', 'viewer') then v_role := null; end if;
    select * into t from app_users where lower(username) = lower(v_user);
    if t.username is null then
      if v_pass is null or length(v_pass) < 5 then ignorados := ignorados + 1; continue; end if;
      insert into app_users (username, nome, role, pass_hash, chapa, funcao, base, processo, gerencia, ativo)
      values (v_user, trim(e->>'nome'), coalesce(v_role, 'viewer'), crypt(v_pass, gen_salt('bf')), nullif(e->>'chapa', '')::bigint,
              coalesce(e->>'funcao', ''), coalesce(e->>'base', ''), coalesce(e->>'processo', ''), coalesce(e->>'gerencia', ''), true);
      criados := criados + 1;
    else
      update app_users set
        nome = trim(e->>'nome'), chapa = nullif(e->>'chapa', '')::bigint, funcao = coalesce(e->>'funcao', ''),
        base = coalesce(e->>'base', ''), processo = coalesce(e->>'processo', ''), gerencia = coalesce(e->>'gerencia', ''),
        role = case when v_role is not null and t.username <> _sess(p_token) then v_role else role end,
        pass_hash = case when p_reset and v_pass is not null and length(v_pass) >= 5 then crypt(v_pass, gen_salt('bf')) else pass_hash end
      where username = t.username;
      atualizados := atualizados + 1;
    end if;
  end loop;
  return jsonb_build_object('criados', criados, 'atualizados', atualizados, 'ignorados', ignorados);
end $$;

revoke all on function public._usr_json(app_users) from public, anon, authenticated;
grant execute on function public.usr_list(uuid), public.usr_save(uuid, jsonb), public.usr_delete(uuid, text),
  public.usr_import(uuid, jsonb, boolean) to anon, authenticated;
