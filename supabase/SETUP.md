# Configuração do Quarto de Diamante

Esta primeira versão adiciona conversas livres com histórico e memórias persistentes por jogador, salvamento e Diamante. A execução de ordens no motor do jogo será integrada em uma etapa posterior; por enquanto a IA pode identificar uma ordem e propor uma ação, mas não deve afirmar que a executou.

## 1. Configurar o cliente web

Abra `supabase-config.js` e informe os dados públicos do seu projeto:

- `url`: Project URL.
- `publishableKey`: Publishable key (ou anon key legada).

Essa chave é pública e protegida pelas políticas RLS. **Nunca use a chave service_role neste arquivo.**

## 2. Criar as tabelas

No painel do Supabase, abra SQL Editor, crie uma nova consulta, cole o conteúdo de:

`supabase/migrations/20261112000000_diamond_chat.sql`

Execute uma vez. A migração cria as tabelas de mensagens e memórias, além de ativar políticas para que cada conta leia somente os próprios registros.

## 3. Configurar a inteligência artificial

No projeto Supabase, configure os secrets da Edge Function:

- `OPENAI_API_KEY`: chave privada da API de IA.
- `OPENAI_MODEL`: modelo disponível na sua conta (opcional; padrão atual no código: `gpt-4.1-mini`).

A chave da IA fica somente no servidor Supabase. Não a coloque no GitHub, no HTML ou no arquivo de configuração público.

## 4. Publicar a função

Com o Supabase CLI instalado e autenticado, a partir da raiz do repositório:

```bash
supabase functions deploy diamond-chat
supabase secrets set OPENAI_API_KEY=sua-chave
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
```

A função exige JWT e também valida a sessão recebida antes de acessar dados.

## 5. Ativar autenticação

No painel do Supabase, habilite Email/Password em Authentication > Providers. A configuração de confirmação de e-mail fica a seu critério. Se a confirmação estiver ativa, o jogador precisará confirmar o endereço antes de conversar.

## 6. Testar

1. Publique o site do Gempire usando HTTPS.
2. Crie uma conta de teste no Quarto de Diamante.
3. Entre em uma partida com ao menos uma Diamante subordinada e construa um Quarto de Diamante para ela em Homeworld.
4. Abra a aba Quartos, entre no quarto e envie uma mensagem.
5. Confira se as mensagens e memórias aparecem nas tabelas do Supabase.

O jogo continua jogável offline. Login, conversas e sincronização de memórias exigem internet.

## Limites desta etapa

- O cliente usa apenas a chave publicável do Supabase.
- A chave privada da IA fica nos secrets da Edge Function.
- Mensagens e memórias são separadas por conta, salvamento e Diamante.
- A IA não altera diretamente recursos, construções ou planetas nesta etapa.
- As respostas livres podem identificar ordens e comunicados; a execução real será conectada aos sistemas autorizados do Gempire depois de mapearmos cada ação e suas pré-condições.
