/* Central de comando das Hessonitas · exércitos, batalhões e distribuição de Quartzos. */
(function () {
    'use strict';

    const BATTALION_SIZE = 100;
    const SQUAD_SIZE = 20;

    function escapeMilitaryHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
    }

    function getMilitaryState() {
        if (!state.military || typeof state.military !== 'object') {
            state.military = { initialized: false, armies: [], battalions: [], nextArmyNumber: 1, uiAccumulator: 0 };
        }
        const military = state.military;
        military.armies = Array.isArray(military.armies) ? military.armies : [];
        military.battalions = Array.isArray(military.battalions) ? military.battalions : [];
        military.nextArmyNumber = Math.max(1, Math.floor(Number(military.nextArmyNumber) || 1));
        military.uiAccumulator = Math.max(0, Number(military.uiAccumulator) || 0);
        military.initialized = !!military.initialized;

        military.armies.forEach(function (army) {
            if (!army || typeof army !== 'object') return;
            army.number = Math.max(1, Math.floor(Number(army.number) || 1));
            army.id = army.id || 'military_army_' + army.number;
            army.planetId = PLANETS[army.planetId] ? army.planetId : 'homeworld';
            army.nextBattalionNumber = Math.max(1, Math.floor(Number(army.nextBattalionNumber) || 1));
        });

        military.battalions.forEach(function (battalion) {
            if (!battalion || typeof battalion !== 'object') return;
            battalion.id = battalion.id || 'military_battalion_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
            battalion.soldiers = Math.max(1, Math.min(BATTALION_SIZE, Math.floor(Number(battalion.soldiers) || BATTALION_SIZE)));
            battalion.mission = battalion.mission === 'patrol' ? 'patrol' : 'extraction';
            battalion.patrolProgress = Math.max(0, Number(battalion.patrolProgress) || 0);
        });

        const maxArmyNumber = military.armies.reduce(function (max, army) {
            return Math.max(max, Number(army && army.number) || 0);
        }, 0);
        military.nextArmyNumber = Math.max(military.nextArmyNumber, maxArmyNumber + 1);

        military.armies.forEach(function (army) {
            const maxBattalion = military.battalions.filter(function (battalion) {
                return battalion && battalion.armyId === army.id;
            }).reduce(function (max, battalion) {
                return Math.max(max, Number(battalion.number) || 0);
            }, 0);
            army.nextBattalionNumber = Math.max(army.nextBattalionNumber, maxBattalion + 1);
        });

        return military;
    }

    function isHessoniteCommandActive() {
        return Math.max(0, Number(state.census && state.census.hessonite) || 0) > 0;
    }

    function getQuartzSoldierCount() {
        return Math.max(0, Math.floor(Number(state.census && state.census.quartz) || 0));
    }

    function getCommandCapacity() {
        return typeof getTroopCommandCapacity === 'function'
            ? Math.max(0, Math.floor(Number(getTroopCommandCapacity()) || 0))
            : 0;
    }

    function getCommandableSoldierCount() {
        return Math.min(getQuartzSoldierCount(), getCommandCapacity());
    }

    function getDeployedSoldierCount() {
        return getMilitaryState().battalions.reduce(function (sum, battalion) {
            return sum + Math.max(0, Math.floor(Number(battalion && battalion.soldiers) || 0));
        }, 0);
    }

    function getAvailableSoldierCount() {
        return Math.max(0, getCommandableSoldierCount() - getDeployedSoldierCount());
    }

    function createArmyForPlanet(planetId) {
        const military = getMilitaryState();
        const existing = military.armies.find(function (army) {
            return army && army.planetId === planetId;
        });
        if (existing) return existing;

        const number = military.nextArmyNumber++;
        const army = {
            id: 'military_army_' + number,
            number: number,
            planetId: planetId,
            nextBattalionNumber: 1
        };
        military.armies.push(army);
        return army;
    }

    function appendBattalion(army, soldiers, mission) {
        const military = getMilitaryState();
        const number = Math.max(1, Math.floor(Number(army.nextBattalionNumber) || 1));
        army.nextBattalionNumber = number + 1;
        const battalion = {
            id: 'military_battalion_' + army.number + '_' + number + '_' + Date.now(),
            armyId: army.id,
            number: number,
            soldiers: Math.max(1, Math.min(BATTALION_SIZE, Math.floor(Number(soldiers) || 1))),
            mission: mission === 'patrol' ? 'patrol' : 'extraction',
            createdCycle: Math.max(1, Number(state.cycleCount) || 1),
            patrolProgress: 0
        };
        military.battalions.push(battalion);
        return battalion;
    }

    function getDefaultPlanetId() {
        const active = PLANETS[state.activeColonyPlanetId];
        if (active && active.colonized) return active.id;
        const homeworld = PLANETS.homeworld;
        if (homeworld && homeworld.colonized) return homeworld.id;
        const first = Object.values(PLANETS).find(function (planet) { return planet && planet.colonized; });
        return first ? first.id : null;
    }

    function pruneEmptyArmies() {
        const military = getMilitaryState();
        const occupied = new Set(military.battalions.map(function (battalion) { return battalion.armyId; }));
        military.armies = military.armies.filter(function (army) { return occupied.has(army.id); });
    }

    function ensureHessoniteMilitaryData() {
        const military = getMilitaryState();

        military.battalions.forEach(function (battalion) {
            if (military.armies.some(function (army) { return army && army.id === battalion.armyId; })) return;
            const planetId = getDefaultPlanetId();
            if (!planetId) return;
            const army = createArmyForPlanet(planetId);
            battalion.armyId = army.id;
            battalion.number = army.nextBattalionNumber++;
        });

        if (!military.initialized && isHessoniteCommandActive()) {
            military.initialized = true;
            const planetId = getDefaultPlanetId();
            let remaining = getCommandableSoldierCount();
            if (planetId) {
                const army = createArmyForPlanet(planetId);
                while (remaining > 0) {
                    const quantity = Math.min(BATTALION_SIZE, remaining);
                    appendBattalion(army, quantity, 'extraction');
                    remaining -= quantity;
                }
            }
        }
        return military;
    }

    function getEffectiveBattalionAllocations() {
        const military = ensureHessoniteMilitaryData();
        if (!military.initialized) return [];
        let remaining = getCommandableSoldierCount();
        return military.battalions.map(function (battalion) {
            const effectiveSoldiers = Math.min(
                Math.max(0, Math.floor(Number(battalion.soldiers) || 0)),
                remaining
            );
            remaining -= effectiveSoldiers;
            return { battalion: battalion, effectiveSoldiers: effectiveSoldiers };
        });
    }

    function getHessoniteExtractionAllocation(planetId, fallbackQuartz) {
        const military = ensureHessoniteMilitaryData();
        if (!military.initialized) {
            return Math.max(0, Math.floor(Number(fallbackQuartz) || 0));
        }
        return getEffectiveBattalionAllocations().reduce(function (sum, item) {
            const battalion = item.battalion;
            const army = military.armies.find(function (candidate) {
                return candidate && candidate.id === battalion.armyId;
            });
            return sum + (battalion.mission === 'extraction' && army && army.planetId === planetId
                ? item.effectiveSoldiers
                : 0);
        }, 0);
    }

    function updateHessonitePatrols(dt) {
        const military = ensureHessoniteMilitaryData();
        if (!military.initialized || !Number.isFinite(dt) || dt <= 0) return;

        getEffectiveBattalionAllocations().forEach(function (item) {
            const battalion = item.battalion;
            if (battalion.mission !== 'patrol' || item.effectiveSoldiers <= 0) return;
            const army = military.armies.find(function (candidate) {
                return candidate && candidate.id === battalion.armyId;
            });
            const planet = army && PLANETS[army.planetId];
            if (!planet || !planet.colonized) return;

            // A patrulha reduz dissidência gradualmente; o valor acompanha o contingente destacado.
            planet.dissent = Math.max(0, (Number(planet.dissent) || 0) - dt * item.effectiveSoldiers * 0.01);
        });

        // Não recria o painel durante a simulação: isso preserva foco e valores enquanto o jogador edita ordens.
    }

    function getPlanetOptionsHtml(selectedPlanetId) {
        return Object.values(PLANETS).filter(function (planet) {
            return planet && planet.colonized;
        }).map(function (planet) {
            return '<option value="' + escapeMilitaryHtml(planet.id) + '"' +
                (planet.id === selectedPlanetId ? ' selected' : '') + '>' +
                escapeMilitaryHtml(planet.shortName || planet.name || planet.id) + '</option>';
        }).join('');
    }

    function getMissionLabel(mission) {
        return mission === 'patrol' ? 'Patrulha planetária' : 'Extração de recursos';
    }

    function getBattalionSquads(soldiers) {
        return Math.ceil(Math.max(0, Number(soldiers) || 0) / SQUAD_SIZE);
    }

    function renderBattalionCard(battalion, army, planetOptions, effectiveSoldiers) {
        const id = escapeMilitaryHtml(battalion.id);
        const currentSoldiers = Math.max(1, Number(battalion.soldiers) || 1);
        const squadCount = getBattalionSquads(currentSoldiers);
        const effective = Math.max(0, Number(effectiveSoldiers) || 0);
        const overload = effective < currentSoldiers;
        return '<div class="stat-box" style="display:grid;gap:7px;margin-top:7px">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">' +
            '<b>Batalhão #' + String(Number(battalion.number) || 1).padStart(3, '0') + '</b>' +
            '<span class="badge">' + getMissionLabel(battalion.mission) + '</span></div>' +
            '<div class="grid-2"><div>Soldados designados: <b>' + currentSoldiers + '</b></div>' +
            '<div>Esquadrões: <b>' + squadCount + '</b></div></div>' +
            '<small style="color:' + (overload ? '#fbbf24' : '#94a3b8') + '">' +
            (overload ? 'Comando insuficiente: ' + effective + '/' + currentSoldiers + ' mobilizados. Ajuste a força ou amplie os generais.' :
                'Força ativa: ' + effective + ' Quartzos · até 20 soldados por esquadrão.') + '</small>' +
            '<label class="stat-label" for="hessonite-battalion-planet-' + id + '">Planeta de operação</label>' +
            '<select id="hessonite-battalion-planet-' + id + '">' + getPlanetOptionsHtml(army.planetId) + '</select>' +
            '<label class="stat-label" for="hessonite-battalion-mission-' + id + '">Missão do batalhão</label>' +
            '<select id="hessonite-battalion-mission-' + id + '">' +
            '<option value="extraction"' + (battalion.mission === 'extraction' ? ' selected' : '') + '>Extração de recursos</option>' +
            '<option value="patrol"' + (battalion.mission === 'patrol' ? ' selected' : '') + '>Patrulha planetária</option></select>' +
            '<label class="stat-label" for="hessonite-battalion-soldiers-' + id + '">Quantidade de soldados (máximo ' + BATTALION_SIZE + ')</label>' +
            '<input id="hessonite-battalion-soldiers-' + id + '" type="number" min="1" max="' + BATTALION_SIZE + '" step="1" value="' + currentSoldiers + '">' +
            '<div class="grid-2"><button class="btn active" type="button" onclick="saveHessoniteBattalion(\'' + id + '\')">Salvar ordens</button>' +
            '<button class="btn btn-pink" type="button" onclick="disbandHessoniteBattalion(\'' + id + '\')">Desmobilizar</button></div>' +
            '</div>';
    }

    function renderHessoniteMilitaryTab(container) {
        if (!container) return;
        if (!isHessoniteCommandActive()) {
            container.innerHTML = '<div class="card card-amber"><b>Comando militar indisponível</b><p class="structure-desc">Esta central exige ao menos uma Hessonita no Império.</p></div>';
            return;
        }

        const military = ensureHessoniteMilitaryData();
        const quartz = getQuartzSoldierCount();
        const commandCapacity = getCommandCapacity();
        const commandable = getCommandableSoldierCount();
        const deployed = getDeployedSoldierCount();
        const available = getAvailableSoldierCount();
        const effective = getEffectiveBattalionAllocations();
        const effectiveById = new Map(effective.map(function (item) {
            return [item.battalion.id, item.effectiveSoldiers];
        }));
        const extraction = effective.reduce(function (sum, item) {
            if (item.battalion.mission !== 'extraction') return sum;
            const army = military.armies.find(function (candidate) { return candidate.id === item.battalion.armyId; });
            return sum + (army && army.planetId === state.activeColonyPlanetId ? item.effectiveSoldiers : 0);
        }, 0);
        const patrol = effective.reduce(function (sum, item) {
            return sum + (item.battalion.mission === 'patrol' ? item.effectiveSoldiers : 0);
        }, 0);
        const squads = effective.reduce(function (sum, item) {
            return sum + getBattalionSquads(item.effectiveSoldiers);
        }, 0);
        const agateCapacity = typeof getAgateCommandCapacity === 'function' ? getAgateCommandCapacity() : 0;
        const supportedSquads = Math.floor(Math.max(0, agateCapacity) / SQUAD_SIZE);
        const armies = military.armies.filter(function (army) {
            return military.battalions.some(function (battalion) { return battalion.armyId === army.id; });
        }).sort(function (a, b) { return a.number - b.number; });
        const colonizedPlanets = Object.values(PLANETS).filter(function (planet) { return planet && planet.colonized; });
        const defaultPlanet = getDefaultPlanetId();
        const planetOptions = getPlanetOptionsHtml(defaultPlanet);
        const battalionCount = military.battalions.length;
        const armyCards = armies.map(function (army) {
            const planet = PLANETS[army.planetId];
            const members = military.battalions.filter(function (battalion) { return battalion.armyId === army.id; })
                .sort(function (a, b) { return a.number - b.number; });
            const battalionCards = members.map(function (battalion) {
                return renderBattalionCard(battalion, army, planetOptions, effectiveById.get(battalion.id) || 0);
            }).join('');
            const armySoldiers = members.reduce(function (sum, battalion) {
                return sum + Math.max(0, Number(battalion.soldiers) || 0);
            }, 0);
            const armyEffective = members.reduce(function (sum, battalion) {
                return sum + (effectiveById.get(battalion.id) || 0);
            }, 0);
            const dissent = Math.max(0, Math.min(100, Number(planet && planet.dissent) || 0));
            return '<div class="card"><div class="card-header"><span class="card-title">Exército #' +
                String(Number(army.number) || 1).padStart(2, '0') + ' · ' +
                escapeMilitaryHtml(planet ? (planet.shortName || planet.name) : army.planetId) +
                '</span><span class="badge">' + members.length + ' batalhão(ões)</span></div>' +
                '<div class="grid-2"><div class="stat-box">Força designada: <b>' + armySoldiers + '</b></div>' +
                '<div class="stat-box">Força mobilizada: <b>' + armyEffective + '</b></div></div>' +
                '<div class="stat-box">Dissidência local: <b>' + dissent.toFixed(1) + '%</b></div>' +
                battalionCards + '</div>';
        }).join('');

        const creationLimit = Math.min(BATTALION_SIZE, available);
        const creationDefault = Math.max(1, creationLimit);
        const canCreate = creationLimit > 0 && colonizedPlanets.length > 0;
        const emeraldNote = Number(state.census && state.census.emerald) > 0
            ? 'Esmeralda presente: capacidade dos generais multiplicada por 10.'
            : 'Sem Esmeralda: capacidade padrão dos generais.';
        const reserve = Math.max(0, quartz - deployed);

        container.innerHTML =
            '<div class="card card-cyan"><div class="card-header"><span class="card-title title-font">⚔️ Central de comando · Hessonita</span>' +
            '<span class="badge">' + Number(state.census.hessonite || 0) + ' Hessonita(s)</span></div>' +
            '<p class="structure-desc">A Hessonita organiza a infantaria Quartzo. Cada batalhão comporta até 100 soldados e cada esquadrão reúne até 20. Os exércitos são agrupados por planeta e recebem numeração própria.</p>' +
            '<div class="grid-2"><div class="stat-box"><span class="stat-label">Soldados existentes</span><b>' + quartz.toLocaleString('pt-BR') + ' Quartzos</b></div>' +
            '<div class="stat-box"><span class="stat-label">Capacidade de comando</span><b>' + commandCapacity.toLocaleString('pt-BR') + ' soldados</b></div>' +
            '<div class="stat-box"><span class="stat-label">Mobilizáveis</span><b>' + commandable.toLocaleString('pt-BR') + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Em reserva</span><b>' + reserve.toLocaleString('pt-BR') + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Exércitos ativos</span><b>' + armies.length + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Batalhões / esquadrões</span><b>' + battalionCount + ' / ' + squads + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Na extração · planeta selecionado</span><b>' + extraction + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Em patrulha</span><b>' + patrol + '</b></div></div>' +
            '<small style="display:block;color:var(--text-muted)">' + Number(state.census.pyrope || 0) + ' Piropo(s) · ' +
            Number(state.census.emerald || 0) + ' Esmeralda(s). ' + emeraldNote +
            '</small><small style="display:block;color:var(--text-muted)">Ágatas podem coordenar até ' +
            Number(agateCapacity).toLocaleString('pt-BR') + ' Quartzos (' + supportedSquads + ' esquadrões de 20).</small></div>' +
            '<div class="card"><div class="card-header"><span class="card-title">Criar batalhão</span><span class="badge">Até ' + BATTALION_SIZE + ' soldados</span></div>' +
            '<p class="structure-desc">A tropa disponível depende da quantidade de Quartzos e da capacidade atual de comando dos generais. Soldados acima desse limite permanecem na reserva.</p>' +
            '<label class="stat-label" for="hessonite-new-planet">Planeta de destino</label>' +
            '<select id="hessonite-new-planet">' + planetOptions + '</select>' +
            '<label class="stat-label" for="hessonite-new-mission">Missão inicial</label>' +
            '<select id="hessonite-new-mission"><option value="extraction">Extração de recursos</option><option value="patrol">Patrulha planetária</option></select>' +
            '<label class="stat-label" for="hessonite-new-soldiers">Soldados no batalhão</label>' +
            '<input id="hessonite-new-soldiers" type="number" min="1" max="' + BATTALION_SIZE + '" step="1" value="' + (canCreate ? creationDefault : 1) + '"' + (!canCreate ? ' disabled' : '') + '>' +
            '<button class="btn btn-emerald btn-block" type="button" onclick="createHessoniteBattalion()"' + (!canCreate ? ' disabled' : '') + '>Formar novo batalhão · ' + available + ' disponíveis</button>' +
            '<small style="color:var(--text-muted)">A extração só opera em planetas com Extrator Mineral operacional e Peridoto operador. A patrulha reduz gradualmente a dissidência do planeta de destino.</small></div>' +
            (armyCards || '<div class="card"><b>Nenhum exército formado</b><p class="structure-desc">Crie um batalhão para mobilizar os primeiros Quartzos.</p></div>') +
            '<div class="card"><div class="card-header"><span class="card-title">Regras de comando</span></div>' +
            '<div class="stat-box">Hessonita: 100 soldados de capacidade por unidade.</div>' +
            '<div class="stat-box">Piropo: 1.000 soldados de capacidade por unidade.</div>' +
            '<div class="stat-box">Esmeralda: multiplica por 10 a capacidade de comando dos generais, conforme a regra atual do Império.</div>' +
            '<div class="stat-box">Ágata: coordena até 20 Quartzos por unidade. Os esquadrões continuam numerados dentro de cada batalhão.</div>' +
            '</div>';
    }

    function createHessoniteBattalion() {
        if (!isHessoniteCommandActive()) return;
        const planetField = document.getElementById('hessonite-new-planet');
        const missionField = document.getElementById('hessonite-new-mission');
        const soldiersField = document.getElementById('hessonite-new-soldiers');
        const planetId = planetField ? planetField.value : getDefaultPlanetId();
        const mission = missionField ? missionField.value : 'extraction';
        const soldiers = Math.floor(Number(soldiersField && soldiersField.value) || 0);
        if (!PLANETS[planetId] || !PLANETS[planetId].colonized) {
            setStatusTicker('Escolha um planeta colonizado para formar o exército.', true);
            return;
        }
        if (!['extraction', 'patrol'].includes(mission)) {
            setStatusTicker('Missão de batalhão inválida.', true);
            return;
        }
        if (soldiers < 1 || soldiers > BATTALION_SIZE || soldiers > getAvailableSoldierCount()) {
            setStatusTicker('Quantidade inválida. O batalhão aceita até 100 soldados e não pode ultrapassar sua reserva de comando.', true);
            return;
        }
        const military = ensureHessoniteMilitaryData();
        const army = createArmyForPlanet(planetId);
        const battalion = appendBattalion(army, soldiers, mission);
        addChronicle('Batalhão formado', 'O Batalhão #' + String(battalion.number).padStart(3, '0') +
            ' foi incorporado ao Exército #' + String(army.number).padStart(2, '0') +
            ' em ' + (PLANETS[planetId].shortName || PLANETS[planetId].name) + '.', soldiers + ' Quartzos mobilizados');
        setStatusTicker('Batalhão #' + String(battalion.number).padStart(3, '0') + ' formado com ' + soldiers + ' Quartzos.');
        updateHUD();
        renderDrawerContent();
        renderBottomBar();
    }

    function saveHessoniteBattalion(battalionId) {
        const military = ensureHessoniteMilitaryData();
        const battalion = military.battalions.find(function (item) { return item && item.id === battalionId; });
        if (!battalion) return;
        const id = escapeMilitaryHtml(battalion.id);
        const planetField = document.getElementById('hessonite-battalion-planet-' + id);
        const missionField = document.getElementById('hessonite-battalion-mission-' + id);
        const soldiersField = document.getElementById('hessonite-battalion-soldiers-' + id);
        const planetId = planetField ? planetField.value : '';
        const mission = missionField ? missionField.value : '';
        const soldiers = Math.floor(Number(soldiersField && soldiersField.value) || 0);

        if (!PLANETS[planetId] || !PLANETS[planetId].colonized) {
            setStatusTicker('O destino do batalhão precisa ser um planeta colonizado.', true);
            return;
        }
        if (!['extraction', 'patrol'].includes(mission)) {
            setStatusTicker('Missão inválida para este batalhão.', true);
            return;
        }
        if (soldiers < 1 || soldiers > BATTALION_SIZE) {
            setStatusTicker('Cada batalhão deve ter entre 1 e 100 soldados.', true);
            return;
        }
        const deployedWithoutThis = getDeployedSoldierCount() - battalion.soldiers;
        if (deployedWithoutThis + soldiers > getCommandableSoldierCount()) {
            setStatusTicker('A ordem excede os Quartzos existentes ou a capacidade dos generais. Reduza a tropa ou amplie o comando.', true);
            return;
        }

        const oldArmy = military.armies.find(function (army) { return army.id === battalion.armyId; });
        if (!oldArmy || oldArmy.planetId !== planetId) {
            const newArmy = createArmyForPlanet(planetId);
            battalion.armyId = newArmy.id;
            battalion.number = newArmy.nextBattalionNumber++;
        }
        battalion.mission = mission;
        battalion.soldiers = soldiers;
        pruneEmptyArmies();
        setStatusTicker('Ordens do Batalhão #' + String(battalion.number).padStart(3, '0') + ' atualizadas.');
        addChronicle('Redistribuição militar', 'O Batalhão #' + String(battalion.number).padStart(3, '0') +
            ' recebeu novas ordens: ' + getMissionLabel(mission).toLowerCase() + ' em ' +
            (PLANETS[planetId].shortName || PLANETS[planetId].name) + '.', soldiers + ' soldados designados');
        updateHUD();
        renderDrawerContent();
        renderBottomBar();
    }

    function disbandHessoniteBattalion(battalionId) {
        const military = ensureHessoniteMilitaryData();
        const index = military.battalions.findIndex(function (item) { return item && item.id === battalionId; });
        if (index < 0) return;
        const battalion = military.battalions[index];
        military.battalions.splice(index, 1);
        pruneEmptyArmies();
        setStatusTicker('Batalhão #' + String(battalion.number).padStart(3, '0') + ' desmobilizado. Os Quartzos retornaram à reserva.');
        addChronicle('Batalhão desmobilizado', 'O Batalhão #' + String(battalion.number).padStart(3, '0') + ' foi retirado da cadeia de comando.', battalion.soldiers + ' Quartzos em reserva');
        updateHUD();
        renderDrawerContent();
        renderBottomBar();
    }

    window.isHessoniteCommandActive = isHessoniteCommandActive;
    window.ensureHessoniteMilitaryData = ensureHessoniteMilitaryData;
    window.getHessoniteExtractionAllocation = getHessoniteExtractionAllocation;
    window.updateHessonitePatrols = updateHessonitePatrols;
    window.renderHessoniteMilitaryTab = renderHessoniteMilitaryTab;
    window.createHessoniteBattalion = createHessoniteBattalion;
    window.saveHessoniteBattalion = saveHessoniteBattalion;
    window.disbandHessoniteBattalion = disbandHessoniteBattalion;
})();