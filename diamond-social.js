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
        },
        past: { label: 'Falar sobre o passado', icon: '⌛', category: 'Assuntos', duration: 6, description: 'Perguntar sobre sua origem e experiências anteriores.', friendship: 2, trust: 3, respect: 1, tension: 0, mood: 'thoughtful' },
        ambition: { label: 'Discutir ambições', icon: '✦', category: 'Assuntos', duration: 6, description: 'Conhecer os objetivos pessoais dela para o Império.', friendship: 2, trust: 2, respect: 2, tension: 0, mood: 'inspired' },
        culture: { label: 'Conversar sobre cultura', icon: '♫', category: 'Assuntos', duration: 5, description: 'Falar sobre arte, costumes e a identidade Gem.', friendship: 3, trust: 1, respect: 1, tension: 0, mood: 'content' },
        colony: { label: 'Discutir as colônias', icon: '◎', category: 'Assuntos', duration: 7, description: 'Ouvir a visão dela sobre os mundos sob domínio imperial.', friendship: 1, trust: 2, respect: 3, tension: 1, mood: 'thoughtful' },
        secrets: { label: 'Compartilhar um segredo', icon: '☾', category: 'Assuntos', duration: 8, description: 'Compartilhar algo reservado para testar a confiança.', friendship: 1, trust: 5, respect: 1, tension: 0, mood: 'pleased' },
        reprimand: { label: 'Repreender', icon: '⚑', category: 'Disciplina', duration: 5, description: 'Advertir formalmente por uma conduta ou falha.', friendship: -3, trust: -2, respect: 1, tension: 5, mood: 'tense' },
        duty: { label: 'Impor serviço disciplinar', icon: '▤', category: 'Disciplina', duration: 8, description: 'Determinar uma tarefa adicional como sanção.', friendship: -5, trust: -4, respect: -1, tension: 9, mood: 'tense' },
        revoke: { label: 'Retirar privilégios', icon: '⌁', category: 'Disciplina', duration: 6, description: 'Suspender privilégios cortesãos temporariamente.', friendship: -7, trust: -6, respect: -3, tension: 12, mood: 'tense' },
        topic: { label: 'Conversa temática', icon: '◈', category: 'Conversa guiada', duration: 6, description: 'Conversar sobre um assunto escolhido.', friendship: 2, trust: 2, respect: 1, tension: 0, mood: 'thoughtful' },
        order: { label: 'Ordem imperial', icon: '♛', category: 'Ordens', duration: 5, description: 'Receber e executar uma determinação da Suprema.', friendship: 0, trust: -1, respect: 2, tension: 1, mood: 'thoughtful' }
    };
    const EXTRA_DIALOGUES = {
        past: ['Minha origem ainda influencia minhas escolhas.', 'Há lembranças que raramente compartilho na Corte.', 'Nem tudo que vivi aparece nos registros oficiais.'],
        ambition: ['Quero deixar uma marca que sobreviva a esta era.', 'Tenho objetivos que vão além do cargo que ocupo.', 'Espero que o Império se torne algo digno de ser lembrado.'],
        culture: ['A cultura revela o que uma civilização valoriza.', 'Precisamos preservar nossas expressões, não apenas nossos recursos.', 'Há beleza em descobrir costumes de outros mundos.'],
        colony: ['Cada colônia precisa de uma identidade própria.', 'A distância não deveria significar abandono.', 'O governo dos mundos exige mais do que ordens enviadas de Homeworld.'],
        secrets: ['Vou considerar este gesto antes de decidir o que revelar.', 'Poucas pessoas recebem esse nível de confiança.', 'Espero que suas palavras permaneçam entre nós.']
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

    function courtOwnerKey(diamond) { return diamond && diamond.id ? 'matriarch_' + diamond.id : 'first'; }
    function normalizeCourtOwner(value) {
        if (!value || value === 'firstDiamond' || value === 'first') return 'first';
        return String(value).startsWith('matriarch_') ? String(value) : 'matriarch_' + String(value);
    }
    function getGovernedPlanet(diamond) {
        if (!diamond) return null;
        return Object.values(PLANETS || {}).find(planet => planet.governor === 'matriarch_' + diamond.id) || null;
    }
    function ensureCourtData() {
        if (!state.diamondCourts || typeof state.diamondCourts !== 'object') state.diamondCourts = {};
        const data = state.diamondCourts;
        if (!data.courts || typeof data.courts !== 'object') data.courts = {};
        const owners = [{ id: 'first', name: state.firstDiamond?.name || 'Primeira Diamante' }, ...(state.matriarchs || []).map(d => ({ id: courtOwnerKey(d), name: d.name }))];
        owners.forEach(owner => {
            if (!data.courts[owner.id] || typeof data.courts[owner.id] !== 'object') data.courts[owner.id] = { name: owner.name, byType: {} };
            data.courts[owner.id].name = owner.name;
            if (!data.courts[owner.id].byType || typeof data.courts[owner.id].byType !== 'object') data.courts[owner.id].byType = {};
        });
        if (!data.initialized) {
            const observed = {};
            const countGem = gem => {
                if (!gem || typeof gem !== 'object') return;
                const type = gem.caste || gem.type;
                if (!type) return;
                const owner = normalizeCourtOwner(gem.ownerId);
                gem.ownerId = owner;
                if (!data.courts[owner]) data.courts[owner] = { name: owner === 'first' ? (state.firstDiamond?.name || 'Primeira Diamante') : (getDiamond(owner.replace('matriarch_', ''))?.name || 'Diamante'), byType: {} };
                const ledger = data.courts[owner].byType;
                ledger[type] = Math.max(0, Number(ledger[type]) || 0) + 1;
                observed[type] = (Number(observed[type]) || 0) + 1;
            };
            Object.values(PLANETS || {}).forEach(planet => {
                const governor = String(planet.governor || '');
                const inferredOwner = governor.startsWith('matriarch_') && getDiamond(governor.slice('matriarch_'.length)) ? governor : 'first';
                (planet.walkingGems || []).forEach(gem => {
                    if (gem && !gem.ownerId) gem.ownerId = inferredOwner;
                    countGem(gem);
                });
            });
            (state.gemTransfers || []).forEach(trip => countGem(trip.gem));
            const pearlInventory = state.founding?.reefPearlInventory || [];
            pearlInventory.forEach(pearl => {
                const owner = normalizeCourtOwner(pearl.ownerId || 'first');
                pearl.ownerId = owner;
                if (!data.courts[owner]) data.courts[owner] = { name: getDiamond(owner.replace('matriarch_', ''))?.name || state.firstDiamond?.name || 'Primeira Diamante', byType: {} };
                data.courts[owner].byType.pearl = (Number(data.courts[owner].byType.pearl) || 0) + 1;
                observed.pearl = (Number(observed.pearl) || 0) + 1;
            });
            (state.founding?.assignedPearls || []).forEach(pearl => {
                const owner = normalizeCourtOwner(pearl.ownerId || pearl.targetId || 'first');
                pearl.ownerId = owner;
                if (!data.courts[owner]) data.courts[owner] = { name: getDiamond(owner.replace('matriarch_', ''))?.name || state.firstDiamond?.name || 'Primeira Diamante', byType: {} };
                data.courts[owner].byType.pearl = (Number(data.courts[owner].byType.pearl) || 0) + 1;
                observed.pearl = (Number(observed.pearl) || 0) + 1;
            });
            Object.entries(state.census || {}).forEach(([type, total]) => {
                if (typeof FOUNDING_GEM_DATA !== 'undefined' && !FOUNDING_GEM_DATA[type]) return;
                const missing = Math.max(0, Math.floor(Number(total) || 0) - (Number(observed[type]) || 0));
                if (missing) data.courts.first.byType[type] = (Number(data.courts.first.byType[type]) || 0) + missing;
            });
            data.initialized = true;
        }
        (state.matriarchs || []).forEach(diamond => {
            if (!Number.isFinite(Number(diamond.courtProductionProgress))) diamond.courtProductionProgress = 0;
            if (diamond.courtProductionEnabled === undefined) diamond.courtProductionEnabled = true;
            if (!diamond.courtProductionType) diamond.courtProductionType = defaultProductionType(diamond);
            if (!Number.isFinite(Number(diamond.courtNextAttemptAt))) diamond.courtNextAttemptAt = 0;
        });
        return data;
    }
    function recordDiamondCourtGem(ownerId, type, quantity = 1) {
        const data = ensureCourtData();
        const owner = normalizeCourtOwner(ownerId);
        if (!data.courts[owner]) data.courts[owner] = { name: owner === 'first' ? (state.firstDiamond?.name || 'Primeira Diamante') : (getDiamond(owner.replace('matriarch_', ''))?.name || 'Diamante'), byType: {} };
        data.courts[owner].byType[type] = Math.max(0, Number(data.courts[owner].byType[type]) || 0) + Math.max(0, Math.floor(Number(quantity) || 0));
    }
    function getDiamondCourtReport() {
        const data = ensureCourtData();
        const owners = [{ id: 'first', name: state.firstDiamond?.name || 'Primeira Diamante', diamond: state.firstDiamond }, ...(state.matriarchs || []).map(d => ({ id: courtOwnerKey(d), name: d.name, diamond: d }))];
        return owners.map(owner => {
            const court = data.courts[owner.id] || { byType: {} };
            const byType = { ...(court.byType || {}) };
            const total = Object.values(byType).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
            return { id: owner.id, name: owner.name, byType, total, essence: Number(owner.diamond?.essence) || 0, productionEnabled: owner.diamond?.courtProductionEnabled !== false, productionType: owner.diamond?.courtProductionType || null, productionProgress: Number(owner.diamond?.courtProductionProgress) || 0, planet: owner.diamond ? getGovernedPlanet(owner.diamond)?.shortName || null : null };
        });
    }
    function defaultProductionType(diamond) {
        const office = diamond?.governance?.office;
        const choices = { defense: 'quartz', industry: 'bismuth', science: 'sapphire', diplomacy: 'peridot', administration: 'peridot', expansion: 'lapis' };
        return choices[office] || 'quartz';
    }
    function getProductionData(type) {
        if (typeof FOUNDING_GEM_DATA === 'undefined') return null;
        const data = FOUNDING_GEM_DATA[type];
        return data && !data.stored ? data : null;
    }
    function setDiamondCourtProduction(diamondId, type) {
        const diamond = getDiamond(diamondId);
        if (!diamond) return;
        const social = ensureSocialData();
        if (social.queue.some(item => item.diamondId === diamondId)) {
            setStatusTicker(diamond.name + ' está ocupada. Convoque-a antes de alterar suas ordens.');
            return;
        }
        if (!getProductionData(type)) return;
        diamond.courtProductionType = type;
        diamond.courtProductionEnabled = true;
        diamond.currentSpeech = 'Entendido. Minha corte priorizará a formação de ' + (FOUNDING_GEM_DATA[type]?.label || type) + ', desde que haja essência e minerais disponíveis.';
        setStatusTicker(diamond.name + ' recebeu uma ordem de produção: ' + (FOUNDING_GEM_DATA[type]?.label || type) + '.');
        renderSocialTab(document.getElementById('drawer-body'));
    }
    function updateMatriarchCourtProduction(dt) {
        if (!state.firstGameStarted || !Number.isFinite(dt) || dt <= 0) return;
        const data = ensureCourtData();
        (state.matriarchs || []).forEach(diamond => {
            if (diamond.courtProductionEnabled === false) return;
            diamond.courtProductionProgress = Math.min(60, (Number(diamond.courtProductionProgress) || 0) + dt);
            if (diamond.courtProductionProgress < 60 || (Number(state.diamondSocial?.elapsed) || 0) < (Number(diamond.courtNextAttemptAt) || 0)) return;
            diamond.courtNextAttemptAt = (Number(state.diamondSocial?.elapsed) || 0) + 5;
            const type = getProductionData(diamond.courtProductionType) ? diamond.courtProductionType : defaultProductionType(diamond);
            const gemData = getProductionData(type);
            const refinedMaterial = gemData?.refinedMaterial || null;
            const hasSubstrate = refinedMaterial
                ? Number(state.refinedResources?.[refinedMaterial] || 0) >= 1
                : Number(state.minerals || 0) >= 10;
            if (!gemData || Number(diamond.essence || 0) < 250 || !hasSubstrate) return;
            const planet = getGovernedPlanet(diamond) || PLANETS[diamond.consumedPlanet] || PLANETS.homeworld;
            if (!planet) return;
            diamond.essence = Math.max(0, Number(diamond.essence || 0) - 250);
            if (refinedMaterial) {
                state.refinedResources[refinedMaterial] = Math.max(0, Number(state.refinedResources[refinedMaterial] || 0) - 1);
            } else {
                state.minerals = Math.max(0, Number(state.minerals || 0) - 10);
            }
            if (!state.census[type]) state.census[type] = 0;
            state.census[type] += 1;
            if (type === 'quartz' && state.founding?.quartzVariantCounts) {
                const variant = typeof getQuartzVariantForPlanet === 'function' ? getQuartzVariantForPlanet(planet, 0) : null;
                if (variant) state.founding.quartzVariantCounts[variant] = (Number(state.founding.quartzVariantCounts[variant]) || 0) + 1;
                planet.walkingGems.push({ caste: type, variant, color: gemData.color, grade: 'A', ownerId: courtOwnerKey(diamond), bubbleText: '✦ Produzida pela corte de ' + diamond.name, angle: Math.random() * Math.PI * 2, dir: 1, speed: 0.0005, bobPhase: 0 });
            } else {
                planet.walkingGems.push({ caste: type, color: gemData.color, grade: 'A', ownerId: courtOwnerKey(diamond), bubbleText: '✦ Produzida pela corte de ' + diamond.name, angle: Math.random() * Math.PI * 2, dir: 1, speed: 0.0005, bobPhase: 0 });
            }
            recordDiamondCourtGem(courtOwnerKey(diamond), type, 1);
            diamond.courtProductionProgress = 0;
            diamond.currentSpeech = 'Minha corte concluiu a formação de uma ' + (gemData.label || type) + '. A essência e os minerais foram contabilizados.';
            addChronicle('Nova Gem na corte de ' + diamond.name, diamond.currentSpeech, '-250 essência · substrato compatível · +1 Gem');
            setStatusTicker(diamond.name + ' produziu uma nova Gem para sua corte: ' + (gemData.label || type) + '.');
            if (state.drawerOpen && state.drawerTab === 'population') renderDrawerContent();
        });
    }


    function ensureSocialData() {
        if (!state.diamondSocial || typeof state.diamondSocial !== 'object') {
            state.diamondSocial = { selectedDiamondId: null, relations: {}, queue: [], history: [], elapsed: 0, uiAccumulator: 0 };
        }
        const social = state.diamondSocial;
        if (!social.relations || typeof social.relations !== 'object') social.relations = {};
        if (!Array.isArray(social.queue)) social.queue = [];
        if (!Array.isArray(social.history)) social.history = [];
        if (typeof window.ensureDiamondGovernanceData === 'function') window.ensureDiamondGovernanceData();
        social.elapsed = Math.max(0, Number(social.elapsed) || 0);
        social.uiAccumulator = Math.max(0, Number(social.uiAccumulator) || 0);
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
            tense: { label: 'Tensa', icon: '!', duration: 85 },
            neutral: { label: 'Neutra', icon: '◇', duration: 0 }
        };
        const mood = moods[moodType] || moods.neutral;
        diamond.socialMood = { type: moodType, label: mood.label, icon: mood.icon, remaining: mood.duration };
    }


    function getAvailableTopics(diamond) {
        const topics = [
            { id: 'empire', label: 'Situação atual do Império', icon: '✧' },
            { id: 'court', label: 'Sua corte e suas Gems', icon: '◇' },
            { id: 'ambitions', label: 'Planos e ambições', icon: '✦' },
            { id: 'doctrine', label: 'Doutrina e autoridade', icon: '⚖' }
        ];
        if (Number(state.era || 0) > 0 || Number(state.ideologyAxis || 0) !== 0) topics.push({ id: 'culture', label: 'Cultura e tradição Gem', icon: '♫' });
        const planet = getGovernedPlanet(diamond);
        if (planet) topics.push({ id: 'colony', label: 'Sua colônia', icon: '◎' });
        if (Number(diamond.essence || 0) > 0 || diamond.courtProductionEnabled !== false) topics.push({ id: 'production', label: 'Produção da corte', icon: '✥' });
        if (Number(state.tech || 0) > 0 || Object.keys(state.researchedTechs || {}).length || Number(state.structures?.research_center || 0) > 0) topics.push({ id: 'science', label: 'Ciência e tecnologia', icon: '⌬' });
        if (Number(state.census?.hessonite || 0) + Number(state.census?.pyrope || 0) + Number(state.census?.ruby || 0) > 0 || Number(state.structures?.defense_tower || 0) > 0 || Number(state.structures?.shield_generator || 0) > 0 || Object.values(PLANETS || {}).some(p => p.rebellionActive)) topics.push({ id: 'defense', label: 'Defesa e segurança', icon: '⚔' });
        if ((Array.isArray(diamond.personalHistory) && diamond.personalHistory.length) || diamond.originStory) topics.push({ id: 'past', label: 'Recordar seu passado', icon: '⌛' });
        return topics;
    }
    function buildTopicResponse(diamond, topicId) {
        const court = getDiamondCourtReport().find(item => item.id === courtOwnerKey(diamond));
        const planet = getGovernedPlanet(diamond);
        const colonized = Object.values(PLANETS || {}).filter(p => p.colonized);
        const totalGems = Object.values(state.census || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
        const themes = {
            empire: 'Neste momento, o Império possui ' + colonized.length + ' mundo(s) colonizado(s), ' + totalGems.toLocaleString('pt-BR') + ' Gems, ' + Math.floor(Number(state.minerals) || 0).toLocaleString('pt-BR') + ' minerais e ' + Math.floor(Number(state.tech) || 0).toLocaleString('pt-BR') + ' de tecnologia. A ordem imperial está em ' + Math.round(Number(state.order) || 0) + '%.',
            court: 'Minha corte reúne ' + (court?.total || 0) + ' Gems. Essência pessoal disponível: ' + Math.floor(Number(diamond.essence) || 0) + '. Minha corte ' + (diamond.courtProductionEnabled === false ? 'está com a produção suspensa.' : 'está autorizada a produzir ' + (FOUNDING_GEM_DATA[diamond.courtProductionType]?.label || diamond.courtProductionType || 'Gems') + ' quando houver recursos.'),
            ambitions: 'Quero que minhas decisões deixem uma marca real no Império. Minha personalidade influencia o que considero prioridade, mas também quero que a Suprema saiba o que espero do meu futuro.',
            doctrine: 'A doutrina atual é ' + String(state.firstDiamond?.doctrine || 'não definida') + '. O eixo ideológico está em ' + Math.round(Number(state.ideologyAxis) || 0) + '. A autoridade da Suprema continua acima de qualquer cargo matriarcal.',
            culture: 'A identidade pública do Império está ligada à doutrina ' + String(state.firstDiamond?.doctrine || 'ainda não definida') + ' e ao eixo ideológico atual de ' + Math.round(Number(state.ideologyAxis) || 0) + '. Ainda não há um sistema cultural separado de tradições, eventos e costumes; não vou inventar costumes que o jogo ainda não registrou.',
            colony: planet ? 'Estou responsável por ' + planet.shortName + '. A dissidência está em ' + Math.round(Number(planet.dissent) || 0) + '%, a população Gem local é de ' + (planet.walkingGems || []).length + ' e o estado da rebelião é ' + (planet.rebellionActive ? 'ativo' : 'inativo') + '.' : '',
            production: 'Minha produção está ' + (diamond.courtProductionEnabled === false ? 'suspensa' : 'ativa') + '. Prioridade atual: ' + (FOUNDING_GEM_DATA[diamond.courtProductionType]?.label || diamond.courtProductionType || 'a definir') + '. Tenho ' + Math.floor(Number(diamond.essence) || 0) + ' de essência e o progresso do próximo ciclo está em ' + Math.floor(Number(diamond.courtProductionProgress) || 0) + '%.',
            science: 'O Império acumula ' + Math.floor(Number(state.tech) || 0) + ' pontos de tecnologia. Existem ' + Object.keys(state.researchedTechs || {}).length + ' tecnologias registradas como pesquisadas.',
            defense: 'O Império possui ' + Math.floor(Number(state.census?.hessonite) || 0) + ' Hessonitas, ' + Math.floor(Number(state.census?.pyrope) || 0) + ' Piropos e ' + Math.floor(Number(state.census?.ruby) || 0) + ' Rubis. ' + Object.values(PLANETS || {}).filter(p => p.rebellionActive).length + ' planeta(s) estão em rebelião.'
        };
        if (topicId === 'past') {
            const history = Array.isArray(diamond.personalHistory) ? diamond.personalHistory : [];
            return 'Há uma lembrança registrada em minha história: ' + String(diamond.originStory || history[0] || 'uma experiência pessoal registrada') + '.';
        }
        const factual = themes[topicId] || themes.empire;
        const pool = (PERSONALITY_RESPONSES[diamond.personalityId] || PERSONALITY_RESPONSES.technocrat).converse;
        const lead = pool[Math.floor(Math.random() * pool.length)];
        return lead + ' ' + factual;
    }
    function getAvailableReprimandReasons(diamond) {
        const reasons = [];
        const planet = getGovernedPlanet(diamond);
        if (planet && Number(planet.dissent || 0) >= 10) reasons.push({ id: 'dissent', label: 'Dissidência elevada em ' + planet.shortName + ' (' + Math.round(planet.dissent) + '%)' });
        if (planet?.rebellionActive) reasons.push({ id: 'rebellion', label: 'Rebelião ativa em ' + planet.shortName });
        reasons.push({ id: 'conduct', label: 'Conduta incompatível com o cargo' });
        return reasons;
    }
    function buildDiamondReport(diamond) {
        const court = getDiamondCourtReport().find(item => item.id === courtOwnerKey(diamond));
        const planet = getGovernedPlanet(diamond);
        const assignments = [];
        Object.entries(state.structureAssignments || {}).forEach(([structure, jobs]) => {
            const structureName = (typeof STRUCTURE_CATALOG !== 'undefined' ? STRUCTURE_CATALOG.find(def => def.id === structure)?.name : null) || structure;
            Object.entries(jobs || {}).forEach(([type, qty]) => {
                if (Number(qty) > 0) {
                    const casteName = (typeof FOUNDING_GEM_DATA !== 'undefined' ? FOUNDING_GEM_DATA[type]?.label : null) || type;
                    assignments.push(structureName + ': ' + casteName + ' ' + Number(qty));
                }
            });
        });
        const jobs = (state.constructionQueue || []).filter(job => job && job.active && (!planet || (job.planetId || 'homeworld') === planet.id));
        if (!jobs.length && state.construction?.active && (!planet || (state.construction.planetId || 'homeworld') === planet.id)) jobs.push(state.construction);
        const pending = (state.diamondGovernance?.decisions || []).filter(item => item.diamondId === diamond.id && item.status === 'pending');
        const chamber = (state.diamondChambers || []).find(item => item.ownerId === diamond.id);
        const fleet = (state.shipFleet || []).filter(ship => ship.ownerId === diamond.id);
        const recentOrders = (diamond.socialOrderLog || []).slice(0, 5);
        const essence = state.essence || {};
        const resources = 'Minerais ' + Math.floor(Number(state.minerals) || 0) + ' · Tecnologia ' + Math.floor(Number(state.tech) || 0) + ' · Energia ' + Math.floor(Number(state.energy) || 0) + ' · Materiais refinados ' + Math.floor(Number(state.refinedMaterials) || 0);
        const essenceSummary = 'Branca ' + Math.floor(Number(essence.white) || 0) + ' · Amarela ' + Math.floor(Number(essence.yellow) || 0) + ' · Azul ' + Math.floor(Number(essence.blue) || 0) + ' · Rosa ' + Math.floor(Number(essence.pink) || 0);
        const colonies = Object.values(PLANETS || {}).filter(item => item.colonized).map(item => item.shortName).join(', ') || 'nenhuma';
        const localPopulation = planet ? (planet.walkingGems || []).length : 0;
        const lines = [
            'Corte: ' + (court?.total || 0) + ' Gems' + (court?.byType ? ' (' + Object.entries(court.byType).filter(([,n]) => Number(n) > 0).map(([type,n]) => type + ' ' + n).join(', ') + ')' : ''),
            'Essência pessoal: ' + Math.floor(Number(diamond.essence) || 0),
            'Recursos imperiais: ' + resources,
            'Essências imperiais: ' + essenceSummary,
            'Mundos colonizados: ' + colonies,
            'Gems na superfície da colônia governada: ' + (planet ? localPopulation : 'sem colônia designada'),
            'Produção: ' + (diamond.courtProductionEnabled === false ? 'suspensa' : 'ativa') + ' · foco: ' + (FOUNDING_GEM_DATA[diamond.courtProductionType]?.label || diamond.courtProductionType || 'automático'),
            'Cargo: ' + ({ administration: 'Administração geral', industry: 'Indústria e produção', science: 'Ciência e pesquisa', defense: 'Defesa e segurança', diplomacy: 'Diplomacia e estabilidade', expansion: 'Expansão imperial' }[diamond.governance?.office] || 'sem cargo') + ' · autoridade: ' + ({ supervised: 'Supervisionada', delegated: 'Delegada', autonomous: 'Autônoma' }[diamond.governance?.authority] || 'Supervisionada'),
            'Governança: ' + (planet ? planet.shortName + ' · dissidência ' + Math.round(Number(planet.dissent) || 0) + '% · rebelião ' + (planet.rebellionActive ? 'ativa' : 'inativa') : 'nenhuma colônia designada'),
            'Equipes designadas no Império (contagem por casta, não por indivíduo; o jogo ainda não identifica cada trabalhadora): ' + (assignments.join('; ') || 'nenhuma atribuição registrada'),
            'Construções ativas: ' + (jobs.map(job => (job.name || job.id || 'Obra') + ' ' + Math.floor(Number(job.progress) || 0) + '%').join('; ') || 'nenhuma obra ativa identificada'),
            'Propostas aguardando decisão: ' + (pending.map(item => item.title).join('; ') || 'nenhuma'),
            'Ordens recentes: ' + (recentOrders.map(order => 'Ciclo ' + order.cycle + ' · ' + order.label + ' — ' + order.result).join('; ') || 'nenhuma ordem registrada'),
            'Naves sob sua propriedade: ' + (fleet.map(ship => ship.name || ship.type).join(', ') || 'nenhuma'),
            'Câmara de essência: ' + (chamber ? (chamber.active ? 'banho em andamento (' + Math.floor(chamber.progress || 0) + '%)' : chamber.cooldown > 0 ? 'recuperação (' + Math.ceil(chamber.cooldown) + 's)' : 'disponível') : 'sem câmara própria')
        ];
        return lines;
    }
    function requestDiamondReport(diamondId) {
        const social = ensureSocialData();
        const diamond = getDiamond(diamondId);
        if (!diamond) return;
        if (social.queue.some(item => item.diamondId === diamondId)) {
            setStatusTicker(diamond.name + ' está ocupada. Convoque-a antes de exigir o relatório.');
            return;
        }
        diamond.socialReport = buildDiamondReport(diamond);
        diamond.currentSpeech = 'Relatório atualizado. Apresentei os dados atuais da minha corte, governança e atividades registradas.';
        social.history.unshift({ cycle: Number(state.cycleCount) || 1, diamondId, diamondName: diamond.name, actionId: 'report', actionLabel: 'Relatório exigido', response: diamond.currentSpeech, detail: diamond.socialReport.join(' · '), relationship: getRelationshipLabel(social.relations[diamondId]) });
        social.history = social.history.slice(0, 30);
        setStatusTicker(diamond.name + ' apresentou o relatório solicitado.');
        renderSocialTab(document.getElementById('drawer-body'));
    }
    function issueDiamondOrder(diamondId, orderType, gemType) {
        const payload = { type: orderType, gemType: gemType || null, value: gemType || null };
        queueSocialInteraction(diamondId, 'order', payload);
    }
    function calculateOutcome(diamond, actionId, item) {
        const action = ACTIONS[actionId];
        const profile = diamond.personalityStats || {};
        const get = key => clamp(profile[key], 0, 100);
        const relation = ensureSocialData().relations[diamond.id];
        let friendship = action.friendship;
        let trust = action.trust;
        let respect = action.respect;
        let tension = action.tension;
        let mood = action.mood;

        if (actionId === 'converse' || actionId === 'culture') friendship += get('sociability') * 0.025;
        if (actionId === 'past' || actionId === 'secrets') trust += get('empathy') * 0.025;
        if (actionId === 'ambition') respect += get('ambition') * 0.025;
        if (actionId === 'colony') respect += get('discipline') * 0.02;
        if (['reprimand', 'duty', 'revoke'].includes(actionId)) {
            tension += (100 - get('discipline')) * 0.035 + get('ambition') * 0.015;
            if (get('discipline') >= 75) respect += 2;
            if (get('empathy') >= 75) trust -= 2;
            mood = 'tense';
        }
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
            else { tension += 3; respect += get('discipline') * 0.015; mood = 'tense'; }
        }
        const responsePool = PERSONALITY_RESPONSES[diamond.personalityId] || PERSONALITY_RESPONSES.technocrat;
        const lines = responsePool[actionId] || EXTRA_DIALOGUES[actionId] || (['reprimand','duty','revoke'].includes(actionId) ? ['Compreendo a sanção, mas não esquecerei a forma como foi aplicada.', 'A autoridade foi exercida. Minha confiança, porém, foi abalada.', 'Cumprirei a determinação, embora discorde dela.'] : responsePool.converse);
        let response = lines[Math.floor(Math.random() * lines.length)];
        if (actionId === 'topic') response = buildTopicResponse(diamond, item?.topicId);
        if (actionId === 'reprimand' || actionId === 'duty' || actionId === 'revoke') {
            response = 'Entendi a advertência. Motivo registrado: ' + String(item?.reasonLabel || 'conduta').trim() + '. ' + response;
        }
        return { friendship, trust, respect, tension, response, mood, relation };
    }

    function completeSocialInteraction(item) {
        const diamond = getDiamond(item.diamondId);
        const relation = ensureSocialData().relations[item.diamondId];
        if (!diamond || !relation) return;
        let result = calculateOutcome(diamond, item.actionId, item);
        let orderRecordLabel = '';
        if (item.actionId === 'order') {
            const order = item.order || {};
            if (order.type === 'proposal') {
                const before = (state.diamondGovernance?.decisions || []).length;
                if (typeof window.requestDiamondGovernanceDecision === 'function') window.requestDiamondGovernanceDecision(diamond.id);
                const after = (state.diamondGovernance?.decisions || []).length;
                result.response = after > before ? 'A proposta administrativa foi preparada e aguarda a aprovação da Suprema.' : (diamond.currentSpeech || 'Não encontrei uma medida viável com as condições atuais.');
                orderRecordLabel = 'Solicitou um plano administrativo';
                result.respect += 1;
            } else if (order.type === 'production') {
                const type = getProductionData(order.gemType) ? order.gemType : defaultProductionType(diamond);
                diamond.courtProductionType = type;
                diamond.courtProductionEnabled = true;
                orderRecordLabel = 'Produção priorizada: ' + (FOUNDING_GEM_DATA[type]?.label || type);
                result.response = 'Ordem recebida. Minha corte priorizará ' + (FOUNDING_GEM_DATA[type]?.label || type) + ', condicionada à essência e aos minerais disponíveis.';
            } else if (order.type === 'pause') {
                diamond.courtProductionEnabled = false;
                orderRecordLabel = 'Suspendeu a produção da corte';
                result.response = 'Suspenderei temporariamente a produção de Gems da minha corte.';
            } else if (order.type === 'resume') {
                diamond.courtProductionEnabled = true;
                orderRecordLabel = 'Retomou a produção da corte';
                result.response = 'Retomarei a produção independente assim que houver essência e minerais suficientes.';
            } else if (order.type === 'authority') {
                const authorityLabels = { supervised: 'Supervisionada', delegated: 'Delegada', autonomous: 'Autônoma' };
                if (authorityLabels[order.value] && typeof window.setDiamondAuthority === 'function') {
                    window.setDiamondAuthority(diamond.id, order.value);
                    orderRecordLabel = 'Nível de autoridade alterado para ' + authorityLabels[order.value];
                    result.response = 'Entendido. Meu nível de autoridade foi alterado para ' + authorityLabels[order.value] + '.';
                } else result.response = 'A ordem de autoridade não foi reconhecida.';
            } else if (order.type === 'office') {
                const officeLabels = { administration: 'Administração geral', industry: 'Indústria e produção', science: 'Ciência e pesquisa', defense: 'Defesa e segurança', diplomacy: 'Diplomacia e estabilidade', expansion: 'Expansão imperial' };
                if (officeLabels[order.value] && typeof window.setDiamondOffice === 'function') {
                    window.setDiamondOffice(diamond.id, order.value);
                    orderRecordLabel = 'Cargo alterado para ' + officeLabels[order.value];
                    result.response = 'Aceito a designação para ' + officeLabels[order.value] + '.';
                } else result.response = 'O cargo solicitado não foi reconhecido.';
            } else if (order.type === 'assign' || order.type === 'release') {
                const parts = String(order.value || '').split('|');
                const structureId = parts[0], gemType = parts[1];
                const before = Number(state.structureAssignments?.[structureId]?.[gemType]) || 0;
                if (order.type === 'assign' && typeof window.assignGemToStructure === 'function') window.assignGemToStructure(structureId, gemType);
                if (order.type === 'release' && typeof window.unassignGemFromStructure === 'function') window.unassignGemFromStructure(structureId, gemType);
                const after = Number(state.structureAssignments?.[structureId]?.[gemType]) || 0;
                const structureName = (typeof STRUCTURE_CATALOG !== 'undefined' ? STRUCTURE_CATALOG.find(def => def.id === structureId)?.name : null) || structureId;
                const casteName = FOUNDING_GEM_DATA[gemType]?.label || gemType;
                result.response = after !== before
                    ? 'Ordem executada: uma ' + casteName + (order.type === 'assign' ? ' foi designada para ' : ' foi liberada de ') + structureName + '.'
                    : 'Não foi possível alterar essa equipe: verifique vagas, operadores necessários e Gems disponíveis.';
                orderRecordLabel = after !== before
                    ? (order.type === 'assign' ? 'Designou uma ' : 'Liberou uma ') + casteName + (order.type === 'assign' ? ' para ' : ' de ') + structureName
                    : 'Ordem não executada: equipe sem vaga ou sem Gems livres';
            }
        }
        if (item.actionId === 'order') {
            if (!Array.isArray(diamond.socialOrderLog)) diamond.socialOrderLog = [];
            diamond.socialOrderLog.unshift({ cycle: Number(state.cycleCount) || 1, label: orderRecordLabel || 'Ordem imperial', result: result.response, successful: !String(result.response).startsWith('Não foi possível') });
            if (diamond.socialOrderLog.length > 20) diamond.socialOrderLog.length = 20;
        }
        relation.friendship = clamp(relation.friendship + result.friendship);
        relation.trust = clamp(relation.trust + result.trust);
        relation.respect = clamp(relation.respect + result.respect);
        relation.tension = clamp(relation.tension + result.tension);
        relation.interactions++;
        diamond.loyalty = clamp(Number(diamond.loyalty || 0) + (result.friendship + result.trust) * 0.035);
        if (item.actionId === 'duty') diamond.loyalty = clamp(Number(diamond.loyalty || 0) - 1.5);
        if (item.actionId === 'revoke') diamond.loyalty = clamp(Number(diamond.loyalty || 0) - 2.5);
        diamond.currentSpeech = result.response;
        if (item.reasonLabel) {
            result.response = result.response;
            diamond.lastReprimandReason = item.reasonLabel;
        }
        setSocialMood(diamond, result.mood);
        const action = ACTIONS[item.actionId];
        const event = {
            cycle: Number(state.cycleCount) || 1, diamondId: diamond.id, diamondName: diamond.name,
            actionId: item.actionId, actionLabel: action.label, response: result.response, detail: item.reasonLabel || item.topicLabel || orderRecordLabel || (item.order?.type || ''),
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

    function queueSocialInteraction(diamondId, actionId, payload) {
        const social = ensureSocialData();
        const diamond = getDiamond(diamondId);
        const action = ACTIONS[actionId];
        if (!diamond || !action) return;
        if (actionId === 'topic') {
            const topic = getAvailableTopics(diamond).find(item => item.id === payload);
            if (!topic) { setStatusTicker('Este assunto não está disponível no contexto atual.'); return; }
            payload = { topicId: topic.id, topicLabel: topic.label };
        }
        if (['reprimand','duty','revoke'].includes(actionId)) {
            const config = payload && typeof payload === 'object' ? payload : { reasonId: payload };
            const reason = getAvailableReprimandReasons(diamond).find(item => item.id === config.reasonId) || getAvailableReprimandReasons(diamond)[0];
            const custom = String(config.customReason || '').trim().slice(0, 140);
            payload = { reasonId: reason.id, reasonLabel: custom ? reason.label + ': ' + custom : reason.label };
        }
        if (social.queue.some(item => item.diamondId === diamondId)) {
            if (typeof window.setStatusTicker === 'function') setStatusTicker(diamond.name + ' já está ocupada. Convoque-a para interromper a atividade.');
            return;
        }
        if (social.queue.length >= 3) {
            if (typeof window.setStatusTicker === 'function') setStatusTicker('A fila de interações está cheia. Aguarde uma ação terminar.');
            return;
        }
        social.queue.push({
            id: 'social_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            diamondId, actionId, duration: action.duration, progress: 0,
            ...(actionId === 'topic' ? { topicId: payload.topicId, topicLabel: payload.topicLabel } : {}),
            ...(actionId === 'order' ? { order: payload } : {}),
            ...(['reprimand','duty','revoke'].includes(actionId) ? { reasonId: payload.reasonId, reasonLabel: payload.reasonLabel } : {})
        });
        if (typeof window.setStatusTicker === 'function') setStatusTicker(action.label + ' adicionada à fila para ' + diamond.name + '.');
        renderSocialTab(document.getElementById('drawer-body'));
    }

    function summonDiamond(diamondId) {
        const social = ensureSocialData();
        const diamond = getDiamond(diamondId);
        if (!diamond) return;
        const interrupted = social.queue.filter(item => item.diamondId === diamondId);
        if (interrupted.length) {
            social.queue = social.queue.filter(item => item.diamondId !== diamondId);
            const stats = diamond.personalityStats || {};
            const discipline = clamp(stats.discipline, 0, 100);
            const ambition = clamp(stats.ambition, 0, 100);
            const relation = social.relations[diamondId];
            relation.tension = clamp(relation.tension + 2 + (100 - discipline) * 0.045 + ambition * 0.025);
            relation.trust = clamp(relation.trust - (discipline < 35 ? 3 : 1));
            relation.respect = clamp(relation.respect + (discipline >= 70 ? 1 : -1));
            diamond.loyalty = clamp(Number(diamond.loyalty || 0) - (discipline < 35 ? 1.5 : 0.4));
            diamond.currentSpeech = discipline >= 75 ? 'Recebi sua convocação, Suprema. Interrompi minhas obrigações e estou à disposição.' : 'Fui obrigada a interromper meu trabalho. Espero que este chamado seja necessário.';
            setSocialMood(diamond, discipline < 35 ? 'tense' : 'thoughtful');
            social.history.unshift({ cycle: Number(state.cycleCount) || 1, diamondId, diamondName: diamond.name, actionId: 'summon', actionLabel: 'Convocação imperial', response: diamond.currentSpeech, relationship: getRelationshipLabel(relation) });
        } else {
            diamond.currentSpeech = 'Atendi à convocação da Suprema.';
        }
        social.selectedDiamondId = diamondId;
        if (typeof window.setStatusTicker === 'function') setStatusTicker(diamond.name + ' foi convocada à presença da Suprema.');
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
        const actionGroups = ['Social', 'Afeto', 'Apoio', 'Conversa profunda'];
        const actionButtons = actionGroups.map(category => {
            const buttons = Object.entries(ACTIONS).filter(([id, action]) => action.category === category && !['past','ambition','culture','colony','secrets'].includes(id) && !['reprimand','duty','revoke'].includes(id)).map(([id, action]) => {
                const comfortLocked = id === 'comfort' && relation.tension < 5 && Number(selected.loyalty || 0) >= 80 && mood.type !== 'tense';
                const diamondBusy = queue.some(item => item.diamondId === selected.id);
                const disabled = queue.length >= 3 || comfortLocked || diamondBusy;
                const description = diamondBusy ? 'Diamante ocupada; convoque-a para interromper a ação.' : (comfortLocked ? 'Disponível quando ela demonstrar tensão ou precisar de apoio.' : action.description);
                return '<button class="social-action" type="button" onclick="queueSocialInteraction(\'' + selected.id + '\',\'' + id + '\')"' + (disabled ? ' disabled' : '') + '><span class="social-action-icon">' + action.icon + '</span><span><b>' + action.label + '</b><small>' + description + '</small></span><em>' + action.duration + 's</em></button>';
            }).join('');
            return buttons ? '<section class="social-action-group"><h4>' + category + '</h4>' + buttons + '</section>' : '';
        }).join('');

        const topics = getAvailableTopics(selected);
        const topicHtml = topics.map(topic => '<button class="social-action" type="button" onclick="queueSocialInteraction(\'' + escapeSocial(selected.id) + '\',\'topic\',\'' + topic.id + '\')" ' + (queue.some(item => item.diamondId === selected.id) || queue.length >= 3 ? 'disabled' : '') + '><span class="social-action-icon">' + topic.icon + '</span><span><b>' + escapeSocial(topic.label) + '</b><small>Resposta baseada nos dados atuais do Império e da corte</small></span></button>').join('');
        const reasons = getAvailableReprimandReasons(selected);
        const reasonOptions = reasons.map(reason => '<option value="' + reason.id + '">' + escapeSocial(reason.label) + '</option>').join('');
        const productionOptions = typeof FOUNDING_GEM_DATA !== 'undefined' ? Object.entries(FOUNDING_GEM_DATA).filter(([type, data]) => !data.stored && data.mineral).map(([type, data]) => '<option value="' + type + '" ' + (selected.courtProductionType === type ? 'selected' : '') + '>' + escapeSocial(data.label) + '</option>').join('') : '<option value="quartz">Quartzo</option>';
        const assignmentOptions = [];
        const releaseOptions = [];
        if (typeof STRUCTURE_CATALOG !== 'undefined') STRUCTURE_CATALOG.forEach(def => {
            if (typeof structureCount !== 'function' || structureCount(def.id) < 1 || !def.workers) return;
            Object.entries(def.workers).forEach(([type, required]) => {
                const assigned = Number(state.structureAssignments?.[def.id]?.[type]) || 0;
                const limit = def.id === 'mineral_extractor' && type === 'quartz' ? Math.max(1, Number(state.census.quartz) || 0) : def.id === 'essence_chamber' && type === 'peridot' ? structureCount('essence_chamber') : Number(required) || 1;
                const structureName = def.name || def.id;
                const casteName = FOUNDING_GEM_DATA[type]?.label || type;
                if (assigned < limit && (typeof freeGemWorkers !== 'function' || freeGemWorkers(type) > 0)) assignmentOptions.push({ value: def.id + '|' + type, label: structureName + ' ← ' + casteName });
                if (assigned > 0) releaseOptions.push({ value: def.id + '|' + type, label: structureName + ' ← ' + casteName + ' (' + assigned + ')' });
            });
        });
        const assignmentSelect = assignmentOptions.map(item => '<option value="' + item.value + '">' + escapeSocial(item.label) + '</option>').join('');
        const releaseSelect = releaseOptions.map(item => '<option value="' + item.value + '">' + escapeSocial(item.label) + '</option>').join('');
        const busy = queue.some(item => item.diamondId === selected.id);
        const canPropose = !!getGovernedPlanet(selected);
        const reportHtml = Array.isArray(selected.socialReport) ? '<div class="card"><div class="card-header"><span class="card-title">Relatório solicitado</span><span class="badge">Dados atuais</span></div>' + selected.socialReport.map(line => '<p class="social-muted">' + escapeSocial(line) + '</p>').join('') + '</div>' : '';
        const disciplineHtml = '<div class="card"><div class="card-header"><span class="card-title">Disciplina e sanções</span></div><label class="stat-label" for="social-reprimand-reason">Motivo da repreensão</label><select id="social-reprimand-reason">' + reasonOptions + '</select><input id="social-custom-reason" type="text" maxlength="140" placeholder="Detalhe opcional do motivo" /><div class="grid-2">' +
            '<button class="btn btn-pink" type="button" onclick="queueSocialInteraction(\'' + escapeSocial(selected.id) + '\',\'reprimand\',{reasonId:document.getElementById(\'social-reprimand-reason\').value,customReason:document.getElementById(\'social-custom-reason\').value})" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>Repreender</button>' +
            '<button class="btn btn-pink" type="button" onclick="queueSocialInteraction(\'' + escapeSocial(selected.id) + '\',\'duty\',{reasonId:document.getElementById(\'social-reprimand-reason\').value,customReason:document.getElementById(\'social-custom-reason\').value})" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>Serviço disciplinar</button></div>' +
            '<button class="btn btn-pink" type="button" onclick="queueSocialInteraction(\'' + escapeSocial(selected.id) + '\',\'revoke\',{reasonId:document.getElementById(\'social-reprimand-reason\').value,customReason:document.getElementById(\'social-custom-reason\').value})" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>Retirar privilégios</button></div>';
        const orderHtml = '<div class="card"><div class="card-header"><span class="card-title">Ordens da Suprema</span><span class="badge">Autoridade imperial</span></div>' +
            '<button class="social-action" type="button" onclick="requestDiamondReport(\'' + escapeSocial(selected.id) + '\')" ' + (busy ? 'disabled' : '') + '><span class="social-action-icon">▤</span><span><b>Exigir relatório</b><small>Atividades, governança, equipes, recursos e corte</small></span></button>' +
            '<button class="social-action" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'proposal\')" ' + (busy || queue.length >= 3 || !canPropose ? 'disabled' : '') + '><span class="social-action-icon">⚖</span><span><b>Apresentar plano administrativo</b><small>' + (canPropose ? 'Preparar uma proposta real para sua colônia governada' : 'Disponível quando houver uma colônia sob sua governança') + '</small></span></button>' +
            '<label class="stat-label" for="social-production-type">Casta que sua corte deve produzir</label><select id="social-production-type">' + productionOptions + '</select>' +
            '<button class="social-action" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'production\',document.getElementById(\'social-production-type\').value)" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '><span class="social-action-icon">✥</span><span><b>Ordenar foco de produção</b><small>Consome 250 de essência pessoal e o substrato correspondente à casta para gerar Gems em sua corte</small></span></button>' +
            '<button class="btn" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'' + (selected.courtProductionEnabled === false ? 'resume' : 'pause') + '\')" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>' + (selected.courtProductionEnabled === false ? 'Retomar produção autônoma' : 'Suspender produção autônoma') + '</button>' +
            '<label class="stat-label" for="social-order-authority">Nível de autoridade</label><select id="social-order-authority"><option value="supervised">Supervisionada</option><option value="delegated">Delegada</option><option value="autonomous">Autônoma</option></select><button class="btn" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'authority\',document.getElementById(\'social-order-authority\').value)" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>Ordenar alteração de autoridade</button>' +
            '<label class="stat-label" for="social-order-office">Cargo imperial</label><select id="social-order-office"><option value="administration">Administração geral</option><option value="industry">Indústria e produção</option><option value="science">Ciência e pesquisa</option><option value="defense">Defesa e segurança</option><option value="diplomacy">Diplomacia e estabilidade</option><option value="expansion">Expansão imperial</option></select><button class="btn" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'office\',document.getElementById(\'social-order-office\').value)" ' + (busy || queue.length >= 3 ? 'disabled' : '') + '>Ordenar novo cargo</button>' +
            '<label class="stat-label" for="social-order-assignment">Designar Gem a uma estrutura</label><select id="social-order-assignment">' + (assignmentSelect || '<option value="">Nenhuma vaga disponível</option>') + '</select><button class="btn" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'assign\',document.getElementById(\'social-order-assignment\').value)" ' + (busy || queue.length >= 3 || !assignmentOptions.length ? 'disabled' : '') + '>Ordenar designação</button>' +
            '<label class="stat-label" for="social-order-release">Liberar Gem de uma estrutura</label><select id="social-order-release">' + (releaseSelect || '<option value="">Nenhuma equipe designada</option>') + '</select><button class="btn" type="button" onclick="issueDiamondOrder(\'' + escapeSocial(selected.id) + '\',\'release\',document.getElementById(\'social-order-release\').value)" ' + (busy || queue.length >= 3 || !releaseOptions.length ? 'disabled' : '') + '>Ordenar liberação</button></div>';
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
            '<div class="social-history-item"><small>Ciclo ' + item.cycle + ' · ' + escapeSocial(item.actionLabel) + '</small>' + (item.detail ? '<small class="social-muted">Contexto: ' + escapeSocial(item.detail) + '</small>' : '') + '<p>“' + escapeSocial(item.response) + '”</p><b>' + escapeSocial(item.relationship) + '</b></div>'
        ).join('') || '<p class="social-muted">As conversas e encontros aparecerão aqui conforme o vínculo se desenvolver.</p>';

        container.innerHTML =
            '<div class="card card-amber"><div class="card-header"><span class="card-title title-font">♡ Convívio da Corte</span><span class="badge">' + diamonds.length + ' Diamante(s)</span></div>' +
            '<p class="structure-desc">Escolha uma Diamante e agende ações sociais. Cada interação leva alguns segundos de jogo; personalidade e temperamento alteram a resposta e o resultado do vínculo.</p>' +
            '<div class="social-people-list">' + list + '</div></div>' +
            '<div class="card social-profile"><div class="social-profile-head"><span class="social-gem social-gem-large" style="--gem-color:' + escapeSocial(selected.colorHex || '#c4b5fd') + '">◇</span><div><h3>' + escapeSocial(selected.name) + '</h3><p>' + escapeSocial(selected.personalityName || 'Personalidade em formação') + ' · ' + escapeSocial(bond) + '</p><small>' + escapeSocial(mood.icon + ' ' + mood.label) + (mood.remaining > 0 ? ' · ' + Math.ceil(mood.remaining) + 's' : '') + '</small></div></div>' +
            '<div class="social-metrics">' + metric('Amizade', 'friendship', '#f0abfc') + metric('Confiança', 'trust', '#7dd3fc') + metric('Respeito', 'respect', '#fcd34d') + metric('Tensão', 'tension', '#fb7185') + '</div>' +
            '<div class="social-speech">“' + escapeSocial(selected.currentSpeech || 'Aguardo um momento para conversar.') + '”</div></div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Autoridade da Suprema</span></div><p class="social-muted">A convocação interrompe qualquer atividade desta Diamante. A reação depende da personalidade, da disciplina e do vínculo atual.</p><button class="social-action" type="button" onclick="summonDiamond(\'' + escapeSocial(selected.id) + '\')"><span class="social-action-icon">♛</span><span><b>Exigir presença imediata</b><small>Interromper trabalho e convocá-la à Corte</small></span></button></div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Assuntos de conversa</span></div><div class="social-actions">' + topicHtml + '</div></div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Interações disponíveis</span><span class="badge">' + queue.length + '/3 na fila</span></div><div class="social-actions">' + actionButtons + '</div></div>' +
            disciplineHtml + orderHtml + reportHtml +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Fila de convivência</span></div>' + (active ? '<div class="social-muted">Em andamento: ' + escapeSocial(activeDiamond?.name || 'Diamante') + ' · ' + ACTIONS[active.actionId].label + '</div>' : '') + queueHtml + '</div>' +
            '<div class="card"><div class="card-header"><span class="card-title title-font">Memórias recentes</span></div>' + history + '</div>';
    }

    window.renderSocialTab = renderSocialTab;
    window.ensureDiamondSocialData = ensureSocialData;
    window.selectSocialDiamond = selectSocialDiamond;
    window.queueSocialInteraction = queueSocialInteraction;
    window.removeSocialInteraction = removeSocialInteraction;
    window.summonDiamond = summonDiamond;
    window.getDiamondCourtReport = getDiamondCourtReport;
    window.recordDiamondCourtGem = recordDiamondCourtGem;
    window.requestDiamondReport = requestDiamondReport;
    window.setDiamondCourtProduction = setDiamondCourtProduction;
    window.issueDiamondOrder = issueDiamondOrder;
    window.updateMatriarchCourtProduction = updateMatriarchCourtProduction;
    window.updateDiamondSocial = updateDiamondSocial;
})();