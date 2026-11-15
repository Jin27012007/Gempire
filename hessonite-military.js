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

    function getImperialCensus(){return typeof window.getEmpireCensus==='function'?window.getEmpireCensus():(state.census||{});}
    function isHessoniteCommandActive() {return Math.max(0,Number(getImperialCensus().hessonite)||0)>0;}
    function getQuartzSoldierCount() {return Math.max(0,Math.floor(Number(getImperialCensus().quartz)||0));}

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

    function ensureWarpPermissionData(){
        if(!state.hessoniteWarpPermissions||typeof state.hessoniteWarpPermissions!=='object')state.hessoniteWarpPermissions={};
        state.hessoniteWarpDispatchAccumulator=Math.max(0,Number(state.hessoniteWarpDispatchAccumulator)||0);
        return state.hessoniteWarpPermissions;
    }
    function setHessoniteWarpPermission(targetId,enabled){
        const target=PLANETS[targetId],permissions=ensureWarpPermissionData();
        if(!target||!target.colonized||!target.galaxyWarpBuilt){setStatusTicker('O destino precisa ser uma colônia com Galaxy Warp concluído.',true);return;}
        const sources=Object.values(PLANETS).filter(p=>p.colonized&&p.id!==targetId&&p.galaxyWarpBuilt);
        if(enabled&&!sources.length){setStatusTicker('Nenhuma outra colônia possui Galaxy Warp para enviar os soldados.',true);return;}
        permissions[targetId]=!!enabled;
        setStatusTicker(enabled?'A Diamante autorizou o envio automático de Quartzos para '+target.shortName+'.':'Envios automáticos para '+target.shortName+' foram suspensos.');
        renderHessoniteMilitaryTab(document.getElementById('governance-content'));
    }
    function getPlanetDeployedSoldiers(planetId){
        const military=getMilitaryState();
        return military.battalions.reduce((sum,b)=>{const army=military.armies.find(a=>a.id===b.armyId);return sum+(army&&army.planetId===planetId?Math.max(0,Math.floor(Number(b.soldiers)||0)):0);},0);
    }
    function processAutomaticGalaxyWarpDeployments(dt){
        const permissions=ensureWarpPermissionData();
        state.hessoniteWarpDispatchAccumulator+=Math.max(0,Number(dt)||0);
        if(state.hessoniteWarpDispatchAccumulator<30)return;
        state.hessoniteWarpDispatchAccumulator%=30;
        if(!isHessoniteCommandActive()||typeof window.getPlanetCensus!=='function'||typeof window.setPlanetCensus!=='function')return;
        for(const [targetId,authorized] of Object.entries(permissions)){
            const target=PLANETS[targetId];if(!authorized||!target||!target.colonized||!target.galaxyWarpBuilt)continue;
            for(const source of Object.values(PLANETS)){
                if(!source.colonized||source.id===targetId||!source.galaxyWarpBuilt)continue;
                const sourceCensus=Object.assign({},window.getPlanetCensus(source.id));
                const sourceReserve=Math.max(0,Math.floor(Number(sourceCensus.quartz)||0)-getPlanetDeployedSoldiers(source.id));
                const quantity=Math.min(BATTALION_SIZE,sourceReserve,getAvailableSoldierCount());
                if(quantity<1)continue;
                const targetCensus=Object.assign({},window.getPlanetCensus(targetId));
                sourceCensus.quartz=Math.max(0,(Number(sourceCensus.quartz)||0)-quantity);
                targetCensus.quartz=(Number(targetCensus.quartz)||0)+quantity;
                window.setPlanetCensus(source.id,sourceCensus);window.setPlanetCensus(targetId,targetCensus);
                const army=createArmyForPlanet(targetId),battalion=appendBattalion(army,quantity,'extraction');
                addChronicle('Reforço Quartzo via Galaxy Warp',quantity+' soldados Quartzo foram transferidos de '+source.shortName+' para '+target.shortName+' por autorização da Diamante.','Batalhão #'+String(battalion.number).padStart(3,'0')+' incorporado à extração');
                setStatusTicker('Hessonitas enviaram '+quantity+' Quartzos de '+source.shortName+' para trabalhar em '+target.shortName+'.');
                if(state.drawerOpen&&state.drawerTab==='hessonite')renderHessoniteMilitaryTab(document.getElementById('governance-content'));
                if(getAvailableSoldierCount()<1)break;
            }
        }
    }

    function updateHessonitePatrols(dt) {
        const military = ensureHessoniteMilitaryData();
        if (!Number.isFinite(dt) || dt <= 0) return;
        processAutomaticGalaxyWarpDeployments(dt);
        if (!military.initialized) return;

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
        const escortLocked = !!battalion.terraformEscort;
        const escortTarget = escortLocked ? PLANETS[battalion.terraformEscort.targetPlanetId] : null;
        const planetOptionsHtml = escortLocked
            ? '<option value="' + escapeMilitaryHtml(battalion.terraformEscort.targetPlanetId) + '" selected>' + escapeMilitaryHtml(escortTarget && (escortTarget.shortName || escortTarget.name) || 'Planeta da expedição') + ' · escolta</option>'
            : getPlanetOptionsHtml(army.planetId);
        const disabledAttribute = escortLocked ? ' disabled' : '';
        return '<div class="stat-box" style="display:grid;gap:7px;margin-top:7px">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">' +
            '<b>Batalhão #' + String(Number(battalion.number) || 1).padStart(3, '0') + '</b>' +
            '<span class="badge">' + (battalion.terraformEscort ? 'Escolta de terraformação' : getMissionLabel(battalion.mission)) + '</span></div>' +
            '<div class="grid-2"><div>Soldados designados: <b>' + currentSoldiers + '</b></div>' +
            '<div>Esquadrões: <b>' + squadCount + ' (#01–#' + String(squadCount).padStart(2, '0') + ')</b></div></div>' +
            '<small style="color:' + (overload ? '#fbbf24' : '#94a3b8') + '">' +
            (overload ? 'Comando insuficiente: ' + effective + '/' + currentSoldiers + ' mobilizados. Ajuste a força ou amplie os generais.' :
                'Força ativa: ' + effective + ' Quartzos · até 20 soldados por esquadrão.') + '</small>' +
            '<label class="stat-label" for="hessonite-battalion-planet-' + id + '">Planeta de operação</label>' +
            '<select id="hessonite-battalion-planet-' + id + '"' + disabledAttribute + '>' + planetOptionsHtml + '</select>' +
            '<label class="stat-label" for="hessonite-battalion-mission-' + id + '">Missão do batalhão</label>' +
            '<select id="hessonite-battalion-mission-' + id + '"' + disabledAttribute + '>' +
            '<option value="extraction"' + (battalion.mission === 'extraction' ? ' selected' : '') + '>Extração de recursos</option>' +
            '<option value="patrol"' + (battalion.mission === 'patrol' ? ' selected' : '') + '>Patrulha planetária</option></select>' +
            '<label class="stat-label" for="hessonite-battalion-soldiers-' + id + '">Quantidade de soldados (máximo ' + BATTALION_SIZE + ')</label>' +
            '<input id="hessonite-battalion-soldiers-' + id + '" type="number" min="1" max="' + BATTALION_SIZE + '" step="1" value="' + currentSoldiers + '"' + disabledAttribute + '>' +
            '<div class="grid-2"><button class="btn active" type="button" onclick="saveHessoniteBattalion(\'' + id + '\')"' + disabledAttribute + '>Salvar ordens</button>' +
            '<button class="btn btn-pink" type="button" onclick="disbandHessoniteBattalion(\'' + id + '\')"' + disabledAttribute + '>Desmobilizar</button></div>' +
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
        const imperialCensus=getImperialCensus();
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
        const emeraldNote = Number(imperialCensus.emerald) > 0
            ? 'Esmeralda presente: capacidade dos generais multiplicada por 10.'
            : 'Sem Esmeralda: capacidade padrão dos generais.';
        const reserve = Math.max(0, quartz - deployed);
        const warpPermissions=ensureWarpPermissionData();
        const warpTargets=colonizedPlanets.filter(function(p){return p.galaxyWarpBuilt;}).map(function(target){
            const sources=colonizedPlanets.filter(function(source){return source.id!==target.id&&source.galaxyWarpBuilt;});
            const enabled=warpPermissions[target.id]===true;
            return '<div class="stat-box" data-planet="'+escapeMilitaryHtml(target.id)+'"><div style="display:flex;justify-content:space-between;gap:8px"><b>'+escapeMilitaryHtml(target.shortName||target.name)+'</b><span class="badge">'+(enabled?'Autorizado':'Bloqueado')+'</span></div><small style="color:var(--text-muted)">Origens com Galaxy Warp: '+(sources.map(p=>escapeMilitaryHtml(p.shortName||p.name)).join(', ')||'Nenhuma')+'</small><button class="btn btn-block '+(enabled?'btn-pink':'active')+'" type="button" onclick="setHessoniteWarpPermission(this.parentElement.dataset.planet,'+(!enabled)+')" '+(!sources.length&&!enabled?'disabled':'')+'>'+(enabled?'Revogar autorização da Diamante':'Autorizar Hessonitas a enviar Quartzos')+'</button></div>';
        }).join('');
        const warpCard='<div class="card card-cyan"><div class="card-header"><span class="card-title">🌀 Reforços automáticos via Galaxy Warp</span></div><p class="structure-desc">A Diamante decide quais colônias podem receber soldados. Com a autorização ativa, as Hessonitas enviam até 100 Quartzos por ciclo de 30 segundos a partir de outras colônias com Galaxy Warp. Os soldados passam a integrar a população e os batalhões de extração do destino.</p>'+(warpTargets||'<small style="color:var(--text-muted)">Nenhuma colônia com Galaxy Warp concluído.</small>')+'</div>';

        container.innerHTML =
            '<div class="card card-cyan"><div class="card-header"><span class="card-title title-font">⚔️ Central de comando · Hessonita</span>' +
            '<span class="badge">' + Number(imperialCensus.hessonite || 0) + ' Hessonita(s) no Império</span></div>' +
            '<p class="structure-desc">A Hessonita organiza a infantaria Quartzo. Cada batalhão comporta até 100 soldados e cada esquadrão reúne até 20. Os exércitos são agrupados por planeta e recebem numeração própria.</p>' +
            '<div class="grid-2"><div class="stat-box"><span class="stat-label">Soldados existentes</span><b>' + quartz.toLocaleString('pt-BR') + ' Quartzos</b></div>' +
            '<div class="stat-box"><span class="stat-label">Capacidade de comando</span><b>' + commandCapacity.toLocaleString('pt-BR') + ' soldados</b></div>' +
            '<div class="stat-box"><span class="stat-label">Mobilizáveis</span><b>' + commandable.toLocaleString('pt-BR') + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Em reserva</span><b>' + reserve.toLocaleString('pt-BR') + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Rubis de guarda</span><b>' + Number(imperialCensus.ruby || 0).toLocaleString('pt-BR') + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Exércitos ativos</span><b>' + armies.length + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Batalhões / esquadrões</span><b>' + battalionCount + ' / ' + squads + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Na extração · planeta selecionado</span><b>' + extraction + '</b></div>' +
            '<div class="stat-box"><span class="stat-label">Em patrulha</span><b>' + patrol + '</b></div></div>' +
            '<small style="display:block;color:var(--text-muted)">' + Number(imperialCensus.pyrope || 0) + ' Piropo(s) · ' +
            Number(imperialCensus.emerald || 0) + ' Esmeralda(s). ' + emeraldNote +
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
            '<small style="color:var(--text-muted)">A extração exige Extrator Mineral operacional e Peridoto operador. A patrulha reduz a dissidência do planeta de destino.</small></div>' +
            warpCard +
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
        if (battalion.terraformEscort) {
            setStatusTicker('Este batalhão está destacado como escolta. Suas ordens ficam bloqueadas até o retorno da expedição.', true);
            return;
        }
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
        if (battalion.terraformEscort) {
            setStatusTicker('Uma escolta não pode ser desmobilizada durante a expedição geológica. Recolha a equipe primeiro.', true);
            return;
        }
        military.battalions.splice(index, 1);
        pruneEmptyArmies();
        setStatusTicker('Batalhão #' + String(battalion.number).padStart(3, '0') + ' desmobilizado. Os Quartzos retornaram à reserva.');
        addChronicle('Batalhão desmobilizado', 'O Batalhão #' + String(battalion.number).padStart(3, '0') + ' foi retirado da cadeia de comando.', battalion.soldiers + ' Quartzos em reserva');
        updateHUD();
        renderDrawerContent();
        renderBottomBar();
    }


    function getAvailableHessoniteTerraformEscort(sourcePlanetId) {
        if (!isHessoniteCommandActive()) return null;
        const military = ensureHessoniteMilitaryData();
        const effective = getEffectiveBattalionAllocations();
        for (const item of effective) {
            const battalion = item.battalion;
            if (!battalion || battalion.mission !== 'patrol' || item.effectiveSoldiers <= 0 || battalion.terraformEscort) continue;
            const army = military.armies.find(function (candidate) { return candidate && candidate.id === battalion.armyId; });
            if (!army || army.planetId !== sourcePlanetId) continue;
            const sameArmy = military.battalions.filter(function (candidate) { return candidate && candidate.armyId === army.id; });
            if (sameArmy.length !== 1) continue;
            return { battalionId: battalion.id, soldiers: item.effectiveSoldiers, planetId: army.planetId };
        }
        return null;
    }

    function dispatchHessoniteTerraformEscort(teamId, targetPlanetId, sourcePlanetId, battalionId) {
        if (!isHessoniteCommandActive() || !PLANETS[targetPlanetId] || !PLANETS[sourcePlanetId]) return false;
        const military = ensureHessoniteMilitaryData();
        const battalion = military.battalions.find(function (item) { return item && item.id === battalionId; });
        if (!battalion || battalion.mission !== 'patrol' || battalion.terraformEscort) return false;
        const army = military.armies.find(function (item) { return item && item.id === battalion.armyId; });
        if (!army || army.planetId !== sourcePlanetId) return false;
        const sameArmy = military.battalions.filter(function (item) { return item && item.armyId === army.id; });
        const effective = getEffectiveBattalionAllocations().find(function (item) { return item.battalion.id === battalion.id; });
        if (sameArmy.length !== 1 || !effective || effective.effectiveSoldiers <= 0) return false;
        battalion.terraformEscort = { teamId: teamId, originalPlanetId: army.planetId, targetPlanetId: targetPlanetId };
        army.planetId = targetPlanetId;
        addChronicle('Escolta Hessonita destacada', 'O Batalhão #' + String(Number(battalion.number) || 1).padStart(3, '0') + ' foi temporariamente designado para proteger uma equipe de terraformação em ' + (PLANETS[targetPlanetId].shortName || PLANETS[targetPlanetId].name) + '.', effective.effectiveSoldiers + ' soldados em escolta');
        setStatusTicker('Uma patrulha Hessonita foi destacada para proteger a expedição geológica.');
        return true;
    }

    function hasHessoniteTerraformEscort(teamId) {
        const military = ensureHessoniteMilitaryData();
        const allocations = getEffectiveBattalionAllocations();
        return military.battalions.some(function (battalion) {
            if (!battalion || !battalion.terraformEscort || battalion.terraformEscort.teamId !== teamId) return false;
            return allocations.some(function (item) { return item.battalion.id === battalion.id && item.effectiveSoldiers > 0; });
        });
    }

    function returnHessoniteTerraformEscort(teamId) {
        const military = ensureHessoniteMilitaryData();
        let returned = false;
        military.battalions.forEach(function (battalion) {
            const escort = battalion && battalion.terraformEscort;
            if (!escort || escort.teamId !== teamId) return;
            const army = military.armies.find(function (item) { return item && item.id === battalion.armyId; });
            if (army && PLANETS[escort.originalPlanetId]) army.planetId = escort.originalPlanetId;
            delete battalion.terraformEscort;
            returned = true;
        });
        if (returned) {
            setStatusTicker('A escolta Hessonita retornou à sua guarnição.');
            if (typeof renderDrawerContent === 'function') renderDrawerContent();
        }
        return returned;
    }

    window.isHessoniteCommandActive = isHessoniteCommandActive;
    window.setHessoniteWarpPermission=setHessoniteWarpPermission;
    window.ensureHessoniteMilitaryData = ensureHessoniteMilitaryData;
    window.getHessoniteExtractionAllocation = getHessoniteExtractionAllocation;
    window.updateHessonitePatrols = updateHessonitePatrols;
    window.renderHessoniteMilitaryTab = renderHessoniteMilitaryTab;
    window.createHessoniteBattalion = createHessoniteBattalion;
    window.saveHessoniteBattalion = saveHessoniteBattalion;
    window.disbandHessoniteBattalion = disbandHessoniteBattalion;
    window.getAvailableHessoniteTerraformEscort = getAvailableHessoniteTerraformEscort;
    window.dispatchHessoniteTerraformEscort = dispatchHessoniteTerraformEscort;
    window.hasHessoniteTerraformEscort = hasHessoniteTerraformEscort;
    window.returnHessoniteTerraformEscort = returnHessoniteTerraformEscort;
})();