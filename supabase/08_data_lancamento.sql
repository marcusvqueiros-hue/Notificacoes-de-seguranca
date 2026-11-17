-- Data de lançamento da notificação (execute no SQL Editor do Supabase, depois do 07_anexos_multiplos.sql).
-- O prazo de vencimento (campo "dias", em dias úteis) passa a contar a partir desta data.
-- Só adiciona a coluna e atualiza as funções de salvar e importar; os dados existentes não mudam.

alter table public.notificacoes add column if not exists data_lancamento date;

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
      dias = nullif(p->>'dias','')::int, data_lancamento = nullif(p->>'dataLancamento','')::date,
      inspecao = nullif(p->>'inspecao','')::bigint,
      coordenador = coalesce(p->>'coordenador',''), processo = coalesce(p->>'processo',''),
      status = coalesce(p->>'status',''),
      eletricistas = coalesce(array(select jsonb_array_elements_text(p->'eletricistas')), '{}'),
      updated_at = now()
    where id = v_id returning * into r;
  else
    insert into notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,data_lancamento,inspecao,coordenador,processo,status,eletricistas)
    values ((p->>'notificacao')::bigint, (p->>'data')::date, coalesce(p->>'inspetor',''), coalesce(p->>'equipe',''),
      coalesce(p->>'base',''), coalesce(p->>'gerencia',''), coalesce(p->>'naoConformidade',''),
      coalesce((p->>'qnt')::int,1), coalesce((p->>'pnt')::int,0), coalesce((p->>'valor')::numeric,0),
      coalesce((p->>'tratado')::boolean,false), nullif(p->>'dias','')::int, nullif(p->>'dataLancamento','')::date,
      nullif(p->>'inspecao','')::bigint,
      coalesce(p->>'coordenador',''), coalesce(p->>'processo',''), coalesce(p->>'status',''),
      coalesce(array(select jsonb_array_elements_text(p->'eletricistas')), '{}'))
    returning * into r;
  end if;
  return r;
end $$;

create or replace function public.nc_import(p_token uuid, p jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  insert into notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,data_lancamento,inspecao,coordenador,processo,status,eletricistas)
  select (e->>'notificacao')::bigint, (e->>'data')::date, coalesce(e->>'inspetor',''), coalesce(e->>'equipe',''),
    coalesce(e->>'base',''), coalesce(e->>'gerencia',''), coalesce(e->>'naoConformidade',''),
    coalesce((e->>'qnt')::int,1), coalesce((e->>'pnt')::int,0), coalesce((e->>'valor')::numeric,0),
    coalesce((e->>'tratado')::boolean,false), nullif(e->>'dias','')::int, nullif(e->>'dataLancamento','')::date,
    nullif(e->>'inspecao','')::bigint,
    coalesce(e->>'coordenador',''), coalesce(e->>'processo',''), coalesce(e->>'status',''),
    coalesce(array(select jsonb_array_elements_text(e->'eletricistas')), '{}')
  from jsonb_array_elements(p) e;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.nc_save(uuid, jsonb), public.nc_import(uuid, jsonb) to anon, authenticated;
