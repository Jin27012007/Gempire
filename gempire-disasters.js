/* =========================================================================
 * GEMPIRE · Desastres
 *
 *  - Tempestade solar: apagão de energia (produção reduzida). O Gerador de Escudo
 *    com Reator na colônia bloqueia a maioria. Estrelas mais quentes geram mais.
 *  - Terremoto: destrói estruturas. Se atingir o jardim de infância (Injetores),
 *    aumenta por um tempo a chance de surgirem Gems defeituosas (off-colors).
 *  - Asteroide (pequeno, médio, grande): Torres de Defesa podem interceptar. O impacto
 *    destrói estruturas, poofa ou estilhaça Gems atingidas, pode danificar o jardim de
 *    infância, traz minerais novos e aquece o planeta.
 *  - Ataque rebelde: células e fusões rebeldes emboscam aristocratas e Diamantes com
 *    pouca escolta (Rubis e Topázios protegem). Gems são poofadas, às vezes estilhaçadas.
 *  - Erupção vulcânica: lava destrói o jardim de infância, aquece o planeta e continua
 *    causando dano até ser contida por Obsidianas Floco de Neve.
 *  - Retaliação de nativos: em mundos com vida orgânica, a exploração gera hostilidade;
 *    os nativos atacam até serem repelidos ou até um tratado de convivência.
 * A frequência acompanha a intensidade escolhida na criação da partida.
 * Estado por planeta em planet.hazards; registro em state.disasterLog.
 * ========================================================================= */
(function(){
    'use strict';
    const uiGate=(()=>{let last=0;return ms=>{const t=performance.now();if(t-last<ms)return false;last=t;return true;};})();
    const DESTRUCTIBLE=['injector','mineral_extractor','workshop','refinery','research_center','reactor','defense_tower','shield_generator','shipyard'];
    const ARISTOCRATS=['sapphire','morganite','aquamarine','emerald','jade','demantoid','hessonite','pyrope'];
    const WORKERS=['quartz','peridot','bismuth','lapis','pearl','nephrite'];
    const SIZES={small:{label:'pequeno',towerChance:.18,structures:[0,1],gems:[1,4],shatter:.1,minerals:[400,900],heat:[1,3]},
        medium:{label:'médio',towerChance:.12,structures:[1,2],gems:[4,12],shatter:.2,minerals:[1200,2500],heat:[3,7]},
        large:{label:'grande',towerChance:.07,structures:[2,4],gems:[10,30],shatter:.35,minerals:[3000,6000],heat:[8,16]}};
    const MINERALS=['quartz','silicate','corundum','metallic','nacre','garnet','olivine','lapisrock','pyroxene','beryllium','obsidian','topaz'];
    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const rnd=(a,b)=>a+Math.random()*(b-a),rint=(a,b)=>Math.floor(rnd(a,b+1));
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const dur=s=>typeof formatDuration==='function'?formatDuration(s):Math.ceil(s)+'s';
    const now=()=>typeof gameNow==='function'?gameNow():Date.now();
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    const mult=()=>({rare:.5,moderate:1,constant:1.8})[state.rebellionIntensity]||1;
    const label=c=>FOUNDING_GEM_DATA?.[c]?.label||c;
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function economy(p){return p.id===activeId()?state:ensurePlanetEconomy(p,false);}
    function censusOf(p){return p.id===activeId()?(state.census||(state.census={})):(ensurePlanetEconomy(p,false).census||{});}
    function setCensus(p,c){if(p.id===activeId())state.census=c;else ensurePlanetEconomy(p,false).census=c;}
    function structuresOf(p){const e=economy(p);return e.structures||(e.structures={});}
    function count(p,id){return Math.max(0,Math.floor(Number(structuresOf(p)[id])||0));}
    function hz(p){const h=p.hazards=p.hazards&&typeof p.hazards==='object'?p.hazards:{};h.natives=h.natives&&typeof h.natives==='object'?h.natives:{hostility:0};h.blackoutUntil=Number(h.blackoutUntil)||0;h.kgUntil=Number(h.kgUntil)||0;h.kgBonus=Number(h.kgBonus)||0;return h;}
    function log(p,kind,text,impact){const L=state.disasterLog=Array.isArray(state.disasterLog)?state.disasterLog:[];L.unshift({planetId:p.id,planet:p.shortName,kind,text,impact:impact||'',at:now(),cycle:Number(state.cycleCount)||1});L.length=Math.min(L.length,40);}
    function depletion(p){return Number(p.resourceTotal)>0?1-(Number(p.resourcesRemaining)||0)/Number(p.resourceTotal):0;}
    function starLum(p){const sys=typeof getStarSystem==='function'?getStarSystem(p.systemId||'home_system'):null;return Number(sys?.lum)||1;}

    // ------------------------------------------------------------ efeitos comuns
    function destroyStructures(p,n,prefer){
        const st=structuresOf(p),out=[];
        for(let i=0;i<n;i++){
            const pool=(prefer&&prefer.filter(id=>count(p,id)>0).length?prefer:DESTRUCTIBLE).filter(id=>count(p,id)>0);if(!pool.length)break;
            const id=pool[Math.floor(Math.random()*pool.length)];st[id]=count(p,id)-1;
            // Injetores e extratores também ficam registrados no planeta (naves de carga).
            if(p.structures&&['injector','mineral_extractor'].includes(id))p.structures[id]=Math.max(0,Math.floor(Number(p.structures[id])||0)-1);
            if(id==='injector'){(p.veins||[]).find(v=>v.injector&&(v.injector=null,true));}
            out.push(typeof structureDefinition==='function'?(structureDefinition(id)?.name||id):id);
        }
        return out;
    }
    // Gems atingidas: parte é estilhaçada, o resto é poofado e se reforma.
    function hitGems(p,n,shatterFrac,castes){
        const census=censusOf(p),pool=(castes||Object.keys(census)).filter(k=>!['prime','offcolor'].includes(k)&&Number(census[k])>0);
        if(!pool.length||n<=0)return {poofed:0,shattered:0};
        const weights=pool.map(k=>Number(census[k])),total=weights.reduce((a,b)=>a+b,0),hit={};
        for(let i=0;i<n;i++){let r=Math.random()*total;for(let j=0;j<pool.length;j++){r-=weights[j];if(r<=0){hit[pool[j]]=(hit[pool[j]]||0)+1;break;}}}
        let poofed=0,shattered=0;
        Object.entries(hit).forEach(([c,k])=>{
            k=Math.min(k,Math.floor(Number(censusOf(p)[c])||0));if(!k)return;
            const s=Math.round(k*shatterFrac);
            if(s>0){const cc=Object.assign({},censusOf(p));cc[c]=Math.max(0,(Number(cc[c])||0)-s);setCensus(p,cc);shattered+=s;if(window.GempireGemFate)GempireGemFate.stats().shattered+=s;}
            if(k-s>0)poofed+=window.GempireGemFate?GempireGemFate.poof(p,c,k-s,{reason:'Atingida por desastre'}):0;
        });
        if(window.GempireOffColors)GempireOffColors.sync(p);
        return {poofed,shattered};
    }
    function damageKindergarten(p,bonus,minutes,reason){const h=hz(p);h.kgUntil=Math.max(h.kgUntil,now()+minutes*60000);h.kgBonus=Math.max(h.kgBonus,bonus);return reason;}
    function hasKindergarten(p){return count(p,'injector')>0||(p.veins||[]).some(v=>v.injector);}
    function warm(p,deg){p.temperatureC=Math.round(((Number(p.temperatureC)||0)+deg)*10)/10;p.seismicHeat=Math.min(100,(Number(p.seismicHeat)||0)+deg*1.5);}

    // ------------------------------------------------------------ desastres
    function solarStorm(p){
        const h=hz(p),shielded=count(p,'shield_generator')>0&&count(p,'reactor')>0;
        if(shielded&&Math.random()<.85){log(p,'storm','Tempestade solar desviada pelo Gerador de Escudo.','Sem dano');notify('O escudo de '+p.shortName+' conteve uma tempestade solar.');return;}
        const min=rnd(2,5);h.blackoutUntil=now()+min*60000;economy(p).energy=0;
        log(p,'storm','Tempestade solar: apagão de energia por '+dur(min*60)+'.','Produção a 60% · energia zerada');
        chronicle('Tempestade solar em '+p.shortName,'Uma tempestade solar derrubou a rede de energia.','Apagão');notify('Tempestade solar: apagão em '+p.shortName+'!',true);
    }
    function earthquake(p){
        const strength=Math.random()<.2?'forte':'moderado',lost=destroyStructures(p,strength==='forte'?rint(1,2):rint(0,1));
        let kg='';if(hasKindergarten(p)&&Math.random()<(strength==='forte'?.6:.35)){kg=damageKindergarten(p,.12,10,'jardim de infância abalado');if(Math.random()<.4)lost.push(...destroyStructures(p,1,['injector']));}
        p.dissent=Math.min(100,(Number(p.dissent)||0)+(strength==='forte'?6:3));
        const parts=[lost.length?'destruiu '+lost.join(', '):'sem estruturas destruídas',kg?'o jardim de infância foi atingido (+12% de Gems defeituosas por 10 min)':''].filter(Boolean);
        log(p,'quake','Terremoto '+strength+': '+parts.join('; ')+'.',lost.length?lost.length+' estrutura(s)':'');
        chronicle('Terremoto em '+p.shortName,'Terremoto '+strength+': '+parts.join('; ')+'.','Desastre');notify('Terremoto '+strength+' em '+p.shortName+'.',lost.length>0||!!kg);
    }
    function asteroid(p){
        const roll=Math.random(),size=roll<.6?'small':roll<.9?'medium':'large',S=SIZES[size],towers=count(p,'defense_tower');
        const intercept=Math.min(.9,towers*S.towerChance);
        if(towers&&Math.random()<intercept){log(p,'asteroid','Asteroide '+S.label+' interceptado pelas Torres de Defesa.','Sem dano');notify('As Torres de Defesa de '+p.shortName+' desviaram um asteroide '+S.label+'.');return;}
        const lost=destroyStructures(p,rint(S.structures[0],S.structures[1])),gems=hitGems(p,rint(S.gems[0],S.gems[1]),S.shatter);
        let kg='';if(hasKindergarten(p)&&Math.random()<({small:.15,medium:.35,large:.6})[size])kg=damageKindergarten(p,({small:.06,medium:.12,large:.2})[size],12,'jardim de infância atingido');
        // Minerais trazidos pelo impacto.
        const add=rint(S.minerals[0],S.minerals[1]),pools=p.resourcesByType=p.resourcesByType||{},kinds=[];
        for(let i=0;i<3;i++){const k=MINERALS[Math.floor(Math.random()*MINERALS.length)],n=Math.round(add/3);pools[k]=(Number(pools[k])||0)+n;kinds.push(k);}
        p.resourcesRemaining=(Number(p.resourcesRemaining)||0)+add;p.resourceTotal=(Number(p.resourceTotal)||0)+add;
        const deg=Math.round(rnd(S.heat[0],S.heat[1])*10)/10;warm(p,deg);
        const parts=[lost.length?'destruiu '+lost.join(', '):'',gems.poofed?gems.poofed+' Gem(s) poofada(s)':'',gems.shattered?gems.shattered+' estilhaçada(s)':'',kg,'+'+fmt(add)+' minerais novos','+'+deg+' °C'].filter(Boolean);
        log(p,'asteroid','Asteroide '+S.label+' atingiu '+p.shortName+': '+parts.join(' · ')+'.',size==='large'?'Impacto grave':'Impacto');
        chronicle('Asteroide '+S.label+' em '+p.shortName,parts.join(' · ')+'.','Impacto');notify('Asteroide '+S.label+' atingiu '+p.shortName+'!',true);
    }
    function rebelAttack(p){
        const r=p.resistance;if(!r)return;
        if(r.forewarned&&Math.random()<.7){r.forewarned=false;log(p,'ambush','Uma emboscada rebelde prevista pelas Safiras foi frustrada.','Sem dano');return;}
        const census=censusOf(p),escort=(Number(census.ruby)||0)+(Number(census.topaz)||0)*2,fusion=r.members>=6&&Math.random()<.4;
        const power=(r.strength/10+r.members*.4)*(fusion?1.6:1),guard=Math.max(1,escort);
        // Diamante com pouca escolta pode ser emboscada.
        const g=String(p.governor||''),m=g.startsWith('matriarch_')?(state.matriarchs||[]).find(x=>'matriarch_'+x.id===g):null;
        if(m&&m.courtStatus==='court'&&escort<6&&Math.random()<Math.min(.6,power/(guard*3+10))){
            m.prevStatus='court';m.courtStatus='poofed';m.reformAt=now()+rnd(240,420)*1000;m.loyalty=clamp((Number(m.loyalty)||0)-6);
            log(p,'ambush',(fusion?'Uma fusão rebelde emboscou ':'Rebeldes emboscaram ')+m.name+' com pouca escolta: ela foi poofada.','Diamante fora de ação');
            chronicle('Emboscada a '+m.name,'Rebeldes poofaram '+m.name+' em '+p.shortName+'. Ela culpa a falta de escolta.','Diamante poofada');notify(m.name+' foi emboscada e poofada em '+p.shortName+'!',true);
            return;
        }
        const targets=ARISTOCRATS.filter(k=>Number(census[k])>0),n=Math.max(1,Math.round(power/Math.sqrt(guard)));
        if(!targets.length){const hit=hitGems(p,Math.min(n,6),r.leader&&r.leader.type==='radical'?.3:.1,WORKERS);log(p,'ambush',(fusion?'Uma fusão rebelde atacou':'Rebeldes atacaram')+' trabalhadoras: '+hit.poofed+' poofada(s)'+(hit.shattered?', '+hit.shattered+' estilhaçada(s)':'')+'.','Ataque rebelde');notify('Ataque rebelde em '+p.shortName+'.',true);return;}
        const hit=hitGems(p,Math.min(n,4),r.leader&&r.leader.type==='radical'?.3:.1,targets);
        log(p,'ambush',(fusion?'Uma fusão rebelde emboscou':'Rebeldes emboscaram')+' aristocratas com pouca companhia: '+hit.poofed+' poofada(s)'+(hit.shattered?', '+hit.shattered+' estilhaçada(s)':'')+'. Escolta atual: '+escort+'.','Emboscada');
        chronicle('Emboscada em '+p.shortName,'Rebeldes atacaram aristocratas desprotegidas.',hit.poofed+' poofadas');notify('Emboscada rebelde a aristocratas em '+p.shortName+'!',true);
    }
    function eruption(p){
        const h=hz(p),strength=Math.round(rnd(40,90));
        h.lava={strength,startedAt:now(),endsAt:now()+15*60000};
        const lost=hasKindergarten(p)?destroyStructures(p,rint(1,2),['injector']):[];
        (p.veins||[]).forEach(v=>{if(v.injector&&Math.random()<.5)v.injector=null;});
        const f=p.id===activeId()?state.founding:ensurePlanetEconomy(p,false).founding;(f?.creationBatches||[]).forEach(b=>{if(b&&!b.completed&&Math.random()<.5)b.progress=0;});
        const deg=Math.round(rnd(3,8)*10)/10;warm(p,deg);p.dissent=Math.min(100,(Number(p.dissent)||0)+5);
        log(p,'eruption','Erupção vulcânica: a lava destruiu '+(lost.length?lost.join(', '):'parte dos lotes do jardim de infância')+' e aqueceu o planeta (+'+deg+' °C). A lava continua avançando.','Lava ativa');
        chronicle('Erupção em '+p.shortName,'A lava avança pelo jardim de infância. Obsidianas Floco de Neve podem contê-la.','Lava ativa');notify('Erupção vulcânica em '+p.shortName+'! Use Obsidianas Floco de Neve para conter a lava.',true);
    }
    function lavaTick(p,minutes){
        const h=hz(p),L=h.lava;if(!L)return;
        if(now()>=L.endsAt||L.strength<=0){h.lava=null;log(p,'eruption','A lava esfriou e a erupção terminou.','');notify('A lava em '+p.shortName+' esfriou.');return;}
        L.strength=Math.max(0,L.strength-minutes*2);
        if(Math.random()<.2*minutes*(L.strength/60))destroyStructures(p,1,['injector','mineral_extractor','refinery']);
        if(Math.random()<.25*minutes)hitGems(p,rint(1,3),.05,WORKERS);
        p.temperatureC=(Number(p.temperatureC)||0)+.3*minutes;
    }
    function containLava(planetId){
        const p=PLANETS[planetId],h=p&&hz(p);if(!h||!h.lava)return;
        const n=Math.floor(Number(censusOf(p).snowflake_obsidian)||0);if(!n){notify('É preciso pelo menos uma Obsidiana Floco de Neve em '+p.shortName+'.',true);return;}
        if(h.containUntil>now()){notify('As Obsidianas já estão resfriando a lava.',true);return;}
        const cut=Math.min(h.lava.strength,20+n*15);h.lava.strength-=cut;h.containUntil=now()+45000;p.temperatureC=(Number(p.temperatureC)||0)-Math.min(5,n*.8);
        log(p,'eruption',n+' Obsidiana(s) Floco de Neve resfriaram a lava (−'+cut+' de intensidade).','Contenção');
        if(h.lava.strength<=0){h.lava=null;log(p,'eruption','A lava foi contida.','Erupção encerrada');notify('A erupção em '+p.shortName+' foi contida.');}
        refresh();
    }
    // Nativos: hostilidade cresce com a exploração; ataques acima de 40.
    function nativesTick(p,minutes){
        if(!p.organicLifePresent)return;const N=hz(p).natives,dep=depletion(p);
        if(N.truceUntil>now()){N.hostility=Math.max(0,N.hostility-minutes*1.5);return;}
        N.hostility=clamp(N.hostility+(dep*1.2+(count(p,'injector')>0?.3:0)+(count(p,'mineral_extractor')>0?.3:0)-.25)*minutes*mult());
        if(N.hostility>40&&Math.random()<(N.hostility-40)/60*.15*minutes){
            const hit=hitGems(p,1+Math.floor(N.hostility/15),.05,WORKERS),lost=Math.random()<.25?destroyStructures(p,1):[];
            p.dissent=Math.min(100,(Number(p.dissent)||0)+5);N.hostility=Math.max(0,N.hostility-10);N.lastAttack=now();
            log(p,'natives','Os nativos atacaram as operações: '+hit.poofed+' Gem(s) poofada(s)'+(lost.length?', '+lost.join(', ')+' destruída(s)':'')+'.','Retaliação');
            chronicle('Retaliação de nativos em '+p.shortName,'A espécie nativa reagiu à colonização com violência.','Ataque');notify('Os nativos de '+p.shortName+' atacaram!',true);
        }
    }
    function repelNatives(planetId){
        const p=PLANETS[planetId],N=p&&hz(p).natives;if(!N)return;
        const census=censusOf(p),soldiers=(Number(census.quartz)||0)+(Number(census.ruby)||0)*1.5+(Number(census.topaz)||0)*3;if(soldiers<5){notify('Tropas insuficientes para repelir os nativos.',true);return;}
        const losses=hitGems(p,Math.max(1,Math.round(N.hostility/12)),0,['quartz','ruby','topaz']);
        N.hostility=Math.max(0,N.hostility-50);p.organicLifePopulation=Math.round((Number(p.organicLifePopulation)||0)*.85);
        (state.matriarchs||[]).forEach(m=>{const t={militarist:'h',isolationist:'h',manipulator:'h',melancholic:'g',empathic:'g',naturalist:'g'}[m.personalityId];if(t==='g')m.loyalty=clamp((Number(m.loyalty)||0)-4);if(t==='h')m.loyalty=clamp((Number(m.loyalty)||0)+2);});
        log(p,'natives','Tropas repeliram os nativos: '+losses.poofed+' soldado(s) poofado(s); a população nativa caiu 15%.','Hostilidade −50');chronicle('Nativos repelidos em '+p.shortName,'A força imperial dispersou os nativos.','População nativa −15%');refresh();
    }
    function treatyNatives(planetId){
        const p=PLANETS[planetId],N=p&&hz(p).natives;if(!N)return;
        const ess=typeof essenceValue==='function'?essenceValue(state.essence):0;if((Number(state.minerals)||0)<200||ess<50){notify('O tratado exige 200 minerais e 50 de essência.',true);return;}
        state.minerals-=200;state.essence=ess-50;N.truceUntil=now()+30*60000;N.hostility=Math.max(0,N.hostility-60);
        (state.matriarchs||[]).forEach(m=>{const t={melancholic:'g',empathic:'g',naturalist:'g',militarist:'h'}[m.personalityId];if(t==='g')m.loyalty=clamp((Number(m.loyalty)||0)+4);if(t==='h')m.loyalty=clamp((Number(m.loyalty)||0)-2);});
        log(p,'natives','Tratado de convivência com os nativos por 30 minutos.','Hostilidade −60');chronicle('Tratado com nativos em '+p.shortName,'O Império firmou um tratado de convivência.','Trégua de 30 minutos');refresh();
    }

    // ------------------------------------------------------------ riscos e ciclo
    function risks(p){
        const h=hz(p),lum=starLum(p),heat=Number(p.seismicHeat)||0,volcanic=(p.surfaceProfile?.biome==='volcanic')||heat>50,res=p.resistance;
        return {
            storm:.012*Math.min(2.5,.6+lum*.25),
            quake:.01+heat/100*.03+depletion(p)*.015,
            asteroid:.01,
            eruption:volcanic&&!h.lava?.015*Math.max(.6,heat/50):0,
            ambush:res&&res.phase>=2?.015+res.strength/100*.05:0
        };
    }
    let acc=0;
    function update(dt){
        if(!state||!state.firstGameStarted)return;
        acc+=Math.max(0,Math.min(5,Number(dt)||0));if(acc<10)return;const step=acc;acc=0;
        if((Number(state.gameClock)||0)<600)return; // dez minutos de carência no início da partida
        const minutes=step/60,m=mult();
        Object.values(PLANETS).filter(p=>p&&p.colonized).forEach(p=>{
            const h=hz(p);if(h.kgUntil&&h.kgUntil<=now()){h.kgUntil=0;h.kgBonus=0;}
            lavaTick(p,minutes);nativesTick(p,minutes);
            const r=risks(p);
            if(Math.random()<r.storm*minutes*m)solarStorm(p);
            else if(Math.random()<r.quake*minutes*m)earthquake(p);
            else if(Math.random()<r.asteroid*minutes*m)asteroid(p);
            else if(r.eruption&&Math.random()<r.eruption*minutes*m)eruption(p);
            else if(r.ambush&&Math.random()<r.ambush*minutes*m)rebelAttack(p);
        });
        uiTimer-=step;if(uiTimer<=0){uiTimer=3;if(uiGate(2000))renderIfVisible();}
    }
    let uiTimer=3;
    function yieldFactor(p){if(!p||!p.hazards)return 1;const h=hz(p);let f=1;if(h.blackoutUntil>now())f*=.6;if(h.lava)f*=.7;return f;}
    function offColorBonus(p){if(!p||!p.hazards)return 0;const h=hz(p);return h.kgUntil>now()?h.kgBonus:0;}
    function refresh(){try{updateHUD();}catch(e){}renderIfVisible();}
    function renderIfVisible(){if(state.currentScreen==='governance'&&state.governanceSection==='disasters'){const el=document.getElementById('governance-content');if(el&&!el.contains(document.activeElement))render(el);}}

    // ------------------------------------------------------------ interface
    const KIND={storm:'Tempestade solar',quake:'Terremoto',asteroid:'Asteroide',ambush:'Ataque rebelde',eruption:'Erupção vulcânica',natives:'Nativos'};
    function meter(label,v,color){const perMin=v*mult(),pct=Math.round(Math.min(1,perMin/.06)*100);return '<div class="court-bar"><span>'+label+'</span><div><i style="width:'+pct+'%;background:'+color+'"></i></div><b>'+(perMin*100).toFixed(1)+'%</b></div>';}
    function render(container){
        const planets=Object.values(PLANETS).filter(p=>p&&p.colonized);
        let html='<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">Desastres</span><span class="badge">Intensidade '+(({rare:'Rara',moderate:'Moderada',constant:'Constante'})[state.rebellionIntensity]||'Moderada')+'</span></div><p class="governance-muted">Tempestades solares, terremotos, asteroides, erupções, emboscadas rebeldes e retaliação de nativos podem atingir as colônias. Gerador de Escudo com Reator bloqueia tempestades; Torres de Defesa interceptam asteroides; Rubis e Topázios escoltam aristocratas e Diamantes; Obsidianas Floco de Neve contêm a lava. Os riscos abaixo são a chance aproximada por minuto de jogo.</p>'+((Number(state.gameClock)||0)<600?'<small style="color:#6ee7b7">Período de carência: os desastres começam após os primeiros 10 minutos de jogo.</small>':'')+'</section>';
        html+='<section class="card order-colonies"><div class="card-header"><span class="card-title">Colônias</span><span class="badge">'+planets.length+'</span></div>'+planets.map(p=>{
            const h=hz(p),r=risks(p),N=h.natives,c=censusOf(p);
            let b='<div class="order-planet"><div class="court-row"><b>'+esc(p.shortName)+'</b><span class="badge">'+Math.round(Number(p.temperatureC)||0)+' °C · calor sísmico '+Math.round(Number(p.seismicHeat)||0)+'</span></div>';
            const active=[];if(h.blackoutUntil>now())active.push('<span class="badge dz-bad">Apagão · '+dur((h.blackoutUntil-now())/1000)+'</span>');if(h.kgUntil>now())active.push('<span class="badge dz-bad">Jardim de infância danificado · +'+Math.round(h.kgBonus*100)+'% off-colors · '+dur((h.kgUntil-now())/1000)+'</span>');if(h.lava)active.push('<span class="badge dz-bad">Lava ativa · intensidade '+Math.round(h.lava.strength)+'</span>');
            if(active.length)b+='<div class="order-groups">'+active.join(' ')+'</div>';
            b+=meter('Tempestade',r.storm,'#facc15')+meter('Terremoto',r.quake,'#d97706')+meter('Asteroide',r.asteroid,'#94a3b8')+(r.eruption?meter('Erupção',r.eruption,'#f97316'):'')+(r.ambush?meter('Emboscada',r.ambush,'#fb7185'):'');
            b+='<small style="display:block;color:var(--text-muted)">Defesas: '+count(p,'shield_generator')+' Escudo(s)'+(count(p,'reactor')?'':' sem Reator')+' · '+count(p,'defense_tower')+' Torre(s) · escolta '+((Number(c.ruby)||0)+(Number(c.topaz)||0)*2)+' (Rubis + Topázios×2) · '+(Number(c.snowflake_obsidian)||0)+' Obsidiana(s) Floco de Neve</small>';
            if(h.lava)b+='<div class="court-actions"><button class="btn btn-emerald" '+((Number(c.snowflake_obsidian)||0)&&!(h.containUntil>now())?'':'disabled')+' onclick="GempireDisasters.containLava(\''+p.id+'\')">Conter a lava com Obsidianas Floco de Neve'+(h.containUntil>now()?' · resfriando':'')+'</button></div>';
            if(p.organicLifePresent){b+='<div class="court-subtitle">Nativos</div>'+'<div class="court-bar"><span>Hostilidade</span><div><i style="width:'+N.hostility+'%;background:'+(N.hostility>40?'#fb7185':'#f2cf86')+'"></i></div><b>'+Math.round(N.hostility)+'%</b></div><small style="display:block;color:var(--text-muted)">População nativa: '+fmt(p.organicLifePopulation)+'. A hostilidade cresce com a extração e o esgotamento; acima de 40% eles atacam.'+(N.truceUntil>now()?' Tratado em vigor por '+dur((N.truceUntil-now())/1000)+'.':'')+'</small><div class="court-actions"><button class="btn btn-pink" onclick="GempireDisasters.repelNatives(\''+p.id+'\')">Repelir (força)</button><button class="btn btn-emerald" '+(N.truceUntil>now()?'disabled':'')+' onclick="GempireDisasters.treatyNatives(\''+p.id+'\')">Tratado · 200 minerais + 50 essência</button></div>';}
            return b+'</div>';
        }).join('')+'</section>';
        const L=Array.isArray(state.disasterLog)?state.disasterLog:[];
        html+='<section class="card"><div class="card-header"><span class="card-title">Registro de desastres</span></div>'+(L.length?L.slice(0,14).map(e=>'<div class="court-log dz-'+e.kind+'"><span><b>'+esc(KIND[e.kind]||e.kind)+' · '+esc(e.planet)+':</b> '+esc(e.text)+'</span>'+(e.impact?'<small>'+esc(e.impact)+' · ciclo '+e.cycle+'</small>':'')+'</div>').join(''):'<p class="governance-muted">Nenhum desastre registrado.</p>')+'</section>';
        container.innerHTML=html;
    }
    window.GempireDisasters={update,yieldFactor,offColorBonus,containLava,repelNatives,treatyNatives,render,trigger:{storm:solarStorm,quake:earthquake,asteroid,ambush:rebelAttack,eruption,natives:p=>{hz(p).natives.hostility=90;nativesTick(p,10);}},_hz:hz};
    window.renderDisastersTab=render;
})();
