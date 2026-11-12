
/* Quarto das Diamantes · conversa livre, autenticação e memória persistente. */
let diamondChatClient = null;
let diamondChatSelectedId = null;
let diamondChatMessages = [];
let diamondChatNotice = "";
let diamondChatBusy = false;

function escapeDiamondChatHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
  });
}

function getDiamondChatSaveId() {
  if (!state.diamondChatSaveId) {
    const id = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
    state.diamondChatSaveId = "profile-" + id.replace(/[^a-zA-Z0-9-]/g, "");
    saveGame("autosave", true);
  }
  return state.diamondChatSaveId;
}

function getDiamondChatRooms() {
  const owners = Array.isArray(state.diamondQuartersOwners) ? state.diamondQuartersOwners : [];
  return (state.matriarchs || [])
    .filter(function (diamond) { return owners.includes(diamond.id); })
    .map(function (diamond) {
      return {
        id: String(diamond.id),
        name: diamond.name || "Diamante sem nome",
        personalityName: diamond.personalityName || "Personalidade em formação",
        personalityDesc: diamond.personalityDesc || "",
        personalityId: diamond.personalityId || "emergent",
        badge: diamond.badge || "Diamante",
        loyalty: Number(diamond.loyalty) || 0,
        autonomy: Number(diamond.autonomy) || 0,
        essence: Number(diamond.essence) || 0
      };
    });
}

async function getDiamondChatClient() {
  if (diamondChatClient) return diamondChatClient;
  const config = window.GEMPIRE_SUPABASE_CONFIG || {};
  const url = String(config.url || "").trim();
  const publicKey = String(config.publishableKey || "").trim();
  if (!url || !publicKey) return null;

  const module = await import("https://esm.sh/@supabase/supabase-js@2");
  diamondChatClient = module.createClient(url, publicKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return diamondChatClient;
}

function renderDiamondQuartersTab(container) {
  if (!container) return;
  const rooms = getDiamondChatRooms();
  const config = window.GEMPIRE_SUPABASE_CONFIG || {};
  const configured = !!(String(config.url || "").trim() && String(config.publishableKey || "").trim());

  let roomList = "";
  if (!rooms.length) {
    roomList = '<div class="stat-box" style="color:var(--text-muted)">Nenhum Quarto de Diamante subordinado está disponível. Forje uma Diamante e construa um Quarto de Diamante em Homeworld para abrir uma comunicação privada.</div>';
  } else {
    roomList = rooms.map(function (room) {
      const active = room.id === diamondChatSelectedId ? " active" : "";
      return '<button type="button" class="diamond-chat-room' + active + '" data-diamond-chat-owner="' + escapeDiamondChatHtml(room.id) + '">' +
        '<span class="diamond-chat-room-info"><b>' + escapeDiamondChatHtml(room.name) + '</b><small>' +
        escapeDiamondChatHtml(room.personalityName) + ' · Lealdade ' + Math.round(room.loyalty) + '% · Autonomia ' + Math.round(room.autonomy) + '%</small></span>' +
        '<span style="color:var(--cyan);font-size:11px">Entrar ↗</span></button>';
    }).join("");
  }

  container.innerHTML =
    '<div class="card card-cyan"><div class="card-header"><span class="card-title title-font">💎 Câmara privada das Diamantes</span><span class="badge">' + rooms.length + ' quarto(s) disponível(is)</span></div>' +
    '<p class="structure-desc">Converse livremente com cada Diamante que possui um quarto próprio. As mensagens e memórias ficam vinculadas à sua conta, ao salvamento e à personagem.</p>' +
    '<div class="diamond-chat-rooms">' + roomList + '</div></div>' +
    '<div id="diamond-chat-account-panel" class="card"><div class="diamond-chat-status">Verificando configuração de comunicação...</div></div>';

  container.querySelectorAll("[data-diamond-chat-owner]").forEach(function (button) {
    button.addEventListener("click", function () {
      diamondChatSelectedId = button.getAttribute("data-diamond-chat-owner");
      diamondChatNotice = "";
      renderDiamondQuartersTab(container);
    });
  });

  const accountPanel = container.querySelector("#diamond-chat-account-panel");
  if (!configured) {
    accountPanel.innerHTML =
      '<div class="card-header"><span class="card-title">Conexão pendente</span><span class="badge">Configuração necessária</span></div>' +
      '<p style="font-size:11px;color:#cbd5e1;line-height:1.5">O projeto Supabase ainda não foi conectado ao cliente do Gempire. Preencha <b>url</b> e <b>publishableKey</b> em <code>supabase-config.js</code>. Não coloque aqui a chave service_role nem a chave da IA.</p>';
    return;
  }

  getDiamondChatClient().then(async function (client) {
    if (!container.isConnected || state.drawerTab !== "quarters" || !accountPanel.isConnected) return;
    const sessionResult = await client.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const session = sessionResult.data.session;
    if (!session || !session.user) {
      renderDiamondChatAuth(accountPanel, client);
      return;
    }
    await renderDiamondChatConversation(accountPanel, client, session.user);
  }).catch(function (error) {
    console.error("Falha ao inicializar o Quarto de Diamante:", error);
    if (accountPanel.isConnected) {
      accountPanel.innerHTML = '<div class="card-header"><span class="card-title">Conexão indisponível</span></div><p style="font-size:11px;color:#fda4af">' +
        escapeDiamondChatHtml(error.message || "Não foi possível conectar ao Supabase.") + '</p><p class="diamond-chat-hint">Verifique a URL, a chave publicável e sua conexão com a internet.</p>';
    }
  });
}

function renderDiamondChatAuth(panel, client) {
  panel.innerHTML =
    '<div class="card-header"><span class="card-title">Conta do Império</span><span class="badge">Login necessário</span></div>' +
    '<p style="font-size:11px;color:#cbd5e1;line-height:1.45">Entre ou crie uma conta para guardar as conversas e memórias das Diamantes na nuvem. A partida continua disponível offline; esta comunicação exige internet.</p>' +
    '<form id="diamond-chat-auth-form" class="diamond-chat-compose">' +
    '<input id="diamond-chat-email" class="diamond-chat-input" type="email" autocomplete="email" placeholder="E-mail" required>' +
    '<input id="diamond-chat-password" class="diamond-chat-input" type="password" autocomplete="current-password" minlength="8" placeholder="Senha (mínimo 8 caracteres)" required>' +
    '<div class="grid-2"><button class="btn active" type="submit">Entrar</button><button class="btn" type="button" id="diamond-chat-signup">Criar conta</button></div>' +
    '</form><div id="diamond-chat-auth-status" class="diamond-chat-status"></div>';

  const form = panel.querySelector("#diamond-chat-auth-form");
  const status = panel.querySelector("#diamond-chat-auth-status");
  const signup = panel.querySelector("#diamond-chat-signup");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const email = panel.querySelector("#diamond-chat-email").value.trim();
    const password = panel.querySelector("#diamond-chat-password").value;
    status.textContent = "Entrando...";
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) {
      status.textContent = result.error.message;
      return;
    }
    diamondChatNotice = "Sessão iniciada.";
    renderDiamondQuartersTab(document.getElementById("drawer-body"));
  });

  signup.addEventListener("click", async function () {
    const email = panel.querySelector("#diamond-chat-email").value.trim();
    const password = panel.querySelector("#diamond-chat-password").value;
    if (!email || password.length < 8) {
      status.textContent = "Informe um e-mail válido e uma senha com pelo menos 8 caracteres.";
      return;
    }
    status.textContent = "Criando conta...";
    const result = await client.auth.signUp({ email, password });
    if (result.error) {
      status.textContent = result.error.message;
      return;
    }
    if (result.data.session) {
      diamondChatNotice = "Conta criada e sessão iniciada.";
      renderDiamondQuartersTab(document.getElementById("drawer-body"));
    } else {
      status.textContent = "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.";
    }
  });
}

function getDiamondChatGameContext(diamond) {
  const governor = "matriarch_" + diamond.id;
  const governedPlanets = Object.values(PLANETS || {}).filter(function (planet) {
    return planet && planet.governor === governor;
  }).slice(0, 12).map(function (planet) {
    return {
      id: planet.id,
      name: planet.name || planet.shortName || planet.id,
      colonized: !!planet.colonized,
      resourcesRemaining: Math.max(0, Math.floor(Number(planet.resourcesRemaining) || 0)),
      hasGalaxyWarp: !!planet.galaxyWarpBuilt
    };
  });

  return {
    era: Number(state.era) || 0,
    cycle: Number(state.cycleCount) || 1,
    matriarch: state.firstDiamond ? state.firstDiamond.name : "Matriarca",
    diamond: {
      id: diamond.id,
      name: diamond.name,
      personalityId: diamond.personalityId,
      personalityName: diamond.personalityName,
      personalityDescription: diamond.personalityDesc,
      badge: diamond.badge,
      loyalty: diamond.loyalty,
      autonomy: diamond.autonomy,
      essence: Math.max(0, Number(diamond.essence) || 0)
    },
    empire: {
      minerals: Math.max(0, Number(state.minerals) || 0),
      technology: Math.max(0, Number(state.tech) || 0),
      energy: Math.max(0, Number(state.energy) || 0),
      colonizedPlanets: Object.values(PLANETS || {}).filter(function (planet) { return planet && planet.colonized; }).length
    },
    governedPlanets: governedPlanets
  };
}

async function renderDiamondChatConversation(panel, client, user) {
  const rooms = getDiamondChatRooms();
  if (!rooms.length) {
    panel.innerHTML = '<div class="card-header"><span class="card-title">Quartos indisponíveis</span></div><p class="diamond-chat-hint">Construa um Quarto de Diamante para uma Diamante subordinada. A residência da Matriarca não abre uma conversa consigo mesma.</p>';
    return;
  }

  if (!rooms.some(function (room) { return room.id === diamondChatSelectedId; })) {
    diamondChatSelectedId = rooms[0].id;
  }
  const selected = rooms.find(function (room) { return room.id === diamondChatSelectedId; });
  const saveId = getDiamondChatSaveId();

  panel.innerHTML =
    '<div class="diamond-chat-account"><span style="font-size:10px;color:var(--text-muted)">Conectado: ' + escapeDiamondChatHtml(user.email || "conta autenticada") + '</span><button type="button" class="btn" id="diamond-chat-logout">Sair</button></div>' +
    '<div class="card-header"><span class="card-title">Quarto de ' + escapeDiamondChatHtml(selected.name) + '</span><span class="badge">' + escapeDiamondChatHtml(selected.personalityName) + '</span></div>' +
    '<div id="diamond-chat-transcript" class="diamond-chat-transcript"><div class="diamond-chat-hint">Carregando histórico privado...</div></div>' +
    '<form id="diamond-chat-compose-form" class="diamond-chat-compose">' +
    '<textarea id="diamond-chat-message" class="diamond-chat-input" maxlength="2000" placeholder="Escreva livremente para esta Diamante..." required></textarea>' +
    '<button id="diamond-chat-send" class="btn active" type="submit" ' + (diamondChatBusy ? "disabled" : "") + '>Enviar mensagem ↗</button>' +
    '</form>' +
    '<div id="diamond-chat-status" class="diamond-chat-status">' + escapeDiamondChatHtml(diamondChatNotice) + '</div>' +
    '<p class="diamond-chat-hint">As mensagens são privadas desta conta e deste salvamento. Nesta primeira etapa, ordens podem ser reconhecidas e discutidas, mas ainda não executam alterações no mundo do jogo.</p>';

  panel.querySelector("#diamond-chat-logout").addEventListener("click", async function () {
    await client.auth.signOut();
    diamondChatMessages = [];
    diamondChatSelectedId = rooms[0].id;
    diamondChatNotice = "Sessão encerrada.";
    renderDiamondQuartersTab(document.getElementById("drawer-body"));
  });

  const historyResult = await client
    .from("diamond_chat_messages")
    .select("id, role, content, metadata, created_at")
    .eq("save_id", saveId)
    .eq("diamond_id", selected.id)
    .order("created_at", { ascending: false })
    .limit(40);

  const transcript = panel.querySelector("#diamond-chat-transcript");
  if (historyResult.error) {
    transcript.innerHTML = '<div class="diamond-chat-hint" style="color:#fda4af">Não foi possível carregar o histórico. Confirme se a migração SQL foi executada no Supabase.</div>';
  } else {
    diamondChatMessages = (historyResult.data || []).reverse();
    if (!diamondChatMessages.length) {
      transcript.innerHTML = '<div class="diamond-chat-hint">Este quarto ainda não possui conversas. Escreva a primeira mensagem para iniciar a relação.</div>';
    } else {
      transcript.innerHTML = diamondChatMessages.map(function (message) {
        const label = message.role === "user" ? "Matriarca" : selected.name;
        return '<div class="diamond-chat-message ' + (message.role === "user" ? "user" : "assistant") + '">' +
          '<small>' + escapeDiamondChatHtml(label) + '</small>' + escapeDiamondChatHtml(message.content) + '</div>';
      }).join("");
      transcript.scrollTop = transcript.scrollHeight;
    }
  }

  panel.querySelector("#diamond-chat-compose-form").addEventListener("submit", function (event) {
    event.preventDefault();
    sendDiamondChatMessage(client, selected);
  });
}

async function sendDiamondChatMessage(client, diamond) {
  if (diamondChatBusy) return;
  const textarea = document.getElementById("diamond-chat-message");
  const sendButton = document.getElementById("diamond-chat-send");
  const status = document.getElementById("diamond-chat-status");
  const message = textarea ? textarea.value.trim() : "";
  if (!message) return;
  if (message.length > 2000) {
    if (status) status.textContent = "A mensagem ultrapassa o limite de 2.000 caracteres.";
    return;
  }

  diamondChatBusy = true;
  if (sendButton) sendButton.disabled = true;
  if (status) status.textContent = "A Diamante está respondendo...";
  try {
    const result = await client.functions.invoke("diamond-chat", {
      body: {
        saveId: getDiamondChatSaveId(),
        diamondId: diamond.id,
        diamondName: diamond.name,
        message: message,
        gameContext: getDiamondChatGameContext(diamond)
      }
    });

    if (result.error) {
      let detail = result.error.message || "Falha ao chamar a função.";
      if (result.error.context && typeof result.error.context.json === "function") {
        try {
          const body = await result.error.context.json();
          if (body && body.error) detail = body.error;
        } catch (_) {}
      }
      throw new Error(detail);
    }
    if (result.data && result.data.error) throw new Error(result.data.error);

    diamondChatNotice = result.data && result.data.intent && result.data.intent !== "conversation"
      ? (result.data.intent === "order"
        ? "Ordem identificada. A execução no motor do jogo será integrada na próxima etapa; nada foi alterado no mundo."
        : "Comunicado identificado e registrado na conversa.")
      : "Resposta recebida e salva.";
    diamondChatBusy = false;
    const body = document.getElementById("drawer-body");
    if (body && state.drawerTab === "quarters") renderDiamondQuartersTab(body);
  } catch (error) {
    diamondChatBusy = false;
    if (status) status.textContent = error.message || "Não foi possível enviar a mensagem.";
    if (sendButton) sendButton.disabled = false;
  }
}
