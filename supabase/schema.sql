-- Notificações CGB — schema, autenticação e funções (execute no SQL Editor do Supabase)
create extension if not exists pgcrypto;

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  notificacao bigint,
  data date not null,
  inspetor text not null default '',
  equipe text not null default '',
  base text not null default '',
  gerencia text not null default '',
  nao_conformidade text not null default '',
  qnt int not null default 1,
  pnt int not null default 0,
  valor numeric(12,2) not null default 0,
  tratado boolean not null default false,
  dias int,
  inspecao bigint,
  coordenador text not null default '',
  processo text not null default '',
  status text not null default '',
  eletricistas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notificacoes_data_idx on public.notificacoes (data);
create index if not exists notificacoes_equipe_idx on public.notificacoes (equipe);

create table if not exists public.app_users (
  username text primary key,
  nome text not null,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  pass_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token uuid primary key default gen_random_uuid(),
  username text not null references public.app_users(username) on delete cascade,
  expires_at timestamptz not null default now() + interval '12 hours'
);

-- Nenhuma policy: o acesso direto às tabelas pela chave pública é negado.
-- Todo acesso passa pelas funções abaixo, que exigem um token de sessão válido.
alter table public.notificacoes enable row level security;
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
revoke all on public.notificacoes, public.app_users, public.app_sessions from anon, authenticated;

-- Administrador inicial: TROQUE a senha abaixo antes de executar (não use senhas óbvias).
insert into public.app_users (username, nome, role, pass_hash)
values ('@admin', 'Administrador', 'admin', crypt('DEFINA_UMA_SENHA_FORTE_AQUI', gen_salt('bf')))
on conflict (username) do nothing;

create or replace function public.app_login(p_user text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u app_users; t uuid;
begin
  select * into u from app_users where lower(username) = lower(p_user);
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
  select s.username from app_sessions s where s.token = p_token and s.expires_at > now()
$$;

create or replace function public._is_admin(p_token uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_sessions s join app_users u on u.username = s.username
                 where s.token = p_token and s.expires_at > now() and u.role = 'admin')
$$;

create or replace function public.nc_list(p_token uuid)
returns setof public.notificacoes language plpgsql security definer set search_path = public as $$
begin
  if _sess(p_token) is null then raise exception 'sessão inválida'; end if;
  return query select * from notificacoes order by data, notificacao, created_at;
end $$;

create or replace function public.nc_save(p_token uuid, p jsonb)
returns public.notificacoes language plpgsql security definer set search_path = public as $$
declare r notificacoes; v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if v_id is not null and exists (select 1 from notificacoes where id = v_id) then
    update notificacoes set
      notificacao = (p->>'notificacao')::bigint, data = (p->>'data')::date,
      inspetor = coalesce(p->>'inspetor',''), equipe = coalesce(p->>'equipe',''),
      base = coalesce(p->>'base',''), gerencia = coalesce(p->>'gerencia',''),
      nao_conformidade = coalesce(p->>'naoConformidade',''),
      qnt = coalesce((p->>'qnt')::int,1), pnt = coalesce((p->>'pnt')::int,0),
      valor = coalesce((p->>'valor')::numeric,0), tratado = coalesce((p->>'tratado')::boolean,false),
      dias = nullif(p->>'dias','')::int, inspecao = nullif(p->>'inspecao','')::bigint,
      coordenador = coalesce(p->>'coordenador',''), processo = coalesce(p->>'processo',''),
      status = coalesce(p->>'status',''),
      eletricistas = coalesce(array(select jsonb_array_elements_text(p->'eletricistas')), '{}'),
      updated_at = now()
    where id = v_id returning * into r;
  else
    insert into notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,inspecao,coordenador,processo,status,eletricistas)
    values ((p->>'notificacao')::bigint, (p->>'data')::date, coalesce(p->>'inspetor',''), coalesce(p->>'equipe',''),
      coalesce(p->>'base',''), coalesce(p->>'gerencia',''), coalesce(p->>'naoConformidade',''),
      coalesce((p->>'qnt')::int,1), coalesce((p->>'pnt')::int,0), coalesce((p->>'valor')::numeric,0),
      coalesce((p->>'tratado')::boolean,false), nullif(p->>'dias','')::int, nullif(p->>'inspecao','')::bigint,
      coalesce(p->>'coordenador',''), coalesce(p->>'processo',''), coalesce(p->>'status',''),
      coalesce(array(select jsonb_array_elements_text(p->'eletricistas')), '{}'))
    returning * into r;
  end if;
  return r;
end $$;

create or replace function public.nc_delete(p_token uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacoes where id = p_id;
end $$;

create or replace function public.app_logout(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from app_sessions where token = p_token
$$;

revoke all on function public._sess(uuid), public._is_admin(uuid) from public, anon, authenticated;
grant execute on function public.app_login(text,text), public.app_logout(uuid),
  public.nc_list(uuid), public.nc_save(uuid,jsonb), public.nc_delete(uuid,uuid) to anon, authenticated;

-- Importação em lote (planilha): recebe um array JSON de notificações
create or replace function public.nc_import(p_token uuid, p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  insert into notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,inspecao,coordenador,processo,status,eletricistas)
  select (e->>'notificacao')::bigint, (e->>'data')::date, coalesce(e->>'inspetor',''), coalesce(e->>'equipe',''),
    coalesce(e->>'base',''), coalesce(e->>'gerencia',''), coalesce(e->>'naoConformidade',''),
    coalesce((e->>'qnt')::int,1), coalesce((e->>'pnt')::int,0), coalesce((e->>'valor')::numeric,0),
    coalesce((e->>'tratado')::boolean,false), nullif(e->>'dias','')::int, nullif(e->>'inspecao','')::bigint,
    coalesce(e->>'coordenador',''), coalesce(e->>'processo',''), coalesce(e->>'status',''),
    coalesce(array(select jsonb_array_elements_text(e->'eletricistas')), '{}')
  from jsonb_array_elements(p) e;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.nc_import(uuid,jsonb) to anon, authenticated;
