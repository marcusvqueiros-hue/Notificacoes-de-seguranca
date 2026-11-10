# Notificações de Segurança

Painel de acompanhamento de notificações (multas) aplicadas a equipes terceirizadas, com cadastro de notificações, gestão de usuários e exportação de imagens 16:9.

> Este repositório contém a **estrutura completa** do sistema com **dados fictícios** de demonstração. Nenhum dado real, usuário ou senha faz parte do código.

**Stack:** React 19 · Vite · Bun · Tailwind v4 · Apache ECharts · Motion · Zustand · Supabase

## Funcionalidades

- Login animado; perfis **Administrador** (cadastra notificações e gerencia usuários) e **Visualização** (somente painéis)
- Troca de senha obrigatória no primeiro acesso e alteração da própria senha
- Painéis: visão geral, por equipe, por colaborador e insights automáticos; gráficos com filtro por clique e filtros no menu lateral
- Tema claro/escuro, tela cheia, tabelas com rolagem
- **Fotografia**: imagem 16:9 do painel completo ou por coordenador / base / gerência
- Cadastro, edição, exclusão e importação de notificações por planilha; gestão e importação de usuários

## Rodando localmente

```bash
bun install
bun dev
```

Sem Supabase configurado, o `bun dev` usa dados locais fictícios. Login de demonstração (somente em desenvolvimento local): `@admin` / `admin123`.

## Banco de dados (Supabase)

1. Copie `.env.example` para `.env` e preencha a URL e a chave `anon` do seu projeto.
2. No SQL Editor, execute em ordem:
   - `supabase/schema.sql` (**antes, troque a senha do administrador inicial dentro do arquivo**)
   - `supabase/02_usuarios.sql`
   - `supabase/03_primeiro_acesso.sql`
   - `supabase/04_anexos_pdf.sql` (PDF e observações das notificações)
   - `supabase/05_resposta_pdf.sql` (PDF da resposta da notificação)
   - `supabase/seed.sql` (opcional: dados fictícios)

As tabelas têm RLS ativa **sem policies**: a chave pública não lê nem escreve nada diretamente. Todo acesso passa por funções `SECURITY DEFINER` que exigem token de sessão; senhas ficam em hash bcrypt.

Para gerar outros dados fictícios: `bun scripts/gen-fake-seed.ts`. Para converter uma planilha real: `bun scripts/build-seed.ts <planilha.xlsx>`.

## Deploy

Vercel, com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

Desenvolvido por Marcus Vinicius Silva Queiros.
