-- VÁRIOS anexos (PDF, JPG ou PNG) por notificação e por resposta
-- (execute no SQL Editor do Supabase, depois do 06_anexos_imagem.sql).
--
-- Cria a tabela notificacao_anexos (um registro por arquivo) e as funções anexo_*.
-- Os anexos que já existem (tabelas notificacao_pdfs e notificacao_resposta_pdfs) são COPIADOS para a tabela nova
-- na primeira execução; as tabelas antigas não são apagadas. Seguro executar de novo: só migra se a tabela nova estiver vazia.

create table if not exists public.notificacao_anexos (
  id bigint generated always as identity primary key,
  notificacao bigint not null,
  tipo text not null check (tipo in ('notificacao', 'resposta')),
  nome text not null,
  tamanho int not null,
  conteudo bytea not null,
  enviado_por text,
  created_at timestamptz not null default now()
);
create index if not exists notificacao_anexos_num_idx on public.notificacao_anexos (notificacao, tipo);
alter table public.notificacao_anexos enable row level security;
revoke all on public.notificacao_anexos from anon, authenticated;

-- copia os anexos já existentes (uma vez)
do $$
begin
  if not exists (select 1 from public.notificacao_anexos) then
    insert into public.notificacao_anexos (notificacao, tipo, nome, tamanho, conteudo, enviado_por, created_at)
    select notificacao, 'notificacao', nome, tamanho, conteudo, enviado_por, created_at from public.notificacao_pdfs;
    if to_regclass('public.notificacao_resposta_pdfs') is not null then
      insert into public.notificacao_anexos (notificacao, tipo, nome, tamanho, conteudo, enviado_por, created_at)
      select notificacao, 'resposta', nome, tamanho, conteudo, enviado_por, created_at from public.notificacao_resposta_pdfs;
    end if;
  end if;
end $$;

-- Quantos anexos cada notificação tem: {"94596": 2, "94708": 1}
create or replace function public.anexo_contagem(p_token uuid, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_object_agg(notificacao::text, n)
    from (select notificacao, count(*) as n from notificacao_anexos where tipo = p_tipo group by notificacao) t), '{}'::jsonb);
end $$;

-- Lista os arquivos de uma notificação (sem o conteúdo)
create or replace function public.anexo_list(p_token uuid, p_numero bigint, p_tipo text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'tamanho', tamanho, 'em', created_at) order by id)
    from notificacao_anexos where notificacao = p_numero and tipo = p_tipo), '[]'::jsonb);
end $$;

-- Adiciona um arquivo. PDF (%PDF), JPEG ou PNG; até 5 MB cada; no máximo 10 por notificação/tipo. Devolve o id.
create or replace function public.anexo_save(p_token uuid, p_numero bigint, p_tipo text, p_nome text, p_base64 text)
returns bigint language plpgsql security definer set search_path = public, extensions as $$
declare b bytea; novo bigint;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  if p_tipo not in ('notificacao', 'resposta') then raise exception 'tipo de anexo inválido'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'arquivo muito grande (máximo de 5 MB)'; end if;
  if not (substring(b from 1 for 4) = '\x25504446'::bytea      -- PDF
       or substring(b from 1 for 3) = '\xffd8ff'::bytea        -- JPEG
       or substring(b from 1 for 4) = '\x89504e47'::bytea)     -- PNG
  then raise exception 'o arquivo precisa ser PDF, JPG ou PNG'; end if;
  if (select count(*) from notificacao_anexos where notificacao = p_numero and tipo = p_tipo) >= 10 then
    raise exception 'máximo de 10 arquivos por notificação';
  end if;
  insert into notificacao_anexos (notificacao, tipo, nome, tamanho, conteudo, enviado_por)
  values (p_numero, p_tipo, left(coalesce(nullif(trim(p_nome), ''), 'anexo'), 200), octet_length(b), b, _sess(p_token))
  returning id into novo;
  return novo;
end $$;

create or replace function public.anexo_get(p_token uuid, p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r notificacao_anexos;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  select * into r from notificacao_anexos where id = p_id;
  if r.id is null then return null; end if;
  return jsonb_build_object('nome', r.nome, 'tamanho', r.tamanho,
    'base64', translate(encode(r.conteudo, 'base64'), E'\n', ''));
end $$;

create or replace function public.anexo_delete(p_token uuid, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacao_anexos where id = p_id;
end $$;

grant execute on function public.anexo_contagem(uuid, text), public.anexo_list(uuid, bigint, text),
  public.anexo_save(uuid, bigint, text, text, text), public.anexo_get(uuid, bigint),
  public.anexo_delete(uuid, bigint) to anon, authenticated;
