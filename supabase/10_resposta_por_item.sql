-- Resposta POR ITEM (não conformidade) — execute no SQL Editor do Supabase, depois do 09_ultimo_acesso.sql.
--
-- Regra: os arquivos da NOTIFICAÇÃO continuam por Nº (todos os itens da mesma notificação compartilham os mesmos),
-- mas a RESPOSTA é de cada item (linha / não conformidade). Esta migração:
--   1. adiciona notificacao_anexos.item_id (id do item, usado só nas respostas);
--   2. COPIA as respostas que já existem (gravadas por Nº) para cada item daquela notificação, para nada sumir da tela.
--      Depois é só remover, em cada item, os arquivos que não são dele. Os registros originais ficam guardados (item_id nulo);
--   3. cria as funções resp_item_*; e faz o nc_delete apagar as respostas do item excluído.
-- Seguro executar de novo: a cópia só acontece se ainda não houver nenhuma resposta por item.

alter table public.notificacao_anexos add column if not exists item_id uuid;
create index if not exists notificacao_anexos_item_idx on public.notificacao_anexos (item_id) where item_id is not null;

do $$
begin
  if not exists (select 1 from public.notificacao_anexos where tipo = 'resposta' and item_id is not null) then
    insert into public.notificacao_anexos (notificacao, tipo, nome, tamanho, conteudo, enviado_por, created_at, item_id)
    select a.notificacao, 'resposta', a.nome, a.tamanho, a.conteudo, a.enviado_por, a.created_at, n.id
    from public.notificacao_anexos a
    join public.notificacoes n on n.notificacao = a.notificacao
    where a.tipo = 'resposta' and a.item_id is null;
  end if;
end $$;

-- Quantos arquivos de resposta cada item tem: {"<id do item>": 2}
create or replace function public.resp_item_contagem(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_object_agg(item_id::text, n)
    from (select item_id, count(*) as n from notificacao_anexos where tipo = 'resposta' and item_id is not null group by item_id) t), '{}'::jsonb);
end $$;

create or replace function public.resp_item_list(p_token uuid, p_item uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'tamanho', tamanho, 'em', created_at) order by id)
    from notificacao_anexos where tipo = 'resposta' and item_id = p_item), '[]'::jsonb);
end $$;

-- Adiciona um arquivo de resposta a um item. PDF, JPEG ou PNG; até 5 MB; no máximo 10 por item. Devolve o id do arquivo.
create or replace function public.resp_item_save(p_token uuid, p_item uuid, p_nome text, p_base64 text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare b bytea; novo bigint; v_num bigint; v_achou boolean;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  select notificacao, true into v_num, v_achou from notificacoes where id = p_item;
  if v_achou is null then raise exception 'item não encontrado'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'arquivo muito grande (máximo de 5 MB)'; end if;
  if not (substring(b from 1 for 4) = '\x25504446'::bytea      -- PDF
       or substring(b from 1 for 3) = '\xffd8ff'::bytea        -- JPEG
       or substring(b from 1 for 4) = '\x89504e47'::bytea)     -- PNG
  then raise exception 'o arquivo precisa ser PDF, JPG ou PNG'; end if;
  if (select count(*) from notificacao_anexos where tipo = 'resposta' and item_id = p_item) >= 10 then
    raise exception 'máximo de 10 arquivos por resposta';
  end if;
  insert into notificacao_anexos (notificacao, tipo, nome, tamanho, conteudo, enviado_por, item_id)
  values (coalesce(v_num, 0), 'resposta', left(coalesce(nullif(trim(p_nome), ''), 'anexo'), 200), octet_length(b), b, _sess(p_token), p_item)
  returning id into novo;
  return novo;
end $$;

-- Excluir um item também apaga as respostas dele
create or replace function public.nc_delete(p_token uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacao_anexos where item_id = p_id;
  delete from notificacoes where id = p_id;
end $$;

grant execute on function public.resp_item_contagem(uuid), public.resp_item_list(uuid, uuid),
  public.resp_item_save(uuid, uuid, text, text), public.nc_delete(uuid, uuid) to anon, authenticated;
