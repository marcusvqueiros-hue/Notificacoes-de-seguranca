-- PDF da notificação (execute no SQL Editor do Supabase, depois do 03_primeiro_acesso.sql)
-- O PDF fica associado ao Nº da notificação (vários itens da mesma notificação compartilham o mesmo PDF).

create table if not exists public.notificacao_pdfs (
  notificacao bigint primary key,
  nome text not null,
  tamanho int not null,
  conteudo bytea not null,
  enviado_por text,
  created_at timestamptz not null default now()
);
alter table public.notificacao_pdfs enable row level security;
revoke all on public.notificacao_pdfs from anon, authenticated;

-- Números de notificação que possuem PDF (somente administradores)
create or replace function public.pdf_numeros(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_agg(notificacao order by notificacao) from notificacao_pdfs), '[]'::jsonb);
end $$;

-- Envia (ou substitui) o PDF de uma notificação. Limite: 5 MB, e o arquivo precisa ser um PDF de verdade.
create or replace function public.pdf_save(p_token uuid, p_numero bigint, p_nome text, p_base64 text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b bytea;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'PDF muito grande (máximo de 5 MB)'; end if;
  if substring(b from 1 for 4) <> '\x25504446'::bytea then raise exception 'o arquivo não é um PDF válido'; end if;
  insert into notificacao_pdfs (notificacao, nome, tamanho, conteudo, enviado_por)
  values (p_numero, left(coalesce(nullif(trim(p_nome), ''), 'notificacao.pdf'), 200), octet_length(b), b, _sess(p_token))
  on conflict (notificacao) do update
    set nome = excluded.nome, tamanho = excluded.tamanho, conteudo = excluded.conteudo,
        enviado_por = excluded.enviado_por, created_at = now();
end $$;

create or replace function public.pdf_get(p_token uuid, p_numero bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r notificacao_pdfs;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  select * into r from notificacao_pdfs where notificacao = p_numero;
  if r.notificacao is null then return null; end if;
  return jsonb_build_object('nome', r.nome, 'tamanho', r.tamanho,
    'base64', translate(encode(r.conteudo, 'base64'), E'\n', ''));
end $$;

create or replace function public.pdf_delete(p_token uuid, p_numero bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  delete from notificacao_pdfs where notificacao = p_numero;
end $$;

grant execute on function public.pdf_numeros(uuid), public.pdf_save(uuid, bigint, text, text),
  public.pdf_get(uuid, bigint), public.pdf_delete(uuid, bigint) to anon, authenticated;

-- Observações por notificação (também por Nº, compartilhadas pelos itens da mesma notificação)
create table if not exists public.notificacao_obs (
  notificacao bigint primary key,
  texto text not null,
  atualizado_por text,
  updated_at timestamptz not null default now()
);
alter table public.notificacao_obs enable row level security;
revoke all on public.notificacao_obs from anon, authenticated;

create or replace function public.obs_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  return coalesce((select jsonb_object_agg(notificacao::text,
    jsonb_build_object('texto', texto, 'por', atualizado_por, 'em', updated_at)) from notificacao_obs), '{}'::jsonb);
end $$;

-- Texto vazio remove a observação
create or replace function public.obs_save(p_token uuid, p_numero bigint, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  if coalesce(trim(p_texto), '') = '' then
    delete from notificacao_obs where notificacao = p_numero;
  else
    insert into notificacao_obs (notificacao, texto, atualizado_por)
    values (p_numero, left(trim(p_texto), 4000), _sess(p_token))
    on conflict (notificacao) do update
      set texto = excluded.texto, atualizado_por = excluded.atualizado_por, updated_at = now();
  end if;
end $$;

grant execute on function public.obs_list(uuid), public.obs_save(uuid, bigint, text) to anon, authenticated;
