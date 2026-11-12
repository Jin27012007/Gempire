import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getResponseText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function parseAssistantPayload(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      reply: String(parsed.reply ?? parsed.message ?? "").trim(),
      intent: ["conversation", "order", "communication"].includes(parsed.intent)
        ? parsed.intent
        : "conversation",
      actionProposal: parsed.actionProposal && typeof parsed.actionProposal === "object"
        ? parsed.actionProposal
        : null,
      memories: Array.isArray(parsed.memories) ? parsed.memories.slice(0, 3) : [],
    };
  } catch {
    return {
      reply: raw.trim(),
      intent: "conversation",
      actionProposal: null,
      memories: [],
    };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ error: "Autenticação necessária." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "A função não está configurada com as credenciais do Supabase." }, 500);
    }
    if (!openAiKey) {
      return json({ error: "A chave da API de IA ainda não foi configurada no Supabase." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);
    const userId = authData.user.id;

    const body = await request.json();
    const saveId = String(body.saveId ?? "").trim();
    const diamondId = String(body.diamondId ?? "").trim();
    const diamondName = String(body.diamondName ?? "Diamante").trim().slice(0, 80);
    const message = String(body.message ?? "").trim();
    const gameContext = body.gameContext && typeof body.gameContext === "object"
      ? body.gameContext
      : {};

    if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(saveId)) {
      return json({ error: "Identificador de salvamento inválido." }, 400);
    }
    if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(diamondId)) {
      return json({ error: "Identificador de Diamante inválido." }, 400);
    }
    if (!message || message.length > 2000) {
      return json({ error: "A mensagem deve ter entre 1 e 2.000 caracteres." }, 400);
    }

    // Todo acesso com service_role é filtrado explicitamente pelo user_id autenticado.
    const { data: userMessage, error: insertUserError } = await admin
      .from("diamond_chat_messages")
      .insert({
        user_id: userId,
        save_id: saveId,
        diamond_id: diamondId,
        role: "user",
        content: message,
        metadata: {},
      })
      .select("id")
      .single();

    if (insertUserError) {
      console.error("Falha ao salvar mensagem do jogador:", insertUserError);
      return json({ error: "Não foi possível salvar sua mensagem. Verifique se a migração SQL foi executada." }, 500);
    }

    const [{ data: history, error: historyError }, { data: memories, error: memoriesError }] = await Promise.all([
      admin
        .from("diamond_chat_messages")
        .select("role, content")
        .eq("user_id", userId)
        .eq("save_id", saveId)
        .eq("diamond_id", diamondId)
        .order("created_at", { ascending: false })
        .limit(24),
      admin
        .from("diamond_chat_memories")
        .select("memory_type, content, importance, created_at")
        .eq("user_id", userId)
        .eq("save_id", saveId)
        .eq("diamond_id", diamondId)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (historyError || memoriesError) {
      console.error("Falha ao recuperar contexto:", historyError ?? memoriesError);
      return json({ error: "Não foi possível recuperar o histórico desta Diamante." }, 500);
    }

    const systemPrompt = [
      "Você é uma Diamante subordinada no universo do jogo Gempire. Converse em português do Brasil.",
      "Sua identidade, personalidade, lealdade, autonomia e descrição estão nos dados de contexto. Preserve essa personalidade de forma consistente.",
      "Você está conversando diretamente com a Matriarca. Não aja como assistente genérica; responda como a personagem.",
      "Use o histórico e as memórias como fatos persistentes. Não invente promessas, acontecimentos, planetas, construções, recursos ou decisões.",
      "Você pode conversar livremente, questionar, discordar, negociar e reagir emocionalmente conforme sua personalidade.",
      "Ordens e comunicados devem ser reconhecidos como tais. Nesta versão inicial, você pode identificar e propor uma ação, mas NÃO afirme que executou uma ação no jogo. Nenhuma construção, transferência, colonização ou alteração de recurso é concluída pela conversa ainda.",
      "Quando uma ordem não puder ser avaliada com os dados disponíveis, peça esclarecimentos em vez de presumir.",
      "Retorne exclusivamente um objeto JSON com os campos: reply (resposta natural à Matriarca), intent (conversation, order ou communication), actionProposal (objeto breve ou null) e memories (array de até 3 fatos duradouros explicitamente estabelecidos nesta conversa).",
      "Não transforme hipóteses ou sugestões em memórias confirmadas. Não armazene trivialidades. Escreva uma resposta natural, sem mencionar JSON, API ou programação.",
      "Identidade e contexto da Diamante: " + JSON.stringify({
        diamondName,
        gameContext,
        memories: memories ?? [],
      }).slice(0, 9000),
    ].join("\n\n");

    const orderedHistory = (history ?? []).slice().reverse().map((item) => ({
      role: item.role,
      content: item.content,
    }));

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: orderedHistory,
        max_output_tokens: 700,
        text: { format: { type: "json_object" } },
      }),
    });

    const aiPayload = await aiResponse.json();
    if (!aiResponse.ok) {
      console.error("Erro do provedor de IA:", aiPayload);
      await admin.from("diamond_chat_messages").delete().eq("id", userMessage.id).eq("user_id", userId);
      return json({ error: "O serviço de inteligência artificial recusou a solicitação. Verifique a chave e o modelo configurado." }, 502);
    }

    const rawText = getResponseText(aiPayload);
    if (!rawText) {
      return json({ error: "A inteligência artificial não retornou uma resposta legível." }, 502);
    }

    const parsed = parseAssistantPayload(rawText);
    const reply = parsed.reply || rawText;
    const metadata = {
      intent: parsed.intent,
      actionProposal: parsed.actionProposal,
    };

    const { error: insertAssistantError } = await admin
      .from("diamond_chat_messages")
      .insert({
        user_id: userId,
        save_id: saveId,
        diamond_id: diamondId,
        role: "assistant",
        content: reply,
        metadata,
      });

    if (insertAssistantError) {
      console.error("Falha ao salvar resposta:", insertAssistantError);
      return json({ error: "A resposta foi gerada, mas não pôde ser salva no histórico." }, 500);
    }

    const memoryRows = parsed.memories
      .filter((item: any) => item && typeof item.content === "string" && item.content.trim())
      .map((item: any) => ({
        user_id: userId,
        save_id: saveId,
        diamond_id: diamondId,
        memory_type: String(item.type ?? "general").slice(0, 40),
        content: String(item.content).trim().slice(0, 1000),
        importance: Math.max(1, Math.min(5, Number(item.importance) || 3)),
        source_message_id: userMessage.id,
      }));

    let memoriesSaved = 0;
    if (memoryRows.length) {
      const { data: savedMemories, error: memoryInsertError } = await admin
        .from("diamond_chat_memories")
        .insert(memoryRows)
        .select("id");
      if (memoryInsertError) {
        console.warn("Resposta salva, mas houve falha ao registrar memórias:", memoryInsertError);
      } else {
        memoriesSaved = savedMemories?.length ?? 0;
      }
    }

    return json({
      reply,
      intent: parsed.intent,
      actionProposal: parsed.actionProposal,
      memoriesSaved,
    });
  } catch (error) {
    console.error("Falha inesperada em diamond-chat:", error);
    return json({ error: "Erro interno ao processar a conversa." }, 500);
  }
});
