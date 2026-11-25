/* =========================================================================
 * GEMPIRE · Off-Colors e Ordem Pública (fase 1)
 *
 *  - Cada off-color tem casta e defeito (com efeito no trabalho e um traço próprio).
 *  - Off-colors surgem nas injeções manuais (Rank D) e também nos lotes dos
 *    Injetores, com chance ligada às condições do planeta e à intensidade da partida.
 *  - A Lei Off-Color tem efeito real: Reciclagem, Toleradas, Santuário,
 *    Cidadania integrada e Expurgo. Cada uma muda produção, dissidência,
 *    galerias escondidas e a lealdade das Diamantes.
 *  - Galerias: off-colors que fogem ficam escondidas (fora do censo). O jogador
 *    vê só uma estimativa, a não ser que tenha uma Safira de visão invertida.
 *  - Intensidade (Rara / Moderada / Constante), escolhida ao criar a partida,
 *    regula chances, fugas e pressão sobre a dissidência.
 *
 * Registro por planeta em planet.offColors = {groups:{'casta|defeito':n}, hidden:n}.
 * census.offcolor continua sendo o total visível (subconjunto do censo das castas).
 * ========================================================================= */
(function(){
    'use strict';
    const DEFECTS={
        color:{label:'Cor errada',work:1,desc:'Trabalha normalmente, mas é estigmatizada pela corte.'},
        gem:{label:'Gema fora do lugar',work:.8,desc:'Forma instável; rende 80% do esperado.'},
        size:{label:'Tamanho fora do padrão',work:.9,desc:'Grande ou pequena demais para a função; rende 90%.'},
        power:{label:'Poder instável',work:.7,desc:'Rende 70%, mas integrada tem picos de criatividade (tecnologia extra).'},
        vision:{label:'Visão invertida',work:.6,desc:'Só Safiras: vê o passado. Revela o tamanho real das galerias.',caste:'sapphire'}
    };
    const POLICIES={
        recycle:{label:'Reciclagem',name:'Reciclagem',desc:'Off-colors são poofadas e estilhaçadas ao emergir. Algumas escapam para as galerias. Gera medo e dissidência.',work:0},
        bubble:{label:'Embolhamento',name:'Embolhamento',desc:'Off-colors são poofadas e guardadas em bolhas na Sala das Bolhas, sem se reformar. Sem espaço, fogem para as galerias. Podem ser libertadas depois.',work:0},
        tolerate:{label:'Toleradas',name:'Toleradas',desc:'Trabalham com metade da eficiência e vivem à margem. As escondidas voltam aos poucos.',work:.5},
        sanctuary:{label:'Santuário',name:'Santuário Protegido',desc:'Não trabalham, mas a colônia se acalma. As escondidas voltam mais rápido.',work:0},
        citizen:{label:'Cidadania integrada',name:'Cidadania Integrada',desc:'Trabalham com seus traços e geram tecnologia extra. As escondidas voltam rápido.',work:1},
        purge:{label:'Expurgo',name:'Expurgo Total',desc:'Off-colors são caçadas, poofadas e estilhaçadas. Muitas fogem para as galerias; a dissidência sobe.',work:0}
    };
    // Reação de cada temperamento à lei (lealdade por minuto, enquanto houver off-colors no império).
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const OPINION={recycle:{harsh:.25,cerebral:.05,grand:-.05,gentle:-.35},tolerate:{harsh:-.05,cerebral:.05,grand:.05,gentle:.1},sanctuary:{harsh:-.2,cerebral:0,grand:.1,gentle:.3},citizen:{harsh:-.35,cerebral:.1,grand:.15,gentle:.35},purge:{harsh:.3,cerebral:-.15,grand:-.2,gentle:-.5},bubble:{harsh:.1,cerebral:.1,grand:-.05,gentle:-.15}};
    const INTENSITY={rare:{label:'Rara',mult:.5,desc:'Rebeliões e off-colors são incomuns.'},moderate:{label:'Moderada',mult:1,desc:'Surgem quando o império abusa.'},constant:{label:'Constante',mult:1.8,desc:'Sempre há tensão a administrar.'}};
    const LEGACY_POLICY={'Embolhamento':'bubble','Reciclagem':'recycle','Reciclagem Estrita':'recycle','Toleradas':'tolerate','Santuário Protegido':'sanctuary','Cidadania Integrada':'citizen','Expurgo Total':'purge'};
    const OFF_TINTS=['#a855f7','#64748b','#ec4899','#84cc16','#f97316','#14b8a6'];
    const LAW_COOLDOWN=600;

    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const casteLabel=c=>FOUNDING_GEM_DATA?.[c]?.label||c;
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    function intensity(){const k=state.rebellionIntensity;return INTENSITY[k]?k:'moderate';}
    function mult(){return INTENSITY[intensity()].mult;}
    function policy(){
        const laws=state.imperialLaws=state.imperialLaws||{};
        if(!POLICIES[laws.offColorPolicyKey])laws.offColorPolicyKey=LEGACY_POLICY[laws.offColorPolicy]||'recycle';
        laws.offColorPolicy=POLICIES[laws.offColorPolicyKey].name;
        return laws.offColorPolicyKey;
    }
    function censusOf(planet){return planet.id===activeId()?(state.census||(state.census={})):(ensurePlanetEconomy(planet,false).census||{});}
    function setCensus(planet,census){if(planet.id===activeId())state.census=census;else ensurePlanetEconomy(planet,false).census=census;}
    function registry(planet){
        const r=planet.offColors=planet.offColors&&typeof planet.offColors==='object'?planet.offColors:{};
        r.groups=r.groups&&typeof r.groups==='object'?r.groups:{};r.hidden=Math.max(0,Number(r.hidden)||0);r.fearTimer=Number(r.fearTimer)||0;
        return r;
    }
    function rollDefect(caste){
        if(caste==='sapphire'&&Math.random()<.4)return 'vision';
        const keys=['color','color','gem','size','power'];return keys[Math.floor(Math.random()*keys.length)];
    }
    function visibleTotal(planet){return Object.values(registry(planet).groups).reduce((a,b)=>a+(Number(b)||0),0);}
    function byCaste(planet){const out={};Object.entries(registry(planet).groups).forEach(([k,n])=>{const c=k.split('|')[0];out[c]=(out[c]||0)+n;});return out;}
    // Mantém o registro coerente com o censo (gems podem ter sido transportadas ou perdidas).
    function sync(planet){
        if(!planet||!planet.colonized)return;
        const r=registry(planet),census=censusOf(planet);
        // Saves antigos: o total off-color existia sem casta. Distribui pelas castas presentes.
        if(!r.migrated){
            r.migrated=true;let legacy=Math.max(0,Math.floor(Number(census.offcolor)||0))-visibleTotal(planet);
            const castes=Object.keys(census).filter(k=>!['prime','offcolor'].includes(k)&&Number(census[k])>0);
            while(legacy>0&&castes.length){const c=castes[Math.floor(Math.random()*castes.length)],k=c+'|'+rollDefect(c);r.groups[k]=(r.groups[k]||0)+1;legacy--;}
        }
        const bc=byCaste(planet);
        Object.entries(bc).forEach(([c,n])=>{let excess=n-Math.max(0,Math.floor(Number(census[c])||0));if(excess<=0)return;Object.keys(r.groups).filter(k=>k.startsWith(c+'|')).forEach(k=>{const take=Math.min(excess,r.groups[k]);r.groups[k]-=take;excess-=take;if(!r.groups[k])delete r.groups[k];});});
        census.offcolor=visibleTotal(planet);
    }
    function addGroup(planet,caste,defect,n){const r=registry(planet),k=caste+'|'+defect;r.groups[k]=(r.groups[k]||0)+n;}
    function removeFromCensus(planet,caste,n){const census=Object.assign({},censusOf(planet));census[caste]=Math.max(0,(Number(census[caste])||0)-n);setCensus(planet,census);}
    function removeWalkers(planet,caste,n,pred){if(!Array.isArray(planet.walkingGems))return;for(let i=planet.walkingGems.length-1;i>=0&&n>0;i--){const g=planet.walkingGems[i];if(g&&(g.caste||g.type)===caste&&(!pred||pred(g))){planet.walkingGems.splice(i,1);n--;}}}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function courtLoyalty(fn){(state.matriarchs||[]).forEach(m=>{const d=fn(TONE[m.personalityId]||'grand',m);if(d)m.loyalty=clamp((Number(m.loyalty)||0)+d);});}

    // Chamado quando uma off-color emerge (já contada no censo da casta e em census.offcolor).
    function onEmerge(planet,caste,gem){
        if(!planet)return;
        const census=censusOf(planet);census.offcolor=Math.max(0,(Number(census.offcolor)||0)-1); // o registro assume a contagem
        const defect=rollDefect(caste);
        if(gem){gem.defect=defect;gem.grade='D';}
        admit(planet,caste,defect,1,gem?[gem]:null);
        sync(planet);
    }
    // Lotes dos Injetores: parte das Gems pode sair off-color, conforme o planeta.
    function offColorChance(planet){
        const stage=Number(planet.resourceTotal)>0?1-(Number(planet.resourcesRemaining)||0)/Number(planet.resourceTotal):0;
        let p=.035+stage*.06+(Number(planet.seismicHeat)>55?.03:0)+(Number(planet.dissent)>50?.02:0);
        if(planet.demantoidSupervisor||Number(censusOf(planet).demantoid)>0)p*=.6;
        return Math.min(.35,p*mult());
    }
    function onBatch(planet,caste,quantity){
        if(!planet||!quantity||caste==='pearl')return 0;
        const p=offColorChance(planet);let n=0;for(let i=0;i<quantity;i++)if(Math.random()<p)n++;
        if(!n)return 0;
        // Marca algumas Gems recém-criadas que caminham na superfície como off-color.
        const fresh=(planet.walkingGems||[]).filter(g=>g&&g.caste===caste&&g.grade!=='D').slice(-n);
        const defects={};
        for(let i=0;i<n;i++){const d=rollDefect(caste);defects[d]=(defects[d]||0)+1;const g=fresh[i];if(g){g.grade='D';g.defect=d;g.color=OFF_TINTS[Math.floor(Math.random()*OFF_TINTS.length)];}}
        Object.entries(defects).forEach(([d,k])=>admit(planet,caste,d,k,fresh.filter(g=>g.defect===d)));
        sync(planet);
        return n;
    }
    // Aplica a lei ao que acabou de surgir.
    function admit(planet,caste,defect,n,walkers){
        const pol=policy(),r=registry(planet);
        if(pol==='bubble'){
            removeFromCensus(planet,caste,n);(walkers||[]).forEach(g=>{const i=planet.walkingGems.indexOf(g);if(i>=0)planet.walkingGems.splice(i,1);});
            const kept=window.GempireGemFate?GempireGemFate.bubble(planet,caste,n,'offcolor',true,defect):0,fled=n-kept;
            r.hidden+=fled;planet.dissent=Math.min(100,(Number(planet.dissent)||0)+(kept*.4+fled*.6)*mult());
            notify(n+' '+casteLabel(caste)+' off-color: '+(kept?kept+' embolhada(s)':'')+(kept&&fled?', ':'')+(fled?fled+' fugiu(ram) por falta de bolhas':'')+'.',!!fled);
            return;
        }
        if(pol==='recycle'||pol==='purge'){
            const escape=Math.min(.9,(pol==='purge'?.55:.2)*mult());let fled=0;for(let i=0;i<n;i++)if(Math.random()<escape)fled++;
            const destroyed=n-fled;
            removeFromCensus(planet,caste,n);(walkers||[]).forEach(g=>{const i=planet.walkingGems.indexOf(g);if(i>=0)planet.walkingGems.splice(i,1);});
            r.hidden+=fled;r.recycled=(Number(r.recycled)||0)+destroyed;if(window.GempireGemFate)GempireGemFate.stats().shattered+=destroyed;
            planet.dissent=Math.min(100,(Number(planet.dissent)||0)+(destroyed*1.2+fled*.6)*mult());
            courtLoyalty(t=>t==='gentle'?-.6*destroyed:0);
            if(destroyed)chronicle(pol==='purge'?'Off-color caçada':'Off-color reciclada',n+' '+casteLabel(caste)+' off-color'+(n>1?'s':'')+' em '+planet.shortName+': '+destroyed+' poofada(s) e estilhaçada(s)'+(fled?', '+fled+' fugiu(ram) para as galerias':'')+'.',pol==='purge'?'Expurgo':'Reciclagem');
            else if(fled)notify(fled+' off-color(s) fugiu(ram) para as galerias de '+planet.shortName+'.',true);
            return;
        }
        addGroup(planet,caste,defect,n);
        notify(n+' '+casteLabel(caste)+' off-color ('+DEFECTS[defect].label.toLowerCase()+') emergiu em '+planet.shortName+'. Lei: '+POLICIES[pol].label+'.');
    }

    // Quantas Gems de cada casta deixam de produzir por causa da lei (usado no rendimento).
    function adjustCensus(planet,census){
        if(!planet||!census)return census;
        const pol=policy(),r=registry(planet);if(!Object.keys(r.groups).length)return census;
        const out=Object.assign({},census);
        Object.entries(r.groups).forEach(([k,n])=>{const [c,d]=k.split('|');const work=POLICIES[pol].work*(DEFECTS[d]?.work??1);const lost=n*(1-work);out[c]=Math.max(0,(Number(out[c])||0)-lost);});
        return out;
    }
    // Bônus da Cidadania: off-colors de poder instável geram tecnologia extra.
    function extraYield(planet){
        if(policy()!=='citizen')return {tech:0};
        const r=registry(planet);let power=0,total=0;Object.entries(r.groups).forEach(([k,n])=>{total+=n;if(k.endsWith('|power'))power+=n;});
        return {tech:power*1.2+total*.15};
    }

    // Efeitos contínuos da lei e das galerias.
    let tick=0;
    function update(dt){
        if(!state||!state.firstGameStarted)return;
        dt=Math.max(0,Math.min(5,Number(dt)||0));tick+=dt;if(tick<10)return;const step=tick;tick=0;
        const pol=policy(),minutes=step/60;
        let anyOff=0;
        Object.values(PLANETS).filter(p=>p&&p.colonized).forEach(planet=>{
            sync(planet);
            const r=registry(planet),visible=visibleTotal(planet);anyOff+=visible+r.hidden;
            // Galerias pressionam a dissidência.
            // Sob leis brandas as escondidas se sentem mais seguras e pressionam menos.
            const fearFactor={bubble:.8,recycle:1,purge:1.4,tolerate:.7,sanctuary:.35,citizen:.3}[pol]||1;
            if(r.hidden>0)planet.dissent=Math.min(100,(Number(planet.dissent)||0)+Math.min(6,r.hidden*.08)*fearFactor*minutes*mult());
            // Leis brandas trazem as escondidas de volta ao censo, aos poucos.
            const back={tolerate:.01,sanctuary:.03,citizen:.05}[pol]||0;
            if(back&&r.hidden>0){let n=0;for(let i=0;i<r.hidden;i++)if(Math.random()<back*minutes)n++;if(n){r.hidden-=n;const caste=pickCaste(planet);const census=Object.assign({},censusOf(planet));census[caste]=(Number(census[caste])||0)+n;setCensus(planet,census);addGroup(planet,caste,rollDefect(caste),n);sync(planet);notify(n+' off-color(s) saiu(íram) das galerias de '+planet.shortName+'.');}}
            if(pol==='sanctuary'&&(visible>0||r.hidden>0))planet.dissent=Math.max(0,(Number(planet.dissent)||0)-(1.2+Math.min(3,visible*.05))*minutes);
            if(pol==='tolerate'&&visible>0)planet.dissent=Math.min(100,(Number(planet.dissent)||0)+Math.min(1.5,visible*.01)*minutes*mult());
            // Embolhamento: as visíveis são recolhidas aos poucos para as bolhas; sem espaço, fogem.
            if(pol==='bubble'&&visible>0){
                Object.entries(Object.assign({},r.groups)).forEach(([k,n])=>{const [c,d]=k.split('|');const caught=Math.min(n,Math.ceil(n*.3*minutes));if(caught<=0)return;r.groups[k]-=caught;if(!r.groups[k])delete r.groups[k];removeFromCensus(planet,c,caught);removeWalkers(planet,c,caught,g=>g.grade==='D');const kept=window.GempireGemFate?GempireGemFate.bubble(planet,c,caught,'offcolor',true,d):0;r.hidden+=caught-kept;});
                sync(planet);
            }
            // Expurgo: caça contínua às visíveis (com fugas) enquanto a lei estiver ativa.
            if(pol==='purge'&&visible>0){
                Object.entries(Object.assign({},r.groups)).forEach(([k,n])=>{const [c,d]=k.split('|');const caught=Math.min(n,Math.ceil(n*.25*minutes));if(caught<=0)return;r.groups[k]-=caught;if(!r.groups[k])delete r.groups[k];removeFromCensus(planet,c,caught);removeWalkers(planet,c,caught,g=>g.grade==='D');const fled=Math.round(caught*.5);r.hidden+=fled;if(window.GempireGemFate)GempireGemFate.stats().shattered+=caught-fled;r.recycled=(Number(r.recycled)||0)+caught-fled;planet.dissent=Math.min(100,(Number(planet.dissent)||0)+caught*.8*mult());});
                sync(planet);
            }
        });
        // Opinião das Diamantes sobre a lei (só importa se houver off-colors no império).
        if(anyOff>0)courtLoyalty(t=>(OPINION[pol]?.[t]||0)*minutes);
    }
    function pickCaste(planet){const census=censusOf(planet),keys=Object.keys(census).filter(k=>!['prime','offcolor'].includes(k)&&Number(census[k])>0);return keys.length?keys[Math.floor(Math.random()*keys.length)]:'quartz';}

    // Troca de lei: efeitos imediatos e reação da corte.
    function setPolicy(key){
        if(!POLICIES[key])return;const old=policy();if(old===key)return;
        const left=Math.max(0,(Number(state.imperialLaws.offColorLawCooldownUntil)||0)-Date.now())/1000;
        if(left>0){notify('A Lei Off-Color só pode mudar de novo em '+(typeof formatDuration==='function'?formatDuration(left):Math.ceil(left)+'s')+'.',true);return;}
        state.imperialLaws.offColorPolicyKey=key;state.imperialLaws.offColorPolicy=POLICIES[key].name;state.imperialLaws.offColorLawCooldownUntil=Date.now()+LAW_COOLDOWN*1000;
        let destroyed=0,fled=0;
        // Reciclagem passa a valer também para as off-colors que já existem.
        if(key==='recycle'){
            Object.values(PLANETS).filter(p=>p.colonized).forEach(planet=>{const r=registry(planet);Object.entries(Object.assign({},r.groups)).forEach(([k,n])=>{const c=k.split('|')[0];let f=0;for(let i=0;i<n;i++)if(Math.random()<.35*mult())f++;delete r.groups[k];removeFromCensus(planet,c,n);removeWalkers(planet,c,n,g=>g.grade==='D');r.hidden+=f;r.recycled=(Number(r.recycled)||0)+n-f;if(window.GempireGemFate)GempireGemFate.stats().shattered+=n-f;destroyed+=n-f;fled+=f;planet.dissent=Math.min(100,(Number(planet.dissent)||0)+(n-f)*1.2*mult());});sync(planet);});
        }
        // Reação imediata da corte.
        courtLoyalty(t=>(OPINION[key]?.[t]||0)*12);
        if(window.GempireCourt&&state.court?.log)state.court.log.unshift({text:'Nova Lei Off-Color: '+POLICIES[key].label+'.',impact:'A corte reage à decisão',color:'#c9a6ff',cycle:Number(state.cycleCount)||1,at:Date.now()});
        chronicle('Lei Off-Color: '+POLICIES[key].label,POLICIES[key].desc+(destroyed||fled?' '+destroyed+' off-color(s) estilhaçada(s), '+fled+' fugiu(ram).':''),'Lei imperial alterada');
        notify('Lei Off-Color alterada para '+POLICIES[key].label+'.');
        refresh();
    }
    function refresh(){try{updateHUD();}catch(e){}try{renderDrawerContent();}catch(e){}renderIfVisible();}
    function renderIfVisible(){if(state.currentScreen==='governance'&&state.governanceSection==='order'){const el=document.getElementById('governance-content');if(el)render(el);}}
    let uiTimer=0;
    function updateUI(dt){uiTimer-=dt;if(uiTimer<=0){uiTimer=3;const el=document.getElementById('governance-content');if(el&&state.currentScreen==='governance'&&state.governanceSection==='order'&&!el.contains(document.activeElement))render(el);}}

    // Estimativa das galerias: exata com uma Safira de visão invertida na colônia.
    function hiddenEstimate(planet){
        const r=registry(planet),h=r.hidden;if(!h)return {text:'Nenhum sinal',exact:true};
        if(Object.keys(r.groups).some(k=>k==='sapphire|vision'))return {text:fmt(h)+' (visão do passado)',exact:true};
        if(Number(planet.resistance?.galleryIntelUntil)>Date.now())return {text:fmt(h)+' (varredura orbital)',exact:true};
        const lo=Math.max(1,Math.floor(h*.6)),hi=Math.ceil(h*1.5);return {text:'entre '+fmt(lo)+' e '+fmt(hi),exact:false};
    }
    function render(container){
        const pol=policy(),planets=Object.values(PLANETS).filter(p=>p&&p.colonized);planets.forEach(sync);
        const totalVisible=planets.reduce((a,p)=>a+visibleTotal(p),0),recycled=planets.reduce((a,p)=>a+(Number(registry(p).recycled)||0),0);
        const left=Math.max(0,(Number(state.imperialLaws.offColorLawCooldownUntil)||0)-Date.now())/1000;
        let html='<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">Ordem Pública · Off-Colors e Resistência</span><span class="badge">Intensidade '+INTENSITY[intensity()].label+'</span></div><p class="governance-muted">Off-colors são Gems que emergiram fora do padrão. A lei define o que acontece com elas e muda produção, dissidência e a opinião das Diamantes. Off-colors em fuga se escondem nas galerias e pressionam a dissidência. Cada colônia tem uma resistência que cresce com dissidência, galerias, leis duras, ordem baixa e esgotamento: Calma → Descontentamento → Células (sabotagens) → Insurreição (veios tomados) → Mundo rebelde (produção parada, revolta se espalha).</p>'+
            '<div class="grid-2"><div class="stat-box">Off-colors visíveis <b>'+fmt(totalVisible)+'</b></div><div class="stat-box">Estilhaçadas até hoje <b>'+fmt(recycled)+'</b></div></div></section>';
        html+='<section class="card"><div class="card-header"><span class="card-title">Lei Off-Color</span><span class="badge">'+(left>0?'Nova mudança em '+(typeof formatDuration==='function'?formatDuration(left):Math.ceil(left)+'s'):'Pode mudar')+'</span></div><div class="order-laws">'+
            Object.entries(POLICIES).map(([k,p])=>{const op=OPINION[k];const fav=Object.entries(op).filter(([,v])=>v>.05).map(([t])=>({harsh:'duras',gentle:'gentis',cerebral:'racionais',grand:'grandiosas'})[t]);const against=Object.entries(op).filter(([,v])=>v<-.05).map(([t])=>({harsh:'duras',gentle:'gentis',cerebral:'racionais',grand:'grandiosas'})[t]);
                return '<div class="stat-box order-law'+(k===pol?' active':'')+'"><b>'+p.label+(k===pol?' · em vigor':'')+'</b><small style="display:block">'+p.desc+'</small><small style="display:block;color:var(--text-muted);margin-top:4px">Trabalho: '+Math.round(p.work*100)+'% · Aprovam: '+(fav.join(', ')||'ninguém')+' · Reprovam: '+(against.join(', ')||'ninguém')+'</small>'+(k===pol?'':'<button class="btn btn-block" '+(left>0?'disabled':'')+' onclick="GempireOffColors.setPolicy(\''+k+'\')">Decretar</button>')+'</div>';}).join('')+'</div></section>';
        html+='<section class="card order-colonies"><div class="card-header"><span class="card-title">Colônias</span><span class="badge">'+planets.length+'</span></div>'+planets.map(planet=>{
            const r=registry(planet),groups=Object.entries(r.groups).sort((a,b)=>b[1]-a[1]),est=hiddenEstimate(planet),chance=offColorChance(planet);
            return '<div class="order-planet"><div class="court-row"><b>'+esc(planet.shortName)+'</b><span class="badge">'+Math.round(Number(planet.dissent)||0)+'% dissidência'+(planet.rebellionActive?' · rebelião':'')+'</span></div>'+
                '<div class="grid-2"><div class="stat-box">Off-colors visíveis <b>'+fmt(visibleTotal(planet))+'</b></div><div class="stat-box">Galerias <b>'+est.text+'</b></div></div>'+
                '<small style="display:block;color:var(--text-muted)">Chance de off-color por Gem nos lotes: '+(chance*100).toFixed(1)+'% (sobe com o esgotamento, calor e dissidência; cai com Demantoide).</small>'+
                (groups.length?'<div class="order-groups">'+groups.map(([k,n])=>{const [c,d]=k.split('|');return '<span class="badge" title="'+esc(DEFECTS[d]?.desc||'')+'">'+fmt(n)+' '+esc(casteLabel(c))+' · '+esc(DEFECTS[d]?.label||d)+'</span>';}).join(' ')+'</div>':'')+(window.GempireResistance?GempireResistance.renderPlanet(planet):'')+(window.GempireGemFate?GempireGemFate.render(planet):'')+'</div>';
        }).join('')+'</section>';
        if(window.GempireResistance&&GempireResistance.renderNetwork)html+=GempireResistance.renderNetwork();
        html+='<section class="card"><div class="card-header"><span class="card-title">Defeitos</span></div>'+Object.values(DEFECTS).map(d=>'<div class="stat-box"><b>'+d.label+'</b><small style="display:block">'+d.desc+'</small></div>').join('')+'</section>';
        container.innerHTML=html;
    }
    function intensityOptions(selected){return Object.entries(INTENSITY).map(([k,v])=>'<option value="'+k+'"'+(k===(selected||'moderate')?' selected':'')+'>'+v.label+' · '+v.desc+'</option>').join('');}

    function addVisible(planet,caste,defect,n){addGroup(planet,caste,defect||'color',n);sync(planet);}
    window.GempireOffColors={addVisible,onEmerge,onBatch,adjustCensus,extraYield,update:(dt)=>{update(dt);updateUI(dt);},render,setPolicy,policy,sync,intensityOptions,INTENSITY,offColorChance,_registry:registry};
    window.renderOrderTab=render;
})();
