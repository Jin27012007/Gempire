/* Gempire · Governança das Diamantes
 * Personalidade, cargos, delegação e decisões persistentes.
 * Sem serviços externos: todas as propostas e consequências são locais.
 */
(function () {
    const PROFILES = {
        militarist: { ambition: 94, discipline: 92, empathy: 20, caution: 34, research: 36, sociability: 42 },
        melancholic: { ambition: 38, discipline: 72, empathy: 78, caution: 86, research: 58, sociability: 76 },
        empathic: { ambition: 44, discipline: 48, empathy: 96, caution: 50, research: 54, sociability: 88 },
        technocrat: { ambition: 56, discipline: 94, empathy: 24, caution: 78, research: 98, sociability: 32 },
        visionary: { ambition: 92, discipline: 58, empathy: 66, caution: 28, research: 82, sociability: 64 },
        isolationist: { ambition: 42, discipline: 82, empathy: 34, caution: 96, research: 48, sociability: 22 },
        artist: { ambition: 52, discipline: 54, empathy: 74, caution: 44, research: 62, sociability: 82 },
        scholar: { ambition: 50, discipline: 78, empathy: 62, caution: 76, research: 100, sociability: 54 },
        hedonist: { ambition: 72, discipline: 32, empathy: 62, caution: 26, research: 34, sociability: 94 },
        reformer: { ambition: 82, discipline: 50, empathy: 92, caution: 38, research: 78, sociability: 72 },
        manipulator: { ambition: 92, discipline: 84, empathy: 28, caution: 66, research: 72, sociability: 94 },
        naturalist: { ambition: 36, discipline: 70, empathy: 96, caution: 94, research: 72, sociability: 58 }
    };
    const OFFICES = {
        administration: { label: 'Administração geral', desc: 'Equilibra recursos, estabilidade e necessidades da colônia.' },
        industry: { label: 'Indústria e produção', desc: 'Prioriza investimentos produtivos e reservas minerais.' },
        science: { label: 'Ciência e pesquisa', desc: 'Prioriza tecnologia e eficiência científica.' },
        defense: { label: 'Defesa e segurança', desc: 'Prioriza controle territorial e redução de ameaças.' },
        diplomacy: { label: 'Diplomacia e estabilidade', desc: 'Prioriza ordem, lealdade e redução de dissidência.' },
        expansion: { label: 'Expansão imperial', desc: 'Procura oportunidades de colonização e crescimento.' }
    };
    const AUTHORITIES = {
        supervised: { label: 'Supervisionada', desc: 'Apresenta planos; a Primeira Diamante autoriza cada execução.' },
        delegated: { label: 'Delegada', desc: 'Executa tarefas rotineiras de baixo custo; investimentos e expansão exigem aprovação.' },
        autonomous: { label: 'Autônoma', desc: 'Executa também investimentos rotineiros dentro do orçamento; decisões estratégicas continuam sob aprovação.' }
    };
    const PRIORITIES = {
        balanced: 'Equilíbrio imperial',
        industry: 'Produção e indústria',
        science: 'Pesquisa e tecnologia',
        stability: 'Estabilidade das colônias',
        expansion: 'Expansão territorial'
    };
    const DECISION_LABELS = {
        stabilize: 'Programa de estabilização',
        research: 'Investimento científico',
        industry: 'Ampliação industrial',
        expansion: 'Nova colonização'
    };

    function ensureGovernanceData() {
        if (typeof state === 'undefined' || typeof PLANETS === 'undefined') return null;
        if (!state.diamondGovernance || typeof state.diamondGovernance !== 'object') {
            state.diamondGovernance = { decisions: [], sequence: 0, autoAccumulator: 0, imperialPriority: 'balanced' };
        }
        const gov = state.diamondGovernance;
        if (!Array.isArray(gov.decisions)) gov.decisions = [];
        if (!Number.isFinite(Number(gov.sequence))) gov.sequence = 0;
        if (!Number.isFinite(Number(gov.autoAccumulator))) gov.autoAccumulator = 0;
        if (!PRIORITIES[gov.imperialPriority]) gov.imperialPriority = 'balanced';

        (state.matriarchs || []).forEach(diamond => {
            const profile = PROFILES[diamond.personalityId] || PROFILES.technocrat;
            if (!diamond.personalityStats || typeof diamond.personalityStats !== 'object') {
                diamond.personalityStats = { ...profile };
            } else {
                Object.keys(profile).forEach(key => {
                    const value = Number(diamond.personalityStats[key]);
                    diamond.personalityStats[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : profile[key];
                });
            }
            if (!diamond.governance || typeof diamond.governance !== 'object') diamond.governance = {};
            const admin = diamond.governance;
            if (!OFFICES[admin.office]) {
                const officeDefaults = {
                    militarist: 'defense', melancholic: 'diplomacy', empathic: 'diplomacy',
                    technocrat: 'science', visionary: 'expansion', isolationist: 'defense',
                    artist: 'administration', scholar: 'science', hedonist: 'industry',
                    reformer: 'diplomacy', manipulator: 'administration', naturalist: 'diplomacy'
                };
                admin.office = officeDefaults[diamond.personalityId] || 'administration';
            }
            if (!AUTHORITIES[admin.authority]) admin.authority = 'supervised';
            if (!Number.isFinite(Number(admin.lastDecisionCycle))) admin.lastDecisionCycle = -999;
            if (!Number.isFinite(Number(admin.budget))) admin.budget = 35;
            if (!admin.planetId) {
                const governed = Object.values(PLANETS).find(planet => planet.governor === 'matriarch_' + diamond.id);
                if (governed) admin.planetId = governed.id;
            }
        });
        return gov;
    }

    function getDiamond(id) {
        return (state.matriarchs || []).find(diamond => diamond.id === id) || null;
    }

    function getAssignedPlanet(diamond) {
        if (!diamond) return null;
        const governed = Object.values(PLANETS).find(planet => planet.governor === 'matriarch_' + diamond.id);
        if (governed) {
            diamond.governance.planetId = governed.id;
            return governed;
        }
        const preferred = PLANETS[diamond.governance.planetId];
        return preferred && preferred.colonized && preferred.governor === 'matriarch_' + diamond.id ? preferred : null;
    }

    function updateGovernanceUI(message) {
        if (message && typeof window.setStatusTicker === 'function') setStatusTicker(message);
        if (typeof window.updateHUD === 'function') updateHUD();
        if (typeof window.renderDrawerContent === 'function' && state.drawerTab === 'governance') renderDrawerContent();
    }

    function setDiamondOffice(diamondId, office) {
        ensureGovernanceData();
        const diamond = getDiamond(diamondId);
        if (!diamond || !OFFICES[office]) return;
        diamond.governance.office = office;
        updateGovernanceUI(diamond.name + ' assumiu o cargo de ' + OFFICES[office].label + '.');
    }

    function setDiamondAuthority(diamondId, authority) {
        ensureGovernanceData();
        const diamond = getDiamond(diamondId);
        if (!diamond || !AUTHORITIES[authority]) return;
        diamond.governance.authority = authority;
        updateGovernanceUI('Autoridade de ' + diamond.name + ': ' + AUTHORITIES[authority].label + '.');
    }

    function setDiamondColony(diamondId, planetId) {
        ensureGovernanceData();
        const diamond = getDiamond(diamondId);
        const planet = PLANETS[planetId];
        if (!diamond || (planetId && (!planet || !planet.colonized))) return;
        Object.values(PLANETS).forEach(item => {
            if (item.governor === 'matriarch_' + diamond.id) item.governor = 'none';
        });
        if (planetId) {
            const previousGovernor = String(planet.governor || '');
            if (previousGovernor.startsWith('matriarch_')) {
                const previous = getDiamond(previousGovernor.slice('matriarch_'.length));
                if (previous) previous.governance.planetId = null;
            }
            planet.governor = 'matriarch_' + diamond.id;
            diamond.governance.planetId = planet.id;
        } else {
            diamond.governance.planetId = null;
        }
        updateGovernanceUI(planetId
            ? diamond.name + ' foi designada para governar ' + planet.shortName + '.'
            : diamond.name + ' foi retirada da governança colonial.');
        if (typeof window.addChronicle === 'function') addChronicle(
            'Governança de Diamante atualizada',
            diamond.name + (planetId ? ' assumiu a administração de ' + planet.shortName + '.' : ' deixou sua colônia sem governadora.'),
            'Autoridade colonial alterada'
        );
    }

    function personalityScore(diamond, key) {
        return Math.max(0, Math.min(100, Number(diamond.personalityStats && diamond.personalityStats[key]) || 0));
    }

    function buildDecision(diamond) {
        const planet = getAssignedPlanet(diamond);
        if (!planet) return null;
        const traits = diamond.personalityStats;
        const priority = state.diamondGovernance.imperialPriority;
        const options = [];
        const add = (type, score, data) => options.push({ type, score: score + (priority === typePriority(type) ? 24 : 0), ...data });
        const typePriority = type => ({ industry: 'industry', research: 'science', stabilize: 'stability', expansion: 'expansion' }[type] || 'balanced');

        if (!planet.rebellionActive && Number(planet.dissent || 0) >= 6 && Number(state.essence.blue || 0) >= 15) {
            add('stabilize', personalityScore(diamond, 'empathy') * 0.48 + personalityScore(diamond, 'caution') * 0.26 +
                (diamond.governance.office === 'diplomacy' ? 36 : diamond.governance.office === 'defense' ? 18 : 0), {
                title: 'Reduzir a tensão em ' + planet.shortName,
                detail: 'Aplicar um programa de conciliação e contenção para reduzir a dissidência local.',
                cost: { blue: 15 }, costLabel: '15 Essência Azul',
                effectLabel: 'Dissidência −18 pontos; Ordem Imperial +1,5.',
                risk: 'routine', planetId: planet.id
            });
        }
        if (Number(state.minerals || 0) >= 25) {
            add('research', personalityScore(diamond, 'research') * 0.54 + personalityScore(diamond, 'discipline') * 0.14 +
                (diamond.governance.office === 'science' ? 42 : 0), {
                title: 'Financiar pesquisa em ' + planet.shortName,
                detail: 'Destinar matéria-prima a um programa de pesquisa supervisionado pela governadora.',
                cost: { minerals: 25 }, costLabel: '25 Minerais',
                effectLabel: 'Tecnologia +15; bônus científico colonial permanente de +4%.',
                risk: 'routine', planetId: planet.id
            });
        }
        if (Number(state.minerals || 0) >= 35 && Number(planet.governanceIndustryLevel || 0) < 3) {
            add('industry', personalityScore(diamond, 'ambition') * 0.28 + personalityScore(diamond, 'discipline') * 0.32 +
                (diamond.governance.office === 'industry' ? 48 : 0), {
                title: 'Ampliar a indústria de ' + planet.shortName,
                detail: 'Construir uma cadeia de produção administrativa apoiada pela população e infraestrutura existentes.',
                cost: { minerals: 35 }, costLabel: '35 Minerais',
                effectLabel: 'Nível industrial +1; gera +0,12 Minerais por segundo enquanto a colônia existir.',
                risk: 'routine', planetId: planet.id
            });
        }
        const target = Object.values(PLANETS).find(candidate => {
            if (candidate.colonized) return false;
            const cost = candidate.unlockCost || {};
            return Number(state.minerals || 0) >= Number(cost.minerals || 0) &&
                Number(state.essence.white || 0) >= Number(cost.white || 0);
        });
        if (target) {
            add('expansion', personalityScore(diamond, 'ambition') * 0.44 + personalityScore(diamond, 'curiosity') * 0.12 +
                (diamond.governance.office === 'expansion' ? 52 : 0), {
                title: 'Propor colonização de ' + target.shortName,
                detail: 'Incorporar um novo mundo ao Império e estabelecer uma administração sob responsabilidade desta Diamante.',
                cost: { minerals: Number(target.unlockCost.minerals || 0), white: Number(target.unlockCost.white || 0) },
                costLabel: (Number(target.unlockCost.minerals || 0)) + ' Minerais · ' + (Number(target.unlockCost.white || 0)) + ' Essência Branca',
                effectLabel: 'Nova colônia incorporada; esta Diamante assume a governança.',
                risk: 'strategic', planetId: planet.id, targetPlanetId: target.id
            });
        }
        if (!options.length) return null;
        options.sort((a, b) => b.score - a.score);
        const selected = options[0];
        const profilePool = typeof DIAMOND_PERSONALITY_POOL !== 'undefined' ? DIAMOND_PERSONALITY_POOL : [];
        const profileQuotes = profilePool.find(item => item.id === diamond.personalityId)?.quotes || [];
        if (profileQuotes.length) diamond.currentSpeech = profileQuotes[(Number(diamond.governance.lastDecisionCycle) + state.cycleCount) % profileQuotes.length];
        state.diamondGovernance.sequence++;
        const id = 'gov_' + state.diamondGovernance.sequence + '_' + String(diamond.id).replace(/[^a-zA-Z0-9_-]/g, '');
        return {
            id, diamondId: diamond.id, diamondName: diamond.name, cycle: Number(state.cycleCount) || 1,
            createdAt: Date.now(), status: 'pending', type: selected.type, title: selected.title,
            detail: selected.detail, cost: selected.cost, costLabel: selected.costLabel,
            effectLabel: selected.effectLabel, risk: selected.risk, planetId: selected.planetId,
            targetPlanetId: selected.targetPlanetId || null,
            office: diamond.governance.office
        };
    }

    function requestDiamondGovernanceDecision(diamondId) {
        const gov = ensureGovernanceData();
        const diamond = getDiamond(diamondId);
        if (!diamond) return;
        if (gov.decisions.some(decision => decision.diamondId === diamondId && decision.status === 'pending')) {
            updateGovernanceUI(diamond.name + ' já possui uma decisão aguardando a Corte.');
            return;
        }
        const decision = buildDecision(diamond);
        if (!decision) {
            updateGovernanceUI(getAssignedPlanet(diamond)
                ? 'Não há uma medida viável agora: verifique recursos, dissidência e níveis de investimento.'
                : 'Designe primeiro uma colônia para ' + diamond.name + '.');
            return;
        }
        gov.decisions.unshift(decision);
        diamond.governance.lastDecisionCycle = Number(state.cycleCount) || 1;
        updateGovernanceUI(diamond.name + ' apresentou uma proposta: ' + decision.title + '.');
    }

    function canAffordDecision(decision) {
        const cost = decision.cost || {};
        return Number(state.minerals || 0) >= Number(cost.minerals || 0) &&
            Number(state.tech || 0) >= Number(cost.tech || 0) &&
            Number(state.essence.blue || 0) >= Number(cost.blue || 0) &&
            Number(state.essence.white || 0) >= Number(cost.white || 0);
    }

    function executeDiamondGovernanceDecision(decisionId, automatic) {
        const gov = ensureGovernanceData();
        const decision = gov.decisions.find(item => item.id === decisionId && item.status === 'pending');
        if (!decision) return false;
        const diamond = getDiamond(decision.diamondId);
        const planet = PLANETS[decision.planetId];
        if (!diamond || !planet || !planet.colonized || !canAffordDecision(decision)) {
            updateGovernanceUI('A proposta não pode ser executada: a colônia ou os recursos mudaram desde sua apresentação.');
            return false;
        }
        const cost = decision.cost || {};
        state.minerals -= Number(cost.minerals || 0);
        state.tech -= Number(cost.tech || 0);
        state.essence.blue -= Number(cost.blue || 0);
        state.essence.white -= Number(cost.white || 0);

        if (decision.type === 'stabilize') {
            planet.dissent = Math.max(0, Number(planet.dissent || 0) - 18);
            state.order = Math.min(100, Number(state.order || 0) + 1.5);
        } else if (decision.type === 'research') {
            state.tech += 15;
            planet.governanceResearchBonus = Math.min(0.20, Number(planet.governanceResearchBonus || 0) + 0.04);
        } else if (decision.type === 'industry') {
            planet.governanceIndustryLevel = Math.min(3, Number(planet.governanceIndustryLevel || 0) + 1);
        } else if (decision.type === 'expansion') {
            const target = PLANETS[decision.targetPlanetId];
            if (!target || target.colonized || Number(state.minerals || 0) + Number(cost.minerals || 0) < Number(cost.minerals || 0)) {
                state.minerals += Number(cost.minerals || 0);
                state.essence.white += Number(cost.white || 0);
                updateGovernanceUI('A colonização não foi executada: o mundo de destino já não está disponível.');
                return false;
            }
            target.colonized = true;
            target.governor = 'matriarch_' + diamond.id;
            target.walkingGems = Array.isArray(target.walkingGems) ? target.walkingGems : [];
            target.governanceIndustryLevel = Number(target.governanceIndustryLevel) || 0;
            diamond.governance.planetId = target.id;
        }

        decision.status = automatic ? 'executed_auto' : 'approved';
        decision.resolvedCycle = Number(state.cycleCount) || 1;
        diamond.loyalty = Math.min(100, Number(diamond.loyalty || 0) + (automatic ? 0.5 : 2));
        diamond.currentSpeech = decision.type === 'expansion'
            ? 'A nova fronteira está sob nossa responsabilidade. Não decepcionarei a Corte.'
            : 'A medida foi executada. Os resultados serão registrados nos próximos ciclos.';
        if (typeof window.addChronicle === 'function') addChronicle(
            (automatic ? 'Decisão autônoma: ' : 'Decisão aprovada: ') + decision.title,
            diamond.name + ' executou a medida em ' + (decision.type === 'expansion' ? (PLANETS[decision.targetPlanetId]?.shortName || 'novo mundo') : planet.shortName) + '.',
            decision.effectLabel
        );
        updateGovernanceUI((automatic ? 'Decisão rotineira executada por ' : 'A Corte aprovou a proposta de ') + diamond.name + ': ' + decision.title + '.');
        return true;
    }

    function approveDiamondDecision(decisionId) {
        executeDiamondGovernanceDecision(decisionId, false);
    }

    function rejectDiamondDecision(decisionId) {
        const gov = ensureGovernanceData();
        const decision = gov.decisions.find(item => item.id === decisionId && item.status === 'pending');
        if (!decision) return;
        const diamond = getDiamond(decision.diamondId);
        decision.status = 'rejected';
        decision.resolvedCycle = Number(state.cycleCount) || 1;
        if (diamond) {
            diamond.loyalty = Math.max(0, Number(diamond.loyalty || 0) - 1);
            diamond.currentSpeech = 'A Corte rejeitou minha proposta. Registrarei a decisão, embora discorde dela.';
        }
        if (typeof window.addChronicle === 'function') addChronicle(
            'Proposta rejeitada: ' + decision.title,
            'A Primeira Diamante rejeitou uma medida apresentada por ' + (diamond?.name || decision.diamondName) + '.',
            'Proposta não executada'
        );
        updateGovernanceUI('Proposta rejeitada. Nenhum recurso foi consumido.');
    }

    function setImperialPriority(priority) {
        const gov = ensureGovernanceData();
        if (!PRIORITIES[priority]) return;
        gov.imperialPriority = priority;
        updateGovernanceUI('Diretriz imperial atualizada: ' + PRIORITIES[priority] + '. As próximas recomendações considerarão essa prioridade.');
        if (typeof window.addChronicle === 'function') addChronicle(
            'Diretriz imperial alterada',
            'A Primeira Diamante definiu a prioridade central como ' + PRIORITIES[priority] + '.',
            'Orientação estratégica da Corte'
        );
    }

    function updateDiamondGovernance(dt) {
        const gov = ensureGovernanceData();
        if (!gov || !state.firstGameStarted || !Number.isFinite(dt) || dt <= 0) return;

        // Especializações geram efeitos modestos e persistentes na colônia governada.
        Object.values(PLANETS).forEach(planet => {
            if (!planet.colonized) return;
            const level = Math.max(0, Number(planet.governanceIndustryLevel) || 0);
            if (level) state.minerals = Math.max(0, Number(state.minerals || 0) + level * 0.12 * dt);
            const rulerId = String(planet.governor || '').startsWith('matriarch_')
                ? String(planet.governor).slice('matriarch_'.length) : null;
            const ruler = rulerId ? getDiamond(rulerId) : null;
            if (!ruler) return;
            const office = ruler.governance.office;
            if (office === 'industry') state.minerals += 0.035 * dt;
            if (office === 'science') state.tech += 0.025 * dt;
            if (office === 'diplomacy') planet.dissent = Math.max(0, Number(planet.dissent || 0) - 0.025 * dt);
            if (office === 'defense') planet.dissent = Math.max(0, Number(planet.dissent || 0) - 0.012 * dt);
            const researchBonus = Math.max(0, Number(planet.governanceResearchBonus) || 0);
            if (researchBonus) state.tech += researchBonus * 0.025 * dt;
        });

        gov.autoAccumulator += dt;
        if (gov.autoAccumulator < 60) return;
        gov.autoAccumulator %= 60;
        (state.matriarchs || []).forEach(diamond => {
            const authority = diamond.governance.authority;
            if (authority === 'supervised' || !getAssignedPlanet(diamond)) return;
            if (gov.decisions.some(item => item.diamondId === diamond.id && item.status === 'pending')) return;
            const decision = buildDecision(diamond);
            if (!decision) return;
            gov.decisions.unshift(decision);
            diamond.governance.lastDecisionCycle = Number(state.cycleCount) || 1;
            const mineralCost = Number(decision.cost?.minerals || 0);
            const routineLimit = authority === 'autonomous' ? 60 : 25;
            if (decision.risk === 'routine' && mineralCost <= routineLimit && canAffordDecision(decision)) {
                executeDiamondGovernanceDecision(decision.id, true);
            } else if (state.drawerTab === 'governance' && state.drawerOpen) {
                renderGovernanceTab(document.getElementById('drawer-body'));
                if (typeof window.setStatusTicker === 'function') setStatusTicker(diamond.name + ' apresentou uma decisão que aguarda a autorização imperial.');
            }
            if (gov.decisions.length > 40) gov.decisions.length = 40;
        });
    }

    function renderGovernanceTab(container) {
        ensureGovernanceData();
        if (!container) return;
        if (!state.firstGameStarted) {
            container.innerHTML = '<div class="card"><b>Conselho de Governança</b><p>Inicie uma civilização para formar a Corte e designar as Diamantes.</p></div>';
            return;
        }
        const colonized = Object.values(PLANETS).filter(planet => planet.colonized);
        const priorityOptions = Object.entries(PRIORITIES).map(([key, label]) =>
            '<option value="' + key + '" ' + (state.diamondGovernance.imperialPriority === key ? 'selected' : '') + '>' + label + '</option>'
        ).join('');
        let html = '<div class="card card-amber"><div class="card-header"><span class="card-title title-font">🏛 Conselho de Governança Imperial</span><span class="badge">' + (state.matriarchs || []).length + ' Matriarca(s)</span></div>' +
            '<p class="structure-desc">A Primeira Diamante mantém a autoridade máxima. As Matriarcas administram colônias dentro de limites definidos; propostas estratégicas continuam sob aprovação imperial.</p>' +
            '<label class="stat-label" for="imperial-governance-priority">Diretriz central do Império</label><select id="imperial-governance-priority" onchange="setImperialPriority(this.value)">' + priorityOptions + '</select>' +
            '<div class="founding-note">A diretriz orienta quais propostas recebem prioridade. Não altera retroativamente decisões já aprovadas.</div></div>';
        if (!(state.matriarchs || []).length) {
            html += '<div class="card"><b>Nenhuma Matriarca subordinada</b><p class="structure-desc">Forje uma nova Diamante na aba Dinastia. Sua personalidade definirá tendências, mas cargos e autoridade poderão ser alterados pela Corte.</p></div>';
        }
        (state.matriarchs || []).forEach(diamond => {
            const admin = diamond.governance, planet = getAssignedPlanet(diamond);
            const stats = [
                ['Ambição', 'ambition'], ['Disciplina', 'discipline'], ['Empatia', 'empathy'],
                ['Cautela', 'caution'], ['Pesquisa', 'research'], ['Sociabilidade', 'sociability']
            ];
            const traitHtml = stats.map(([label, key]) =>
                '<div class="governance-trait"><div><span>' + label + '</span><b>' + personalityScore(diamond, key) + '</b></div><div class="governance-meter"><i style="width:' + personalityScore(diamond, key) + '%"></i></div></div>'
            ).join('');
            const officeOptions = Object.entries(OFFICES).map(([key, item]) =>
                '<option value="' + key + '" ' + (admin.office === key ? 'selected' : '') + '>' + item.label + '</option>'
            ).join('');
            const authorityOptions = Object.entries(AUTHORITIES).map(([key, item]) =>
                '<option value="' + key + '" ' + (admin.authority === key ? 'selected' : '') + '>' + item.label + '</option>'
            ).join('');
            const colonyOptions = '<option value="">Sem colônia designada</option>' + colonized.map(item =>
                '<option value="' + item.id + '" ' + (planet?.id === item.id ? 'selected' : '') + '>' + item.shortName + '</option>'
            ).join('');
            const emotion = Number(diamond.loyalty || 0) >= 75 ? 'Satisfeita' : Number(diamond.loyalty || 0) >= 45 ? 'Reservada' : 'Insatisfeita';
            const proposals = state.diamondGovernance.decisions.filter(item => item.diamondId === diamond.id).slice(0, 4).map(item => {
                const pending = item.status === 'pending';
                const statusLabel = pending ? 'Aguardando aprovação' : item.status === 'approved' ? 'Aprovada' : item.status === 'executed_auto' ? 'Executada autonomamente' : 'Rejeitada';
                return '<div class="stat-box governance-decision"><div class="card-header"><b>' + escapeHTML(item.title) + '</b><span class="badge">' + statusLabel + '</span></div>' +
                    '<p class="structure-desc">' + escapeHTML(item.detail) + '</p><small class="governance-muted">Custo: ' + escapeHTML(item.costLabel) + '</small><small class="governance-effect">Efeito: ' + escapeHTML(item.effectLabel) + '</small>' +
                    (pending ? '<div class="grid-2"><button class="btn btn-emerald" onclick="approveDiamondDecision(\'' + item.id + '\')">Aprovar</button><button class="btn btn-pink" onclick="rejectDiamondDecision(\'' + item.id + '\')">Rejeitar</button></div>' : '') +
                    '</div>';
            }).join('');
            html += '<div class="card governance-diamond"><div class="card-header"><span class="card-title">💎 ' + escapeHTML(diamond.name) + '</span><span class="badge">' + emotion + '</span></div>' +
                '<div class="governance-personality"><b>' + escapeHTML(diamond.personalityName || 'Personalidade não catalogada') + '</b><p class="structure-desc">' + escapeHTML(diamond.personalityDesc || '') + '</p></div>' +
                '<div class="grid-2"><div class="stat-box">Lealdade <b>' + Math.round(Number(diamond.loyalty || 0)) + '%</b></div><div class="stat-box">Autonomia <b>' + Math.round(Number(diamond.autonomy || 0)) + '%</b></div></div>' +
                '<div class="governance-traits">' + traitHtml + '</div>' +
                '<label class="stat-label" for="diamond-office-' + diamond.id + '">Cargo imperial</label><select id="diamond-office-' + diamond.id + '" onchange="setDiamondOffice(\'' + diamond.id + '\',this.value)">' + officeOptions + '</select><small class="governance-muted">' + OFFICES[admin.office].desc + '</small>' +
                '<label class="stat-label" for="diamond-authority-' + diamond.id + '">Nível de autoridade</label><select id="diamond-authority-' + diamond.id + '" onchange="setDiamondAuthority(\'' + diamond.id + '\',this.value)">' + authorityOptions + '</select><small class="governance-muted">' + AUTHORITIES[admin.authority].desc + '</small>' +
                '<label class="stat-label" for="diamond-colony-' + diamond.id + '">Colônia sob sua governança</label><select id="diamond-colony-' + diamond.id + '" onchange="setDiamondColony(\'' + diamond.id + '\',this.value)">' + colonyOptions + '</select>' +
                '<button class="btn btn-block active" onclick="requestDiamondGovernanceDecision(\'' + diamond.id + '\')" ' + (!planet ? 'disabled' : '') + '>Solicitar plano administrativo</button>' +
                '<div class="governance-speech">“' + escapeHTML(diamond.currentSpeech || 'Aguardo as diretrizes da Corte.') + '”</div>' +
                '<div class="card-header"><b>Decisões e histórico</b></div>' + (proposals || '<small class="governance-muted">Nenhuma proposta registrada.</small>') +
                '</div>';
        });
        container.innerHTML = html;
    }

    window.ensureDiamondGovernanceData = ensureGovernanceData;
    window.setDiamondOffice = setDiamondOffice;
    window.setDiamondAuthority = setDiamondAuthority;
    window.setDiamondColony = setDiamondColony;
    window.requestDiamondGovernanceDecision = requestDiamondGovernanceDecision;
    window.approveDiamondDecision = approveDiamondDecision;
    window.rejectDiamondDecision = rejectDiamondDecision;
    window.setImperialPriority = setImperialPriority;
    window.updateDiamondGovernance = updateDiamondGovernance;
    window.renderGovernanceTab = renderGovernanceTab;
})();