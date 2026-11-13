/* Gempire · Convívio das Diamantes
 * Interações presenciais, vínculo social, emoções e fila de ações.
 * O sistema é local e faz parte do estado persistente da campanha.
 */
(function () {
    const ACTIONS = {
        converse: {
            label: 'Conversar', icon: '💬', category: 'Social', duration: 5,
            description: 'Uma conversa casual para conhecer melhor a Diamante.',
            friendship: 3, trust: 1, respect: 0, tension: -1, mood: 'content'
        },
        praise: {
            label: 'Elogiar', icon: '✧', category: 'Afeto', duration: 4,
            description: 'Reconhecer uma qualidade ou conquista dela.',
            friendship: 3, trust: 1, respect: 2, tension: -1, mood: 'pleased'
        },
        listen: {
            label: 'Ouvir preocupações', icon: '♡', category: 'Apoio', duration: 8,
            description: 'Dar espaço para que ela fale sem ser interrompida.',
            friendship: 2, trust: 4, respect: 1, tension: -3, mood: 'soothed'
        },
        joke: {
            label: 'Contar uma piada', icon: '☼', category: 'Social', duration: 4,
            description: 'Tentar quebrar a formalidade e fazê-la rir.',
            friendship: 4, trust: 0, respect: -1, tension: -1, mood: 'amused'
        },
        advice: {
            label: 'Pedir conselho', icon: '◇', category: 'Conversa profunda', duration: 7,
            description: 'Pedir a opinião dela sobre os rumos do Império.',
            friendship: 1, trust: 2, respect: 4, tension: 0, mood: 'inspired'
        },
        ideology: {
            label: 'Debater doutrina', icon: '⚖', category: 'Conversa profunda', duration: 9,
            description: 'Discutir valores, leis e o futuro da sociedade Gem.',
            friendship: 0, trust: 1, respect: 3, tension: 2, mood: 'thoughtful'
        },
        comfort: {
            label: 'Consolar', icon: '❀', category: 'Apoio', duration: 7,
            description: 'Acolher a Diamante quando está sob pressão.',
            friendship: 3, trust: 3, respect: 0, tension: -4, mood: 'soothed'
        }
    };

    const PERSONALITY_RESPONSES = {
        militarist: {
            converse: ['A disciplina não precisa impedir uma boa conversa.', 'É bom falar sem que exista uma crise para resolver.', 'Aguardo seu próximo comando, mas este momento foi agradável.'],
            praise: ['O reconhecimento fortalece a determinação.', 'Aceito o elogio. Vou provar que ele é merecido.', 'Uma comandante também precisa saber quando fez um bom trabalho.'],
            listen: ['Não costumo demonstrar dúvidas. Obrigada por ouvir.', 'A pressão da Corte é maior do que parece.', 'Às vezes, até uma estrategista precisa baixar a guarda.'],
            joke: ['Essa foi inesperada. Admito que sorri.', 'Humor não é meu forte, mas essa funcionou.', 'Não conte aos meus soldados que achei graça.'],
            advice: ['A segurança deve preceder qualquer avanço.', 'Consolide as fronteiras antes de abrir novas frentes.', 'Uma decisão firme agora evita muitas baixas depois.'],
            ideology: ['A ordem precisa de força para sobreviver.', 'Não confundamos compaixão com ausência de disciplina.', 'Discordo, mas defenderei meu argumento com fatos.'],
            comfort: ['Não estou acostumada a receber esse tipo de apoio.', 'Sua presença me devolve o foco.', 'Não vou esquecer que ficou ao meu lado.']
        },
        melancholic: {
            converse: ['Gosto quando a Corte permite que o silêncio seja preenchido por palavras.', 'Há tantas coisas que gostaria de contar...', 'Este momento parece suspender o peso dos ciclos.'],
            praise: ['Guardarei suas palavras com cuidado.', 'É raro sentir que alguém percebe meus esforços.', 'Seu reconhecimento significa mais do que imagina.'],
            listen: ['Obrigada por não tentar corrigir tudo imediatamente.', 'Carrego lembranças que não cabem nos relatórios.', 'Foi um alívio poder falar.'],
            joke: ['Uma pequena alegria ainda é uma alegria.', 'Não esperava rir hoje. Obrigada.', 'Talvez eu conte essa piada em outro encontro.'],
            advice: ['Preserve os laços antes que a distância se torne irreversível.', 'A memória da Corte também é uma forma de proteção.', 'Nem toda oportunidade precisa ser aproveitada imediatamente.'],
            ideology: ['Uma sociedade sem memória repete as próprias feridas.', 'A tradição pode proteger, mas também pode aprisionar.', 'Preciso pensar melhor sobre o que disse.'],
            comfort: ['Sua gentileza tornou este ciclo menos pesado.', 'Não precisava de uma solução. Precisava ser ouvida.', 'Obrigada por não me deixar sozinha com esses pensamentos.']
        },
        empathic: {
            converse: ['Quero saber também o que existe além dos relatórios imperiais.', 'Sempre há algo novo para conhecer em alguém.', 'Sinto que estamos nos entendendo melhor.'],
            praise: ['Você reparou nisso? Fico genuinamente feliz.', 'É bom ser vista além do que produzo.', 'Seu elogio aqueceu meu núcleo.'],
            listen: ['Obrigada por criar um espaço seguro para conversar.', 'Também quero ouvir o que você sente sobre tudo isso.', 'A confiança começa quando ninguém precisa fingir.'],
            joke: ['Ah! Essa foi maravilhosa!', 'Precisávamos rir um pouco.', 'Vou lembrar dessa quando o dia ficar difícil.'],
            advice: ['Considere quem será afetado por cada decisão.', 'Crescimento não precisa significar destruição.', 'Ouvir as pessoas pode revelar soluções que os números escondem.'],
            ideology: ['A liberdade precisa existir também para quem pensa diferente.', 'Não quero que a empatia seja confundida com fraqueza.', 'Podemos discordar sem apagar a dignidade uma da outra.'],
            comfort: ['Obrigada por cuidar de mim também.', 'Às vezes, quem acolhe os outros precisa ser acolhida.', 'Sua companhia me faz sentir menos isolada.']
        },
        technocrat: {
            converse: ['Uma conversa informal também pode produzir dados úteis.', 'Tenho algumas hipóteses sobre o comportamento da Corte.', 'Sua presença reduziu o ruído dos meus cálculos.'],
            praise: ['Reconhecimento registrado. É um incentivo eficiente.', 'A qualidade do trabalho foi validada.', 'Agradeço. A precisão exige esforço.'],
            listen: ['Não é simples transformar sentimentos em variáveis.', 'Há aspectos que meus modelos não conseguem prever.', 'Obrigada por ouvir sem exigir uma conclusão.'],
            joke: ['A probabilidade de eu rir era baixa. Você alterou o resultado.', 'Interessante. O humor humano tem utilidade social.', 'Foi... estatisticamente agradável.'],
            advice: ['Invista onde a eficiência marginal for maior.', 'Colete dados antes de comprometer recursos.', 'A hipótese mais promissora merece um teste controlado.'],
            ideology: ['Defina os critérios antes de discutir a conclusão.', 'Valores também produzem consequências mensuráveis.', 'Sua premissa é interessante, embora incompleta.'],
            comfort: ['Sua presença ajudou a reduzir minha tensão.', 'Não tenho uma resposta analítica para tudo.', 'Agradeço por não tratar minhas dúvidas como falhas.']
        },
        visionary: {
            converse: ['Imagine quantas histórias ainda não vivemos.', 'A galáxia parece menor quando conversamos assim.', 'Quero falar sobre o que ainda podemos construir.'],
            praise: ['Você enxerga o potencial antes de ele se tornar realidade.', 'Esse reconhecimento me inspira a ir além.', 'Não pretendo decepcionar suas expectativas.'],
            listen: ['Tenho tantos planos que às vezes esqueço de respirar.', 'É difícil explicar a sensação de estar sempre olhando adiante.', 'Obrigada por ouvir meus sonhos sem reduzi-los a números.'],
            joke: ['Até o futuro precisa de algumas risadas.', 'Essa foi boa! Não estava nos meus planos.', 'Vou guardar essa para a próxima expedição.'],
            advice: ['Não confunda cautela com imobilidade.', 'Escolha uma fronteira e transforme-a em possibilidade.', 'O Império precisa de uma visão que ultrapasse Homeworld.'],
            ideology: ['O futuro não deve ser prisioneiro do passado.', 'Expandir também significa assumir responsabilidades.', 'Discordar é útil quando nos obriga a enxergar além.'],
            comfort: ['Às vezes, o horizonte parece distante demais.', 'Obrigada por me lembrar por que comecei.', 'Sua confiança me dá coragem para continuar.']
        },
        isolationist: {
            converse: ['Não costumo conversar por tanto tempo. Foi aceitável.', 'A confiança é construída devagar.', 'É bom saber que este espaço permanece protegido.'],
            praise: ['Aceito seu reconhecimento, embora prefira resultados.', 'Não costumo confiar em elogios facilmente.', 'Suas palavras serão consideradas.'],
            listen: ['Não compartilho isso com qualquer pessoa.', 'Manter tudo sob controle também é cansativo.', 'Obrigada por respeitar meu silêncio quando precisei.'],
            joke: ['Não foi ruim. Não se acostume.', 'Talvez eu tenha sorrido um pouco.', 'O humor não é uma prioridade, mas foi tolerável.'],
            advice: ['Proteja o que já conquistamos antes de correr riscos.', 'Informações externas devem ser verificadas.', 'Uma fronteira segura vale mais que dez promessas.'],
            ideology: ['A abertura sem limites é uma vulnerabilidade.', 'Não confio em mudanças que chegam depressa demais.', 'Posso reconsiderar, mas preciso de garantias.'],
            comfort: ['Não precisava ficar. Mas fico grata por isso.', 'Sua presença não parece uma ameaça.', 'Talvez eu possa baixar um pouco minhas defesas.']
        },
        artist: {
            converse: ['Até uma conversa pode ter ritmo e composição.', 'Adoro observar como cada pessoa organiza suas ideias.', 'Este encontro já parece uma pequena obra.'],
            praise: ['Você notou o detalhe! Isso me alegra.', 'A beleza está em perceber o que outros ignoram.', 'Seu elogio tem uma delicadeza especial.'],
            listen: ['Nem sempre consigo explicar o que sinto criando.', 'Há ideias que precisam ser acolhidas antes de ganhar forma.', 'Obrigada por ouvir sem tentar me apressar.'],
            joke: ['Uma boa piada também é uma forma de arte.', 'Essa merece ser lembrada!', 'Você quase arruinou minha pose solene.'],
            advice: ['Uma cidade precisa refletir quem vive nela.', 'Não sacrifique identidade em nome de eficiência.', 'O Império também será lembrado pelo que criou.'],
            ideology: ['A ordem sem expressão se torna uma prisão.', 'A beleza pode ser uma necessidade, não um luxo.', 'Sua visão tem uma forma interessante.'],
            comfort: ['Obrigada por me permitir descansar a mente.', 'Nem tudo precisa ser perfeito o tempo inteiro.', 'Sua presença trouxe cor a este ciclo.']
        },
        scholar: {
            converse: ['Há mais perguntas do que tempo para respondê-las.', 'Gosto de conversas que deixam novas questões.', 'Podemos continuar essa discussão em outro ciclo.'],
            praise: ['O mérito pertence também ao método.', 'Agradeço. O conhecimento raramente é construído sozinha.', 'Seu reconhecimento valoriza o esforço intelectual.'],
            listen: ['Há descobertas que mudam quem as realiza.', 'Nem todo conhecimento traz conforto.', 'Obrigada por ouvir antes de tirar conclusões.'],
            joke: ['Uma hipótese inesperada. Funcionou.', 'Vou registrar essa como evidência de humor.', 'Foi mais divertida do que eu esperava.'],
            advice: ['Preserve os registros e questione as fontes.', 'Conhecimento sem contexto pode se tornar perigoso.', 'Investigue antes de transformar uma hipótese em lei.'],
            ideology: ['Nenhuma doutrina deve estar acima de questionamento.', 'A evidência pode desafiar até as tradições mais antigas.', 'Sua tese merece uma análise mais profunda.'],
            comfort: ['Até estudiosas precisam de companhia.', 'Obrigada por me lembrar que não sou apenas minhas descobertas.', 'Sua paciência é valiosa.']
        },
        hedonist: {
            converse: ['Uma conversa agradável é um uso excelente do tempo.', 'Precisamos de mais momentos assim na Corte.', 'A eternidade deve ter algum encanto.'],
            praise: ['Finalmente alguém reconhece meu bom gosto.', 'Continue. Estou gostando desta conversa.', 'Seu elogio foi muito bem recebido.'],
            listen: ['Até uma vida de esplendor pode ser cansativa.', 'Não quero que tudo seja uma obrigação.', 'Obrigada por me deixar falar sem formalidades.'],
            joke: ['Essa merece uma celebração!', 'Você sabe tornar um encontro interessante.', 'Mais uma! Estou me divertindo.'],
            advice: ['O Império precisa de motivos para celebrar suas conquistas.', 'Conforto também sustenta a lealdade.', 'Não transforme cada ciclo em uma sequência de sacrifícios.'],
            ideology: ['Uma sociedade também precisa aproveitar a própria existência.', 'Não aceito que austeridade seja tratada como virtude universal.', 'Podemos discordar e ainda aproveitar a noite.'],
            comfort: ['Obrigada. Eu precisava de um pouco de atenção.', 'Até o esplendor fica mais bonito quando compartilhado.', 'Sua companhia foi um presente.']
        },
        reformer: {
            converse: ['Sempre há uma estrutura que pode ser melhorada.', 'Quero saber o que você mudaria na Corte.', 'Conversar é o primeiro passo para transformar algo.'],
            praise: ['É bom quando uma mudança é reconhecida.', 'Não busco aprovação, mas valorizo sua confiança.', 'Seu elogio fortalece minha determinação.'],
            listen: ['Às vezes, questionar a ordem tem um custo pessoal.', 'Nem todas as minhas ideias foram bem recebidas.', 'Obrigada por ouvir sem me pedir para recuar.'],
            joke: ['Uma revolução pode esperar alguns segundos por uma piada.', 'Essa foi boa. Precisamos de leveza também.', 'Não esperava rir nesta discussão.'],
            advice: ['Regras devem ser avaliadas pelas consequências.', 'Reforme antes que o sistema se torne irreparável.', 'Inclua quem costuma ser deixado de fora.'],
            ideology: ['A tradição não é justificativa suficiente.', 'Mudança sem responsabilidade também pode ferir.', 'Quero contestar sua ideia, não sua dignidade.'],
            comfort: ['É difícil sustentar mudanças sozinha.', 'Obrigada por me dar espaço para pensar.', 'Sua confiança me ajuda a persistir.']
        },
        manipulator: {
            converse: ['Toda conversa revela mais do que parece.', 'É interessante observar o que não foi dito.', 'Aprecio encontros que deixam possibilidades em aberto.'],
            praise: ['Você sabe reconhecer influência quando a encontra.', 'Um elogio bem colocado pode mudar um ciclo.', 'Agradeço. Vou lembrar dessa consideração.'],
            listen: ['Não costumo revelar minhas preocupações.', 'Até quem calcula as palavras precisa falar livremente.', 'Sua discrição será lembrada.'],
            joke: ['Uma boa surpresa é rara na Corte.', 'Você conseguiu escapar das minhas previsões.', 'Admito: foi divertido.'],
            advice: ['A influência costuma durar mais que a força.', 'Conquiste confiança antes de exigir obediência.', 'Observe alianças e interesses antes de agir.'],
            ideology: ['Toda doutrina também é uma ferramenta de poder.', 'Quem controla a narrativa influencia a decisão.', 'Sua posição é clara. Isso facilita a negociação.'],
            comfort: ['Não esperava esse gesto de sua parte.', 'Sua companhia pode ser mais valiosa do que demonstra.', 'Obrigada. Não confundirei isso com fraqueza.']
        },
        naturalist: {
            converse: ['Há muito a aprender observando o mundo sem interferir.', 'Gosto de conversas que não terminam em ordens.', 'A vida encontra caminhos inesperados.'],
            praise: ['É bom saber que você percebe o valor da preservação.', 'Seu reconhecimento me deixa contente.', 'Cuidar também exige dedicação.'],
            listen: ['Às vezes, parece que o Império esquece os limites do planeta.', 'Não quero que prosperidade signifique esgotamento.', 'Obrigada por ouvir minhas preocupações.'],
            joke: ['Até a natureza parece rir de nós às vezes.', 'Essa foi agradável. Obrigada.', 'Um pouco de leveza faz bem a qualquer ecossistema.'],
            advice: ['Preserve reservas e evite extração irreversível.', 'O planeta é parte da sociedade, não apenas seu recurso.', 'Cresça sem destruir a base que sustenta o crescimento.'],
            ideology: ['A vida não existe apenas para servir à Corte.', 'Progresso e preservação precisam coexistir.', 'Sua ideia merece ser confrontada com seus efeitos ambientais.'],
            comfort: ['Obrigada por compreender meu receio.', 'É bom não carregar essas preocupações sozinha.', 'Sua atenção me devolve alguma esperança.']
        }
    };

    function escapeSocial(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    function clamp(value, min = 0, max = 100) { return Math.max(min, Math.min(max, Number(value) || 0)); }
    function getDiamond(id) { return (state.matriarchs || []).find(item => item.id === id) || null; }

    function ensureSocialData() {
        if (!state.diamondSocial || typeof state.diamondSocial !== 'object') {
            state.diamondSocial = { selectedDiamondId: null, relations: {}, queue: [], history: [], elapsed: 0, uiAccumulator: 0 };
        }
        const social = state.diamondSocial;
        if (!social.relations || typeof social.relations !== 'object') social.relations = {};
        if (!Array.isArray(social.queue)) social.queue = [];
        if (!Array.isArray(social.history)) social.history = [];
        social.elapsed = Math.max(0, Number(social.elapsed) || 0);
        social.uiAccumulator = 0;
        (state.matriarchs || []).forEach(diamond => {
            const initialFriendship = Math.max(25, Math.min(55, Number(diamond.loyalty || 0) * 0.45));
            const relation = social.relations[diamond.id] || (social.relations[diamond.id] = {
                friendship: initialFriendship, trust: 38, respect: 55, tension: 0, interactions: 0
            });
            ['friendship', 'trust', 'respect', 'tension'].forEach(key => relation[key] = clamp(relation[key]));
            relation.interactions = Math.max(0, Math.floor(Number(relation.interactions) || 0));
            if (!diamond.socialMood || typeof diamond.socialMood !== 'object') diamond.socialMood = { type: 'neutral', label: 'Neutra', icon: '◇', remaining: 0 };
            diamond.socialMood.remaining = Math.max(0, Number(diamond.socialMood.remaining) || 0);
        });
        Object.keys(social.relations).forEach(id => { if (!getDiamond(id)) delete social.relations[id]; });
        social.queue = social.queue.filter(item => item && getDiamond(item.diamondId) && ACTIONS[item.actionId]).slice(0, 3);
        if (social.selectedDiamondId && !getDiamond(social.selectedDiamondId)) social.selectedDiamondId = null;
        if (!social.selectedDiamondId && state.matriarchs && state.matriarchs.length) social.selectedDiamondId = state.matriarchs[0].id;
        return social;
    }

    function getRelationshipLabel(relation) {
        if (relation.tension >= 55) return 'Relação tensa';
        if (relation.friendship >= 82 && relation.trust >= 75) return 'Confidente';
        if (relation.friendship >= 65 && relation.trust >= 55) return 'Aliada próxima';
        if (relation.friendship >= 45) return 'Boa convivência';
        if (relation.friendship >= 28) return 'Conhecidas';
        return 'Distantes';
    }

    function getMood(diamond) {
        const mood = diamond.socialMood || {};
        return Number(mood.remaining) > 0 ? mood : { type: 'neutral', label: 'Neutra', icon: '◇', remaining: 0 };
    }

    function setSocialMood(diamond, moodType) {
        const moods = {
            content: { label: 'Contente', icon: '✧', duration: 75 },
            pleased: { label: 'Reconhecida', icon: '♡', duration: 90 },
            soothed: { label: 'Acolhida', icon: '❀', duration: 100 },
            amused: { label: 'Divertida', icon: '☼', duration: 65 },
            inspired: { label: 'Inspirada', icon: '◇', duration: 90 },
            thoughtful: { label: 'Pensativa', icon: '⚖', duration: 75 },
            neutral: { label: 'Neutra', icon: '◇', duration: 0 }
        };
        const mood = moods[moodType] || moods.neutral;
        diamond.socialMood = { type: moodType, label: mood.label, icon: mood.icon, remaining: mood.duration };
    }

    function calculateOutcome(diamond, actionId) {
        const action = ACTIONS[actionId];
        const profile = diamond.personalityStats || {};
        const get = key => clamp(profile[key], 0, 100);
        const relation = ensureSocialData().relations[diamond.id];
        let friendship = action.friendship;
        let trust = action.trust;
        let respect = action.respect;
        let tension = action.tension;

        if (actionId === 'converse') friendship += get('sociability') * 0.025;
        if (actionId === 'praise') friendship += (get('sociability') + get('empathy')) * 0.012;
        if (actionId === 'listen' || actionId === 'comfort') {
            trust += get('empathy') * 0.035;
            tension -= get('empathy') * 0.02;
        }
        if (actionId === 'joke') {
            friendship += get('sociability') * 0.045;
            if (get('sociability') < 30) tension += 1.5;
        }
        if (actionId === 'advice') respect += get('research') * 0.025 + get('discipline') * 0.015;
        if (actionId === 'ideology') {
            const openness = get('empathy') * 0.5 + (100 - get('caution')) * 0.5;
            if (openness >= 65) { friendship += 2; trust += 1; tension -= 2; }
            else { tension += 3; respect += get('discipline') * 0.015; }
        }
        const responsePool = PERSONALITY_RESPONSES[diamond.personalityId] || PERSONALITY_RESPONSES.technocrat;
        const lines = responsePool[actionId] || responsePool.converse;
        const response = lines[Math.floor(Math.random() * lines.length)];
        return { friendship, trust, respect, tension, response, mood: action.mood, relation };
    }

    function completeSocialInteraction(item) {
        const diamond = getDiamond(item.diamondId);
        const relation = ensureSocialData().relations[item.diamondId];
        if (!diamond || !relation) return;
        const result = calculateOutcome(diamond, item.actionId);
        relation.friendship = clamp(relation.friendship + result.friendship);
        relation.trust = clamp(relation.trust + result.trust);
        relation.respect = clamp(relation.respect + result.respect);
        relation.tension = clamp(relation.tension + result.tension);
        relation.interactions++;
        diamond.loyalty = clamp(Number(diamond.loyalty || 0) + Math.max(0, result.friendship + result.trust) * 0.035);
        diamond.currentSpeech = result.response;
        setSocialMood(diamond, result.mood);
        const action = ACTIONS[item.actionId];
        const event = {
            cycle: Number(state.cycleCount) || 1, diamondId: diamond.id, diamondName: diamond.name,
            actionId: item.actionId, actionLabel: action.label, response: result.response,
            relationship: getRelationshipLabel(relation)
        };
        state.diamondSocial.history.unshift(event);
        if (state.diamondSocial.history.length > 30) state.diamondSocial.history.length = 30;
        if (typeof window.addChronicle === 'function') addChronicle(
            'Convívio com ' + diamond.name,
            state.firstDiamond.name + ' concluiu a interação "' + action.label + '". ' + result.response,
            getRelationshipLabel(relation)
        );
        if (typeof window.setStatusTicker === 'function') setStatusTicker(diamond.name + ': ' + result.response);
    }

    function selectSocialDiamond(id) {
        ensureSocialData();
        if (!getDiamond(id)) return;
        state.diamondSocial.selectedDiamondId = id;
        renderSocialTab(document.getElementById('drawer-body'));
    }

    function queueSocialInteraction(diamondId, actionId) {
        const social = ensureSocialData();
        const diamond = getDiamond(diamondId);
        const action = ACTIONS[actionId];
        if (!diamond || !action) return;
        if (social.queue.length >= 3) {
            if (typeof window.setStatusTicker === 'function') setStatusTicker('A fila de interações está cheia. Aguarde uma ação terminar.');
            return;
        }
        social.queue.push({
            id: 'social_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            diamondId, actionId, duration: action.duration, progress: 0
        });
        if (typeof window.setStatusTicker === 'function') setStatusTicker(action.label + ' adicionada à fila para ' + diamond.name + '.');
        renderSocialTab(document.getElementById('drawer-body'));
    }

    function removeSocialInteraction(index) {
        const social = ensureSocialData();
        if (!Number.isInteger(index) || index < 0 || index >= social.queue.length) return;
        const item = social.queue[index];
        if (index === 0 && Number(item.progress) > 0) {
            if (typeof window.setStatusTicker === 'function') setStatusTicker('Uma interação em andamento não pode ser cancelada.');
            return;
        }
        social.queue.splice(index, 1);
        renderSocialTab(document.getElementById('drawer-body'));
    }

    function updateDiamondSocial(dt) {
        const social = ensureSocialData();
        if (!state.firstGameStarted || !Number.isFinite(dt) || dt <= 0) return;
        social.elapsed += dt;
        (state.matriarchs || []).forEach(diamond => {
            if (diamond.socialMood && diamond.socialMood.remaining > 0) {
                diamond.socialMood.remaining = Math.max(0, diamond.socialMood.remaining - dt);
                if (diamond.socialMood.remaining === 0) diamond.socialMood = { type: 'neutral', label: 'Neutra', icon: '◇', remaining: 0 };
            }
        });
        if (social.queue.length) {
            const current = social.queue[0];
            current.progress = Math.min(100, Number(current.progress || 0) + dt * 100 / Math.max(1, Number(current.duration) || 5));
            if (current.progress >= 100) {
                completeSocialInteraction(current);
                social.queue.shift();
            }
        }
        social.uiAccumulator += dt;
        if (social.uiAccumulator >= 0.5) {
            social.uiAccumulator = 0;
            if (state.drawerOpen && state.drawerTab === 'social') renderSocialTab(document.getElementById('drawer-body'));
        }
    }

    function renderSocialTab(container) {
        if (!container) return;
        const social = ensureSocialData();
        if (!state.firstGameStarted) {
            container.innerHTML = '<div class="card"><b>Convívio das Diamantes</b><p>Inicie uma civilização para conhecer a Corte.</p></div>';
            return;
        }
        const diamonds = state.matriarchs || [];
        if (!diamonds.length) {
            container.innerHTML = '<div class="card card-amber"><div class="card-header"><span class="card-title title-font">♡ Relações da Corte</span><span class="badge">Sem subordinadas</span></div><p class="structure-desc">As interações sociais serão desbloqueadas quando uma nova Diamante emergir do núcleo de um planeta. A Primeira Diamante é sua personagem; as Matriarcas serão seus alvos de interação.</p></div>';
            return;
        }
        const selected = getDiamond(social.selectedDiamondId) || diamonds[0];
        const relation = social.relations[selected.id];
        const mood = getMood(selected);
        const queue = social.queue;
        const bond = getRelationshipLabel(relation);
        const list = diamonds.map(diamond => {
            const rel = social.relations[diamond.id];
            const currentMood = getMood(diamond);
            return '<button class="social-person' + (diamond.id === selected.id ? ' selected' : '') + '" type="button" onclick="selectSocialDiamond(\'' + escapeSocial(diamond.id) + '\')">' +
                '<span class="social-gem" style="--gem-color:' + escapeSocial(diamond.colorHex || '#c4b5fd') + '">◇</span><span class="social-person-meta"><b>' + escapeSocial(diamond.name) + '</b><small>' + escapeSocial(diamond.personalityName || 'Personalidade em formação') + '</small></span><span class="social-person-mood">' + escapeSocial(currentMood.icon) + '</span></button>';
        }).join('');
        const metric = (label, key, color) => '<div class="social-metric"><div><span>' + label + '</span><b>' + Math.round(relation[key]) + '%</b></div><div class="social-meter"><i style="width:' + relation[key] + '%;--metric-color:' + color + '"></i></div></div>';
        const actionButtons = Object.entries(ACTIONS).map(([id, action]) =>
            '<button class="social-action" type="button" onclick="queueSocialInteraction(\'' + selected.id + '\',\'' + id + '\')"' + (queue.length >= 3 ? ' disabled' : '') + '><span class="social-action-icon">' + action.icon + '</span><span><b>' + action.label + '</b><small>' + action.description + '</small></span><em>' + action.duration + 's</em></button>'
        ).join('');
        const active = queue.length ? queue[0] : null;
        const activeDiamond = active ? getDiamond(active.diamondId) : null;
        const queueHtml = queue.length ? queue.map((item, index) => {
            const target = getDiamond(item.diamondId);
            const action = ACTIONS[item.actionId];
            return '<div class="social-queue-item"><span><b>' + (index + 1) + '. ' + escapeSocial(target?.name || 'Diamante') + '</b><small>' + action.label + (index === 0 ? ' · Em andamento' : ' · Aguardando') + '</small></span>' +
                (index === 0 ? '<span class="social-progress-label">' + Math.floor(item.progress || 0) + '%</span>' : '<button class="btn" type="button" onclick="removeSocialInteraction(' + index + ')">Retirar</button>') +
                '</div>' + (index === 0 ? '<div class="social-progress"><i style="width:' + clamp(item.progress) + '%"></i></div>' : '');
        }).join('') : '<p class="social-muted">Nenhuma interação agendada. Escolha uma ação para iniciar.</p>';
        const history = social.history.filter(item => item.diamondId === selected.id).slice(0, 5).map(item =>
            '<div class="social-history-item"><small>Ciclo ' + item.cycle + ' · ' + escapeSocial(item.actionLabel) + '</small><p>“' + escapeSocial(item.response) + '”</p><b>' + escapeSocial(item.relationship) + '</b></div>'
        ).join('') || '<p class="social-muted">As conversas e encontros aparecerão aqui conforme o vínculo se desenvolver.</p>';

        container.innerHTML =
            '<div class="card card-amber"><div class="card-header"><span class="card-title title-font">♡ Convívio da Corte</span><span class="badge">' + diamonds.length + ' Diamante(s)</span></div>' +
            '<p class="structure-desc">Escolha uma Diamante e agende ações sociais. Cada interação leva alguns segundos de jogo; personalidade e temperamento alteram a resposta e o resultado do vínculo.</p>' +
            '<div class="social-people-list">' + list + '</div></div>' +
            '<div class="card social-profile"><div class="social-profile-head"><span class="social-gem social-gem-large" style="--gem-color:' + escapeSocial(selected.colorHex || '#c4b5fd') + '">◇</span><div><h3>' + escapeSocial(selected.name) + '</h3><p>' + escapeSocial(selected.personalityName || 'Personalidade em formação') + ' · ' + escapeSocial(bond) + '</p><small>' + escapeSocial(mood.icon + ' ' + mood.label) + (mood.remaining > 0 ? ' · ' + Math.ceil(mood.remaining) + 's' : '') + '</small></div></div>' +
            '<div class="social-metrics">' + metric('Amizade', 'friendship', '#f0abfc') + metric('Confiança', 'trust', '#7dd3fc') + metric('Respeito', 'respect', '#fcd34d') + metric('Tensão', 'tension', '#fb7185') + '</div>' +
            '<div class="social-speech">“' + escapeSocial(selected.currentSpeech || 'Aguardo um momento para conversar.') + '”</div></div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Interações disponíveis</span><span class="badge">' + queue.length + '/3 na fila</span></div><div class="social-actions">' + actionButtons + '</div></div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Fila de convivência</span></div>' + (active ? '<div class="social-muted">Em andamento: ' + escapeSocial(activeDiamond?.name || 'Diamante') + ' · ' + ACTIONS[active.actionId].label + '</div>' : '') + queueHtml + '</div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Memórias recentes</span></div>' + history + '</div>';
    }

    window.renderSocialTab = renderSocialTab;
    window.ensureDiamondSocialData = ensureSocialData;
    window.selectSocialDiamond = selectSocialDiamond;
    window.queueSocialInteraction = queueSocialInteraction;
    window.removeSocialInteraction = removeSocialInteraction;
    window.updateDiamondSocial = updateDiamondSocial;
})();