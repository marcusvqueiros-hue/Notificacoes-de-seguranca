-- Observação POR ITEM (não conformidade) — execute no SQL Editor do Supabase, depois do 10_resposta_por_item.sql.
--
-- Antes a observação era uma por Nº de notificação (tabela notificacao_obs). Agora cada item tem a sua.
-- Esta migração:
--   1. cria a tabela item_obs (uma observação por item);
--   2. COPIA as observações que já existem (por Nº) para cada item daquela notificação, para nada sumir da tela.
--      Depois é só ajustar o texto de cada item. A tabela antiga fica guardada, sem uso;
--   3. cria as funções obs_item_list e obs_item_save; e faz o nc_delete apagar também a observação do item excluído.
-- Seguro executar de novo: a cópia só acontece se item_obs ainda estiver vazia.

create table if not exists public.item_obs (
  item_id uuid primary key,
  texto text not null,
  atualizado_por text,
  updated_at timestamptz not null default now()
);
alter table public.item_obs enable row level security;
revoke all on public.item_obs from anon, authenticated;

do $$
begin
  if not exists (select 1 from public.item_obs) and to_regclass('public.notificacao_obs') is not null then
    insert into public.item_obs (item_id, texto, atualizado_por, updated_at)
    select n.id, o.texto, o.atualizado_por, o.updated_at
    from public.notificacao_obs o
    join public.notificacoes n on n.notificacao = o.notificacao;
  end if;
end $$;

-- Observações de todos os itens: {"<id do item>": {"texto": "...", "por": "...", "em": "..."}}
create or replace function public.obs_item_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_object_agg(item_id::text,
    jsonb_build_object('texto', texto, 'por', atualizado_por, 'em', updated_at)) from item_obs), '{}'::jsonb);
end $$;

-- Texto vazio remove a observação do item
create or replace function public.obs_item_save(p_token uuid, p_item uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_item is null or not exists (select 1 from notificacoes where id = p_item) then raise exception 'item não encontrado'; end if;
  if coalesce(trim(p_texto), '') = '' then
    delete from item_obs where item_id = p_item;
  else
    insert into item_obs (item_id, texto, atualizado_por)
    values (p_item, left(trim(p_texto), 4000), _sess(p_token))
    on conflict (item_id) do update
      set texto = excluded.texto, atualizado_por = excluded.atualizado_por, updated_at = now();
  end if;
end $$;

-- Excluir um item também apaga as respostas e a observação dele
create or replace function public.nc_delete(p_token uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacao_anexos where item_id = p_id;
  delete from item_obs where item_id = p_id;
  delete from notificacoes where id = p_id;
end $$;

grant execute on function public.obs_item_list(uuid), public.obs_item_save(uuid, uuid, text), public.nc_delete(uuid, uuid) to anon, authenticated;
