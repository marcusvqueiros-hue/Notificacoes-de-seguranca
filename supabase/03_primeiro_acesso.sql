-- Troca de senha no primeiro acesso (execute no SQL Editor do Supabase, depois do 02_usuarios.sql)

alter table public.app_users add column if not exists must_change boolean not null default false;

-- Quem já foi importado como "viewer" ainda usa a senha da planilha: deve trocá-la no primeiro acesso.
update public.app_users set must_change = true where role = 'viewer';

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
  return jsonb_build_object('token', t, 'username', u.username, 'nome', u.nome, 'role', u.role, 'must_change', u.must_change);
end $$;

-- Enquanto a senha provisória não for trocada, a sessão não acessa dados
create or replace function public._sess(p_token uuid)
returns text language sql security definer set search_path = public as $$
  select s.username from app_sessions s join app_users u on u.username = s.username
  where s.token = p_token and s.expires_at > now() and u.ativo and not u.must_change
$$;

create or replace function public._is_admin(p_token uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_sessions s join app_users u on u.username = s.username
                 where s.token = p_token and s.expires_at > now() and u.role = 'admin' and u.ativo and not u.must_change)
$$;

-- O próprio usuário troca a senha (usa a senha atual para confirmar)
create or replace function public.app_change_password(p_token uuid, p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u app_users;
begin
  select u2.* into u from app_sessions s join app_users u2 on u2.username = s.username
  where s.token = p_token and s.expires_at > now() and u2.ativo;
  if u.username is null then raise exception 'sessão inválida'; end if;
  if u.pass_hash <> crypt(p_old, u.pass_hash) then
    perform pg_sleep(0.8);
    raise exception 'senha atual incorreta';
  end if;
  if length(coalesce(p_new, '')) < 8 then raise exception 'a nova senha deve ter ao menos 8 caracteres'; end if;
  if p_new = p_old then raise exception 'a nova senha deve ser diferente da atual'; end if;
  update app_users set pass_hash = crypt(p_new, gen_salt('bf')), must_change = false where username = u.username;
  delete from app_sessions where username = u.username and token <> p_token;
end $$;

-- Novo usuário ou senha redefinida por outro administrador => troca obrigatória no próximo login
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
    insert into app_users (username, nome, role, pass_hash, chapa, funcao, base, processo, gerencia, ativo, must_change)
    values (v_user, trim(p->>'nome'), v_role, crypt(v_pass, gen_salt('bf')), nullif(p->>'chapa', '')::bigint,
            coalesce(p->>'funcao', ''), coalesce(p->>'base', ''), coalesce(p->>'processo', ''), coalesce(p->>'gerencia', ''), v_ativo, true)
    returning * into r;
  else
    if t.username = me and (v_role <> 'admin' or not v_ativo) then
      raise exception 'você não pode remover o próprio acesso de administrador';
    end if;
    update app_users set
      nome = trim(p->>'nome'), role = v_role, chapa = nullif(p->>'chapa', '')::bigint,
      funcao = coalesce(p->>'funcao', ''), base = coalesce(p->>'base', ''), processo = coalesce(p->>'processo', ''),
      gerencia = coalesce(p->>'gerencia', ''), ativo = v_ativo,
      pass_hash = case when v_pass is not null then crypt(v_pass, gen_salt('bf')) else pass_hash end,
      must_change = case when v_pass is not null and t.username <> me then true else must_change end
    where username = t.username returning * into r;
    if not v_ativo or v_pass is not null then delete from app_sessions where username = t.username and token <> p_token; end if;
  end if;
  return _usr_json(r);
end $$;

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
      insert into app_users (username, nome, role, pass_hash, chapa, funcao, base, processo, gerencia, ativo, must_change)
      values (v_user, trim(e->>'nome'), coalesce(v_role, 'viewer'), crypt(v_pass, gen_salt('bf')), nullif(e->>'chapa', '')::bigint,
              coalesce(e->>'funcao', ''), coalesce(e->>'base', ''), coalesce(e->>'processo', ''), coalesce(e->>'gerencia', ''), true, true);
      criados := criados + 1;
    else
      update app_users set
        nome = trim(e->>'nome'), chapa = nullif(e->>'chapa', '')::bigint, funcao = coalesce(e->>'funcao', ''),
        base = coalesce(e->>'base', ''), processo = coalesce(e->>'processo', ''), gerencia = coalesce(e->>'gerencia', ''),
        role = case when v_role is not null and t.username <> _sess(p_token) then v_role else role end,
        pass_hash = case when p_reset and v_pass is not null and length(v_pass) >= 5 and t.username <> _sess(p_token)
                         then crypt(v_pass, gen_salt('bf')) else pass_hash end,
        must_change = case when p_reset and v_pass is not null and length(v_pass) >= 5 and t.username <> _sess(p_token)
                           then true else must_change end
      where username = t.username;
      atualizados := atualizados + 1;
    end if;
  end loop;
  return jsonb_build_object('criados', criados, 'atualizados', atualizados, 'ignorados', ignorados);
end $$;

grant execute on function public.app_change_password(uuid, text, text) to anon, authenticated;
