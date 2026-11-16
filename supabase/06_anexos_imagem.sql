-- Anexos em PDF OU imagem (JPG/PNG) na notificação e na resposta
-- (execute no SQL Editor do Supabase, depois do 05_resposta_pdf.sql).
-- Só substitui as funções de gravação: as tabelas e as funções de leitura/remoção continuam as mesmas.
-- Aceita PDF (%PDF), JPEG (FF D8 FF) e PNG (89 50 4E 47). Limite: 5 MB.

create or replace function public.pdf_save(p_token uuid, p_numero bigint, p_nome text, p_base64 text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b bytea;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'arquivo muito grande (máximo de 5 MB)'; end if;
  if not (substring(b from 1 for 4) = '\x25504446'::bytea      -- PDF
       or substring(b from 1 for 3) = '\xffd8ff'::bytea        -- JPEG
       or substring(b from 1 for 4) = '\x89504e47'::bytea)     -- PNG
  then raise exception 'o arquivo precisa ser PDF, JPG ou PNG'; end if;
  insert into notificacao_pdfs (notificacao, nome, tamanho, conteudo, enviado_por)
  values (p_numero, left(coalesce(nullif(trim(p_nome), ''), 'notificacao'), 200), octet_length(b), b, _sess(p_token))
  on conflict (notificacao) do update
    set nome = excluded.nome, tamanho = excluded.tamanho, conteudo = excluded.conteudo,
        enviado_por = excluded.enviado_por, created_at = now();
end $$;

create or replace function public.resp_save(p_token uuid, p_numero bigint, p_nome text, p_base64 text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare b bytea;
begin
  if not _is_admin(p_token) then raise exception 'apenas administradores'; end if;
  if p_numero is null then raise exception 'informe o nº da notificação'; end if;
  b := decode(p_base64, 'base64');
  if octet_length(b) > 5 * 1024 * 1024 then raise exception 'arquivo muito grande (máximo de 5 MB)'; end if;
  if not (substring(b from 1 for 4) = '\x25504446'::bytea
       or substring(b from 1 for 3) = '\xffd8ff'::bytea
       or substring(b from 1 for 4) = '\x89504e47'::bytea)
  then raise exception 'o arquivo precisa ser PDF, JPG ou PNG'; end if;
  insert into notificacao_resposta_pdfs (notificacao, nome, tamanho, conteudo, enviado_por)
  values (p_numero, left(coalesce(nullif(trim(p_nome), ''), 'resposta'), 200), octet_length(b), b, _sess(p_token))
  on conflict (notificacao) do update
    set nome = excluded.nome, tamanho = excluded.tamanho, conteudo = excluded.conteudo,
        enviado_por = excluded.enviado_por, created_at = now();
end $$;

grant execute on function public.pdf_save(uuid, bigint, text, text), public.resp_save(uuid, bigint, text, text) to anon, authenticated;
