-- PDF da RESPOSTA da notificação (execute no SQL Editor do Supabase, depois do 04_anexos_pdf.sql)
-- Funciona como o PDF da notificação: um arquivo por Nº de notificação, somente administradores.

create table if not exists public.notificacao_resposta_pdfs (
  notificacao bigint primary key,
  nome text not null,
  tamanho int not null,
  conteudo bytea not null,
  enviado_por text,
  created_at timestamptz not null default now()
);
alter table public.notificacao_resposta_pdfs enable row level security;
revoke all on public.notificacao_resposta_pdfs from anon, authenticated;

create or replace function public.resp_numeros(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_agg(notificacao order by notificacao) from notificacao_resposta_pdfs), '[]'::jsonb);
end $$;

create or replace function public.resp_save(p_token uuid, p_numero bigint, p_nome text, p_base64 text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b bytea;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'PDF muito grande (máximo de 5 MB)'; end if;
  if substring(b from 1 for 4) <> '\x25504446'::bytea then raise exception 'o arquivo não é um PDF válido'; end if;
  insert into notificacao_resposta_pdfs (notificacao, nome, tamanho, conteudo, enviado_por)
  values (p_numero, left(coalesce(nullif(trim(p_nome), ''), 'resposta.pdf'), 200), octet_length(b), b, _sess(p_token))
  on conflict (notificacao) do update
    set nome = excluded.nome, tamanho = excluded.tamanho, conteudo = excluded.conteudo,
        enviado_por = excluded.enviado_por, created_at = now();
end $$;

create or replace function public.resp_get(p_token uuid, p_numero bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r notificacao_resposta_pdfs;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  select * into r from notificacao_resposta_pdfs where notificacao = p_numero;
  if r.notificacao is null then return null; end if;
  return jsonb_build_object('nome', r.nome, 'tamanho', r.tamanho,
    'base64', translate(encode(r.conteudo, 'base64'), E'\n', ''));
end $$;

create or replace function public.resp_delete(p_token uuid, p_numero bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacao_resposta_pdfs where notificacao = p_numero;
end $$;

grant execute on function public.resp_numeros(uuid), public.resp_save(uuid, bigint, text, text),
  public.resp_get(uuid, bigint), public.resp_delete(uuid, bigint) to anon, authenticated;
