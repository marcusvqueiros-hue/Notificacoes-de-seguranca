-- Observações visíveis para TODOS os usuários (execute no SQL Editor do Supabase, depois do 11_observacao_por_item.sql).
-- Até aqui só administradores conseguiam ler as observações. Agora qualquer usuário com sessão válida pode LER
-- (a tela Visão geral mostra a observação ao lado da não conformidade). Para GRAVAR continua só administrador (obs_item_save).

create or replace function public.obs_item_list(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if _sess(p_token) is null then raise exception 'sessão inválida'; end if;
  return coalesce((select jsonb_object_agg(item_id::text,
    jsonb_build_object('texto', texto, 'por', atualizado_por, 'em', updated_at)) from item_obs), '{}'::jsonb);
end $$;

grant execute on function public.obs_item_list(uuid) to anon, authenticated;
