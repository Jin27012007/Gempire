/* =========================================================================
 * GEMPIRE · Resistência (fase 2 de rebeldes e off-colors)
 *
 * Cada colônia tem uma resistência com força oculta (0–100) e fases:
 *   0 Calma · 1 Descontentamento · 2 Células clandestinas · 3 Insurreição · 4 Mundo rebelde
 * Ela cresce com dissidência, off-colors escondidas, leis duras, ordem baixa,
 * planeta esgotado e Matriarca rebelde no governo; diminui quando a colônia está calma.
 *  - Células sabotam: produção cai, minerais somem, injetores param, Gems desertam.
 *  - Insurreição bloqueia veios e derruba a produção.
 *  - Mundo rebelde para de produzir, expulsa a governante e espalha a revolta.
 * A colônia nunca sai do Império: sempre pode ser retomada.
 * A antiga pacificação instantânea virou a Operação de contenção, com custo,
 * duração e chance ligadas à força rebelde e à guarnição local.
 * Estado salvo em planet.resistance.
 * ========================================================================= */
(function(){
    'use strict';
    const PHASES=[
        {label:'Calma',min:0,color:'#6ee7b7',desc:'Sem sinais de organização rebelde.'},
        {label:'Descontentamento',min:10,color:'#f2cf86',desc:'Rumores e queixas. A dissidência cresce mais rápido.'},
        {label:'Células clandestinas',min:30,color:'#fb923c',desc:'Grupos organizados sabotam a colônia em segredo.'},
        {label:'Insurreição',min:55,color:'#fb7185',desc:'Veios tomados e produção reduzida a 60%.'},
        {label:'Mundo rebelde',min:80,color:'#e11d48',desc:'A colônia parou de produzir, expulsou a governante e espalha a revolta.'}
    ];
    const SABOTAGE={production:'Sabotagem da produção',theft:'Roubo de minerais',injector:'Injetor danificado',recruit:'Deserção de Gems'};
    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    const mult=()=>({rare:.5,moderate:1,constant:1.8})[state.rebellionIntensity]||1;
    const dur=s=>typeof formatDuration==='function'?formatDuration(s):Math.ceil(s)+'s';
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function censusOf(p){return p.id===activeId()?(state.census||(state.census={})):(ensurePlanetEconomy(p,false).census||{});}
    function setCensus(p,c){if(p.id===activeId())state.census=c;else ensurePlanetEconomy(p,false).census=c;}
    function economyOf(p){return p.id===activeId()?state:ensurePlanetEconomy(p,false);}
    function res(p){
        const fresh=!(p.resistance&&typeof p.resistance==='object');
        const r=p.resistance=fresh?{}:p.resistance;
        // Saves antigos: rebelião ativa vira insurreição; dissidência alta vira células.
        if(fresh){if(p.rebellionActive){r.strength=62;r.phase=3;r.detected=true;}else if(Number(p.dissent)>=70){r.strength=35;r.phase=2;}}
        r.strength=clamp(r.strength);r.phase=Math.max(0,Math.min(4,Math.floor(Number(r.phase)||0)));r.members=Math.max(0,Math.floor(Number(r.members)||0));
        r.sabotageTimer=Number.isFinite(r.sabotageTimer)?r.sabotageTimer:180;r.spreadTimer=Number.isFinite(r.spreadTimer)?r.spreadTimer:240;
        r.log=Array.isArray(r.log)?r.log:[];r.sabotageUntil=Number(r.sabotageUntil)||0;
        r.memberCastes=r.memberCastes&&typeof r.memberCastes==='object'?r.memberCastes:{};
        r.cooldowns=r.cooldowns&&typeof r.cooldowns==='object'?r.cooldowns:{};
        r.intelUntil=Number(r.intelUntil)||0;r.truceUntil=Number(r.truceUntil)||0;r.galleryIntelUntil=Number(r.galleryIntelUntil)||0;
        return r;
    }
    function phaseFor(r){
        // Histerese: para descer de fase a força precisa cair 5 pontos abaixo do limite.
        let ph=0;for(let i=PHASES.length-1;i>=0;i--){if(r.strength>=PHASES[i].min){ph=i;break;}}
        if(ph<r.phase&&r.strength>=PHASES[r.phase].min-5)ph=r.phase;
        return ph;
    }
    function rlog(p,text){const r=res(p);r.log.unshift({text,at:Date.now(),cycle:Number(state.cycleCount)||1});r.log.length=Math.min(r.log.length,8);}
    function hiddenOffColors(p){return Math.max(0,Number(p.offColors?.hidden)||0);}
    function policyKey(){return window.GempireOffColors?GempireOffColors.policy():'recycle';}
    function rebelGovernor(p){const g=String(p.governor||'');if(!g.startsWith('matriarch_'))return null;const m=(state.matriarchs||[]).find(x=>'matriarch_'+x.id===g);return m&&m.courtStatus==='rebel'?m:null;}
    function depletion(p){return Number(p.resourceTotal)>0?1-(Number(p.resourcesRemaining)||0)/Number(p.resourceTotal):0;}

    // Força da guarnição local: soldados da colônia (off-colors e desertoras não contam).
    function garrison(p){
        const c=censusOf(p),off=p.offColors?.groups||{};
        const offBy=c2=>Object.entries(off).filter(([k])=>k.startsWith(c2+'|')).reduce((a,[,n])=>a+n,0);
        const n=k=>Math.max(0,(Number(c[k])||0)-offBy(k));
        let power=n('quartz')+n('ruby')*1.5+n('topaz')*3+n('agate')*4+n('nephrite')*.5;
        power*=1+Math.min(.6,(n('hessonite')+n('pyrope')+n('emerald'))*.1);
        return power;
    }
    // Temperamento da governante (Matriarca) sobre a resistência da colônia que ela administra.
    const TONE_OF={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const STANCE={harsh:{label:'Linha-dura',growth:.15,contain:.1},gentle:{label:'Conciliadora',growth:-.2,contain:-.05},cerebral:{label:'Pragmática',growth:-.05,contain:.05},grand:{label:'Indiferente',growth:.05,contain:0}};
    function governorOf(p){const g=String(p.governor||'');if(!g.startsWith('matriarch_'))return null;return (state.matriarchs||[]).find(x=>'matriarch_'+x.id===g)||null;}
    function stanceOf(m){return m?STANCE[TONE_OF[m.personalityId]||'grand']:null;}
    function containStats(p){
        const r=res(p),g=garrison(p),gs=stanceOf(governorOf(p));
        const chance=clamp(.3+(g/(r.strength*3+r.members*2+10))*.35+(gs?gs.contain:0),.1,.95);
        return {cost:Math.round(20+r.strength*1.2),duration:Math.round(45+r.strength*1.5),chance,garrison:g};
    }

    // ------------------------------------------------------------ crescimento
    function growthPerMinute(p){
        const r=res(p),dissent=Number(p.dissent)||0,order=Number(state.order)||100,pol=policyKey();
        let g=(dissent-30)/40;
        g+=Math.min(1.5,hiddenOffColors(p)*.03);
        g+=({bubble:.05,recycle:.15,purge:.5,tolerate:0,sanctuary:-.2,citizen:-.25})[pol]||0;
        if(order<50)g+=(50-order)/50*.5;
        g+=depletion(p)*.3;
        if(p.organicLifePresent&&depletion(p)>.3)g+=.2;
        if(rebelGovernor(p))g+=2;
        else{const gs=stanceOf(governorOf(p));if(gs)g+=gs.growth;}
        if(r.phase>=3)g+=.2; // insurreição se alimenta
        if(g>0)g*=mult();else g*=1/Math.max(.5,mult());
        if(dissent<15&&!rebelGovernor(p))g-=.6;
        if(r.truceUntil>Date.now())g=Math.min(g,-.4);
        return g;
    }
    // ------------------------------------------------------------ sabotagens
    function sabotage(p){
        const r=res(p);
        if(r.forewarned&&Math.random()<.7){r.forewarned=false;rlog(p,'Uma sabotagem prevista pelas Safiras foi impedida.');notify('As Safiras previram e impediram uma sabotagem em '+p.shortName+'.');return;}
        r.forewarned=false;r.detected=true;
        const types=['production','theft','injector','recruit'];if(r.strength<40)types.splice(types.indexOf('recruit'),1);
        const type=types[Math.floor(Math.random()*types.length)],eco=economyOf(p);let text='';
        if(type==='production'){r.sabotageUntil=Date.now()+180000;text='a produção de '+p.shortName+' caiu 25% por 3 minutos';}
        else if(type==='theft'){const n=Math.min(600,Math.floor((Number(eco.minerals)||0)*.1));eco.minerals=Math.max(0,(Number(eco.minerals)||0)-n);r.supplies=(Number(r.supplies)||0)+n;text=fmt(n)+' minerais desapareceram dos depósitos de '+p.shortName;}
        else if(type==='injector'){
            const vein=(p.veins||[]).find(v=>v.injector);
            if(vein){vein.injector=null;text='um injetor de '+p.shortName+' foi destruído (lote perdido)';}
            else{const f=p.id===activeId()?state.founding:ensurePlanetEconomy(p,false).founding;const b=(f?.creationBatches||[]).find(x=>x&&!x.completed);if(b){b.progress=0;text='um lote de Gems em '+p.shortName+' voltou ao início';}else{r.sabotageUntil=Date.now()+120000;text='os injetores de '+p.shortName+' foram avariados (−25% por 2 minutos)';}}
        }
        else{
            const census=Object.assign({},censusOf(p)),keys=Object.keys(census).filter(k=>!['prime','offcolor'].includes(k)&&Number(census[k])>0&&!['hessonite','pyrope','emerald','topaz','morganite','aquamarine','sapphire'].includes(k));
            if(!keys.length){r.sabotageUntil=Date.now()+120000;text='a produção de '+p.shortName+' foi sabotada';}
            else{
                // Off-colors desertam primeiro.
                const off=p.offColors?.groups||{},offKey=Object.keys(off).find(k=>off[k]>0);
                const caste=offKey?offKey.split('|')[0]:keys[Math.floor(Math.random()*keys.length)];
                const n=Math.min(Number(census[caste])||0,1+Math.floor(r.strength/20));
                census[caste]=Math.max(0,(Number(census[caste])||0)-n);setCensus(p,census);
                if(offKey){off[offKey]=Math.max(0,off[offKey]-n);if(!off[offKey])delete off[offKey];if(window.GempireOffColors)GempireOffColors.sync(p);}
                for(let i=(p.walkingGems||[]).length-1,k=n;i>=0&&k>0;i--){const g=p.walkingGems[i];if(g&&(g.caste||g.type)===caste){p.walkingGems.splice(i,1);k--;}}
                const key=caste+(offKey?'|off':'');r.memberCastes[key]=(r.memberCastes[key]||0)+n;
                r.members+=n;text=n+' '+(FOUNDING_GEM_DATA?.[caste]?.label||caste)+(offKey?' off-color':'')+' desertaram para os rebeldes em '+p.shortName;
            }
        }
        rlog(p,SABOTAGE[type]+': '+text+'.');notify('Rebeldes: '+text+'.',true);
        chronicle('Sabotagem em '+p.shortName,text.charAt(0).toUpperCase()+text.slice(1)+'.',SABOTAGE[type]);
    }
    function applyInsurrection(p,r){
        // Veios bloqueados crescem com a força.
        const want=r.phase>=3?Math.min((p.veins||[]).length,1+Math.floor((r.strength-55)/10)):0;
        const blocked=(p.veins||[]).filter(v=>v.rebelBlocked);
        if(blocked.length<want){const free=(p.veins||[]).filter(v=>!v.rebelBlocked);const v=free[Math.floor(Math.random()*free.length)];if(v){v.rebelBlocked=true;if(v.injector)v.injector=null;rlog(p,'Rebeldes tomaram o veio '+(v.label||('#'+(v.id+1)))+'.');}}
        else if(blocked.length>want){blocked[0].rebelBlocked=false;rlog(p,'O veio '+(blocked[0].label||'')+' foi retomado.');}
        p.rebellionActive=r.phase>=3;
    }
    function enterPhase(p,r,from,to){
        r.phase=to;
        if(to>=4&&from<4){
            const g=String(p.governor||'');if(g&&g!=='none'&&!rebelGovernor(p)){r.expelledGovernor=g;p.governor='none';}
            rlog(p,'A colônia se declarou rebelde e expulsou a governante.');chronicle('Mundo rebelde: '+p.shortName,'A resistência tomou o controle de '+p.shortName+'. A produção parou e a revolta pode se espalhar.','Mundo rebelde');
        }
        if(from>=4&&to<4&&r.expelledGovernor){const id=r.expelledGovernor.replace('matriarch_','');const m=(state.matriarchs||[]).find(x=>x.id===id);if(m&&m.courtStatus!=='rebel'&&!Object.values(PLANETS).some(o=>o!==p&&o.governor===r.expelledGovernor))p.governor=r.expelledGovernor;r.expelledGovernor=null;}
        const up=to>from,label=PHASES[to].label;
        rlog(p,(up?'A resistência avançou para ':'A resistência recuou para ')+label+'.');
        if(to>=2||from>=2)notify((up?'⚠ ':'')+p.shortName+': '+label+'.',up);
        if(up&&to>=3)chronicle(label+' em '+p.shortName,PHASES[to].desc,'Ordem pública');
    }
    // ------------------------------------------------------------ rede rebelde (fase 4)
    // Colônias em insurreição ou rebeldes enviam agitadores (às vezes com a própria
    // líder). Eles viajam até a colônia mais vulnerável e próxima; podem ser
    // detectados e interceptados por naves em órbita na origem ou no destino.
    function net(){const n=state.resistanceNet=state.resistanceNet&&typeof state.resistanceNet==='object'?state.resistanceNet:{};n.transits=Array.isArray(n.transits)?n.transits:[];n.nextId=Number(n.nextId)||1;return n;}
    function travelSeconds(a,b){if(a.galaxyWarpBuilt&&b.galaxyWarpBuilt)return 30;return typeof getSpaceTravelSeconds==='function'?Math.max(60,Math.round(getSpaceTravelSeconds(a.id,b.id)*.5)):180;}
    function pickTarget(p){
        const others=Object.values(PLANETS).filter(o=>o.colonized&&o!==p&&res(o).phase<4);if(!others.length)return null;
        // Mais atraente: perto, com dissidência alta e guarnição fraca.
        const score=o=>{const d=typeof getSpaceDistance==='function'?getSpaceDistance(p.id,o.id):1;return (Number(o.dissent)||0)/20+res(o).strength/25-Math.min(4,garrison(o)/150)-d*.6+(o.systemId===p.systemId?1.5:0)+Math.random()*1.5;};
        return others.sort((x,y)=>score(y)-score(x))[0];
    }
    function spread(p){
        const r=res(p),target=pickTarget(p);if(!target)return;
        const amount=Math.round((r.phase>=4?8:5)*mult()),withLeader=r.phase>=4&&r.leader&&r.leader.identified&&Math.random()<.25;
        const n=net(),eta=travelSeconds(p,target);
        // Detecção: inteligência ativa na origem, Safiras no destino ou sorte.
        const detected=r.intelUntil>Date.now()||Number(censusOf(target).sapphire)>0||Math.random()<.4;
        const t={id:n.nextId++,from:p.id,to:target.id,eta,total:eta,amount,leader:withLeader?Object.assign({},r.leader):null,detected};
        n.transits.push(t);
        if(withLeader){rlog(p,r.leader.name+' partiu para inflamar '+target.shortName+'.');r.leader=null;}
        if(detected){rlog(p,'Agitadores partiram rumo a '+target.shortName+' (chegam em '+dur(eta)+').');notify('Agitadores rebeldes de '+p.shortName+' seguem para '+target.shortName+'.',true);}
    }
    function arrive(t){
        const from=PLANETS[t.from],to=PLANETS[t.to];if(!to||!to.colonized)return;
        const tr=res(to),shield=Math.min(.6,garrison(to)/400),add=Math.max(1,Math.round(t.amount*(1-shield)));
        tr.strength=clamp(tr.strength+add);to.dissent=Math.min(100,(Number(to.dissent)||0)+8*(1-shield));
        if(t.leader&&!tr.leader){tr.leader=Object.assign({},t.leader,{identified:false});tr.strength=clamp(tr.strength+10);rlog(to,'Uma líder rebelde vinda de '+(from?.shortName||'outra colônia')+' chegou em segredo.');}
        rlog(to,'Agitadores vindos de '+(from?.shortName||'outra colônia')+' chegaram (+'+add+' de força rebelde'+(shield>.05?', a guarnição conteve parte':'')+').');
        if(from)rlog(from,'A revolta se espalhou para '+to.shortName+'.');
        notify('Agitadores de '+(from?.shortName||'outra colônia')+' chegaram a '+to.shortName+'.',true);
    }
    function interceptors(t){
        return (state.shipFleet||[]).filter(sh=>sh&&sh.status==='orbital'&&[t.from,t.to].includes(sh.planetId)&&['war','excursion','ruby','elite','diamond'].includes(sh.type));
    }
    function intercept(id){
        const n=net(),t=n.transits.find(x=>x.id===id);if(!t)return;
        const ships=interceptors(t);if(!ships.length){notify('Nenhuma nave em órbita na origem ou no destino para interceptar.',true);return;}
        const best=ships.sort((a,b)=>({war:4,diamond:3,elite:2,ruby:2,excursion:1}[b.type]||0)-({war:4,diamond:3,elite:2,ruby:2,excursion:1}[a.type]||0))[0];
        const chance={war:.9,diamond:.85,elite:.75,ruby:.75,excursion:.6}[best.type]||.6;
        n.transits=n.transits.filter(x=>x!==t);const from=PLANETS[t.from],to=PLANETS[t.to];
        if(Math.random()<chance){
            if(t.leader&&to){const place=[to,from].find(x=>x&&window.GempireGemFate&&GempireGemFate.freeSpace(x)>0);if(place){GempireGemFate.bubble(place,t.leader.caste&&t.leader.caste!=='diamond'?t.leader.caste:'quartz','leader',!!t.leader.offcolor,null);rlog(place,'A líder '+t.leader.name+' foi poofada em trânsito e embolhada.');}else rlog(to,'A líder '+t.leader.name+' foi poofada em trânsito, mas sem Sala das Bolhas a gema se reformou e fugiu.');}
            if(to)rlog(to,'A '+best.name+' interceptou agitadores vindos de '+(from?.shortName||'outra colônia')+'.');notify('Agitadores interceptados pela '+best.name+'.');
            if(typeof addChronicle==='function')addChronicle('Interceptação','A '+best.name+' deteve agitadores rebeldes a caminho de '+(to?.shortName||'uma colônia')+'.','Revolta contida');
        }else{n.transits.push(Object.assign(t,{eta:Math.max(10,t.eta*.5)}));notify('Os agitadores escaparam da '+best.name+'.',true);}
        refresh();
    }
    function updateNet(step){
        const n=net();
        n.transits.slice().forEach(t=>{t.eta-=step;if(!t.detected&&t.eta<t.total*.35&&Math.random()<.3)t.detected=true;if(t.eta<=0){n.transits=n.transits.filter(x=>x!==t);arrive(t);}});
    }
    // Uma Matriarca rebelde assume a liderança da resistência da colônia que governava.
    function matriarchLeader(p,r){
        const m=rebelGovernor(p);
        if(m&&(!r.leader||!r.leader.matriarchId)){r.leader={name:m.name,caste:'diamond',offcolor:false,type:'radical',identified:true,matriarchId:m.id};rlog(p,m.name+' assumiu a liderança da resistência.');}
        if(r.leader&&r.leader.matriarchId){const m2=(state.matriarchs||[]).find(x=>x.id===r.leader.matriarchId);if(!m2||m2.courtStatus!=='rebel'){rlog(p,(m2?.name||'A Matriarca')+' deixou a liderança rebelde.');r.leader=null;}}
    }
    // ------------------------------------------------------------ operação de contenção
    function contain(planetId){
        const p=PLANETS[planetId||activeId()];if(!p||!p.colonized)return;
        const r=res(p);if(r.operation){notify('Já há uma operação de contenção em '+p.shortName+'.',true);return;}
        if(r.strength<10&&!p.rebellionActive){notify(p.shortName+' não tem resistência organizada para conter.',true);return;}
        const st=containStats(p),ess=essenceValue(state.essence);
        if(ess<st.cost){notify('A operação de contenção exige '+st.cost+' de essência.',true);return;}
        state.essence=ess-st.cost;
        r.operation={progress:0,duration:st.duration,chance:st.chance,garrison:st.garrison};
        rlog(p,'Operação de contenção iniciada ('+Math.round(st.chance*100)+'% de chance).');notify('Guarnição mobilizada em '+p.shortName+'. Duração: '+dur(st.duration)+'.');
        refresh();
    }
    function finishOperation(p,r){
        const op=r.operation;r.operation=null;const ok=Math.random()<op.chance;
        if(ok){const cut=Math.min(45,25+op.garrison/40);r.strength=clamp(r.strength-cut);r.members=Math.max(0,r.members-Math.ceil(r.members*.4));p.dissent=Math.max(0,(Number(p.dissent)||0)-20);state.order=Math.min(100,(Number(state.order)||0)+2);
            rlog(p,'Contenção bem-sucedida: −'+Math.round(cut)+' de força rebelde.');notify('Contenção bem-sucedida em '+p.shortName+'.');chronicle('Contenção em '+p.shortName,'A guarnição desmantelou células rebeldes.','−'+Math.round(cut)+' força rebelde');}
        else{r.strength=clamp(r.strength-5);const census=censusOf(p),want=Math.min(Number(census.quartz)||0,Math.max(1,Math.round((Number(census.quartz)||0)*.03)));
            // Ferimentos poofam os soldados; os rebeldes, donos do campo, estilhaçam parte das gemas caídas.
            const lost=window.GempireGemFate?GempireGemFate.poof(p,'quartz',want,{reason:'Poofada na contenção',enemyField:true}):want;
            if(window.GempireGemFate)GempireGemFate.enemyShatter(p,.15,'Contenção fracassada');else{const c=Object.assign({},census);c.quartz=Math.max(0,(Number(c.quartz)||0)-lost);setCensus(p,c);}p.dissent=Math.min(100,(Number(p.dissent)||0)+5);
            rlog(p,'Contenção fracassou: '+lost+' Quartzo(s) poofado(s); os rebeldes estilhaçaram parte das gemas caídas.');notify('A contenção em '+p.shortName+' fracassou.',true);chronicle('Contenção fracassada em '+p.shortName,'A guarnição foi repelida: '+lost+' Quartzo(s) poofado(s).','+5 dissidência');}
        r.phase=phaseFor(r);applyInsurrection(p,r);refresh();
    }
    // Usado por outros sistemas (missão de pacificação da Corte etc.).
    function reduce(planetOrId,amount,reason){const p=typeof planetOrId==='string'?PLANETS[planetOrId]:planetOrId;if(!p)return;const r=res(p);r.strength=clamp(r.strength-amount);if(reason)rlog(p,reason+': −'+Math.round(amount)+' de força rebelde.');const to=phaseFor(r);if(to!==r.phase)enterPhase(p,r,r.phase,to);applyInsurrection(p,r);}

    // ------------------------------------------------------------ produção
    function yieldFactor(p){
        if(!p||!p.resistance)return 1;const r=res(p);
        let f=1;if(r.sabotageUntil>Date.now())f*=.75;if(r.phase===3)f*=.6;if(r.phase>=4)f=0;
        return f;
    }

    // ------------------------------------------------------------ fase 3: líderes, inteligência, ataque, negociação, anistia
    const EPITHETS=['Rachada','Sem Facetas','Desalinhada','das Galerias','Fora do Tom','Estilhaço','Sem Corte','do Subsolo'];
    const LEADER_TYPES={radical:{label:'Radical',desc:'Exige muito e não aceita meio-termo.'},pragmatic:{label:'Pragmática',desc:'Aceita recursos e acordos parciais.'},idealist:{label:'Idealista',desc:'Quer mudar a lei e libertar as desertoras.'}};
    const COURT_REACTION={assault:{harsh:3,cerebral:0,grand:-1,gentle:-4},negotiate:{harsh:-3,cerebral:1,grand:1,gentle:3},amnesty:{harsh:-2,cerebral:1,grand:1,gentle:2}};
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    function courtReact(kind){const t=COURT_REACTION[kind];(state.matriarchs||[]).forEach(m=>{const d=t[TONE[m.personalityId]||'grand']||0;if(d)m.loyalty=clamp((Number(m.loyalty)||0)+d);});}
    function casteName(c){return FOUNDING_GEM_DATA?.[c]?.label||c;}
    function ensureLeader(p,r){
        if(r.leader||r.phase<2)return r.leader;
        const pool=Object.keys(r.memberCastes).map(k=>k.split('|')[0]),c=pool.length?pool[Math.floor(Math.random()*pool.length)]:['quartz','peridot','bismuth','lapis'][Math.floor(Math.random()*4)];
        const off=Object.keys(r.memberCastes).some(k=>k.endsWith('|off'))||Math.random()<.4;
        const type=Object.keys(LEADER_TYPES)[Math.floor(Math.random()*3)];
        r.leader={name:casteName(c)+' '+EPITHETS[Math.floor(Math.random()*EPITHETS.length)],caste:c,offcolor:off,type,identified:false};
        return r.leader;
    }
    function cooldownLeft(r,k){return Math.max(0,(Number(r.cooldowns[k])||0)-Date.now())/1000;}
    function setCd(r,k,sec){r.cooldowns[k]=Date.now()+sec*1000;}
    function deployedSoldiers(p){const m=state.military;if(!m||!Array.isArray(m.battalions))return 0;return m.battalions.reduce((a,b)=>{const army=(m.armies||[]).find(x=>x.id===b.armyId);return a+(army&&army.planetId===p.id?Math.max(0,Number(b.soldiers)||0):0);},0);}
    // Retira desertoras por casta (para poofar), devolvendo {casta|off: n}.
    function takeMembers(r,n){const out={};let left=n;Object.keys(r.memberCastes).forEach(k=>{if(left<=0)return;const take=Math.min(left,r.memberCastes[k]);r.memberCastes[k]-=take;out[k]=(out[k]||0)+take;left-=take;if(!r.memberCastes[k])delete r.memberCastes[k];});r.members=Math.max(0,r.members-(n-left));return out;}
    // Espiãs capturadas ficam embolhadas pelos rebeldes até um acordo ou uma vitória.
    function returnHostages(p,r){const h=r.hostages||{};const n=Object.values(h).reduce((a,b)=>a+b,0);if(!n)return 0;const c=Object.assign({},censusOf(p));Object.entries(h).forEach(([k,v])=>c[k]=(Number(c[k])||0)+v);setCensus(p,c);r.hostages={};rlog(p,n+' espiã(s) embolhada(s) pelos rebeldes foram resgatadas.');return n;}
    function removeMembers(r,n){let left=n;Object.keys(r.memberCastes).forEach(k=>{if(left<=0)return;const take=Math.min(left,r.memberCastes[k]);r.memberCastes[k]-=take;left-=take;if(!r.memberCastes[k])delete r.memberCastes[k];});r.members=Math.max(0,r.members-n);}
    function returnMembers(p,r,n){
        const census=Object.assign({},censusOf(p));let left=n;const back={};
        Object.keys(r.memberCastes).forEach(k=>{if(left<=0)return;const take=Math.min(left,r.memberCastes[k]);const [c,off]=k.split('|');census[c]=(Number(census[c])||0)+take;back[c]=(back[c]||0)+take;if(off&&p.offColors){p.offColors.groups=p.offColors.groups||{};const g=c+'|color';p.offColors.groups[g]=(p.offColors.groups[g]||0)+take;}r.memberCastes[k]-=take;if(!r.memberCastes[k])delete r.memberCastes[k];left-=take;});
        const returned=n-left;r.members=Math.max(0,r.members-returned);setCensus(p,census);if(window.GempireOffColors)GempireOffColors.sync(p);
        return {returned,back};
    }
    // Inteligência
    function intel(planetId,kind){
        const p=PLANETS[planetId];if(!p)return;const r=res(p);const cd=cooldownLeft(r,'intel_'+kind);if(cd>0){notify('Aguarde '+dur(cd)+'.',true);return;}
        const census=censusOf(p);
        if(kind==='seer'){
            if(!(Number(census.sapphire)>0)){notify('É preciso uma Safira na colônia.',true);return;}
            r.intelUntil=Date.now()+300000;r.forewarned=true;const L=ensureLeader(p,r);if(L)L.identified=true;setCd(r,'intel_seer',300);
            rlog(p,'As Safiras leram o futuro: força exata revelada'+(L?', líder identificada ('+L.name+')':'')+' e a próxima sabotagem prevista.');
        }else if(kind==='eye'){
            if(typeof getAvailableRedEyeCount==='function'&&getAvailableRedEyeCount()<1){notify('Nenhum Olho Vermelho livre no império.',true);return;}
            r.intelUntil=Date.now()+600000;r.galleryIntelUntil=Date.now()+600000;setCd(r,'intel_eye',600);
            const L=ensureLeader(p,r);if(L&&Math.random()<.6)L.identified=true;
            rlog(p,'Varredura orbital: células mapeadas por 10 minutos (+15% no ataque) e galerias contadas'+(L&&L.identified?'; líder identificada ('+L.name+')':'')+'.');
        }else if(kind==='spy'){
            const agent=Number(census.pearl)>0?'pearl':Number(census.quartz)>0?'quartz':null;if(!agent){notify('Não há Pérola nem Quartzo para infiltrar.',true);return;}
            setCd(r,'intel_spy',240);
            if(Math.random()<(agent==='pearl'?.7:.55)){r.intelUntil=Date.now()+300000;const L=ensureLeader(p,r);if(L)L.identified=true;rlog(p,'A espiã '+(agent==='pearl'?'Pérola':'Quartzo')+' se infiltrou'+(L?' e identificou a líder: '+L.name:'')+'.');}
            else{const c=Object.assign({},census);c[agent]=Math.max(0,(Number(c[agent])||0)-1);setCensus(p,c);r.hostages=r.hostages||{};r.hostages[agent]=(r.hostages[agent]||0)+1;r.strength=clamp(r.strength+5);rlog(p,'A espiã foi poofada e embolhada pelos rebeldes (+5 força rebelde). Um acordo ou uma vitória pode resgatá-la.');notify('A espiã foi descoberta em '+p.shortName+'.',true);}
        }
        refresh();
    }
    // Ataque militar: decisivo, mas brutal.
    function assaultStats(p){
        const r=res(p),attack=garrison(p)+deployedSoldiers(p)*1.3,defense=r.strength*5+r.members*3+(Number(p.offColors?.hidden)||0)*2;
        const intelBonus=r.intelUntil>Date.now()?.15:0;
        return {attack,defense,chance:clamp(.2+attack/(attack+defense+1)*.7+intelBonus,.05,.95),duration:Math.round(90+r.strength),cost:30,intel:intelBonus>0};
    }
    function assault(planetId){
        const p=PLANETS[planetId];if(!p)return;const r=res(p);
        if(r.assault||r.operation){notify('Já há uma operação militar em '+p.shortName+'.',true);return;}
        if(r.strength<10){notify('Não há força rebelde para atacar.',true);return;}
        const st=assaultStats(p);if(st.attack<=0){notify('Sem tropas na colônia para atacar.',true);return;}
        if(essenceValue(state.essence)<st.cost){notify('O ataque exige '+st.cost+' de essência.',true);return;}
        state.essence=essenceValue(state.essence)-st.cost;
        r.assault={progress:0,duration:st.duration,chance:st.chance,intel:st.intel,attack:st.attack,defense:st.defense};
        rlog(p,'Ataque militar iniciado ('+Math.round(st.chance*100)+'% de chance).');notify('As tropas avançam sobre os rebeldes de '+p.shortName+'.');refresh();
    }
    function finishAssault(p,r){
        const a=r.assault;r.assault=null;const ok=Math.random()<a.chance;
        const census=censusOf(p);
        const losses=Math.max(1,Math.round(a.defense*(ok?.04:.09)*(a.intel?.7:1)));
        // Soldados feridos são poofados: voltam ao reformar, a não ser que os rebeldes vençam e estilhacem as gemas.
        const lostQ=window.GempireGemFate?GempireGemFate.poof(p,'quartz',Math.min(Number(census.quartz)||0,losses),{reason:'Poofada no ataque',enemyField:!ok}):0;
        if(ok){
            const cut=50+(a.intel?15:0);r.strength=clamp(r.strength-cut);const downed=Math.ceil(r.members*.5),fallen=takeMembers(r,downed);
            if(a.intel&&p.offColors)p.offColors.hidden=Math.floor((Number(p.offColors.hidden)||0)*.5);
            p.dissent=Math.min(100,(Number(p.dissent)||0)+(a.intel?8:12));
            if(r.leader&&Math.random()<.5){const lc=r.leader.caste&&r.leader.caste!=='diamond'?r.leader.caste:'quartz';fallen[lc+(r.leader.offcolor?'|off':'')+'|leader']=1;rlog(p,'A líder '+r.leader.name+' foi poofada e sua gema caiu.');r.leader=null;}
            if(window.GempireGemFate&&Object.keys(fallen).length)GempireGemFate.poofRebels(p,fallen,'Caídas no ataque');
            returnHostages(p,r);
            rlog(p,'Ataque vitorioso: −'+cut+' de força rebelde, '+downed+' rebelde(s) poofada(s) (decida embolhar ou estilhaçar), '+lostQ+' Quartzo(s) imperiais poofado(s).');
            chronicle('Ataque em '+p.shortName,'As tropas imperiais esmagaram a resistência. As gemas rebeldes caídas aguardam decisão.','−'+cut+' força rebelde · '+lostQ+' poofadas');notify('Ataque vitorioso em '+p.shortName+'.');
        }else{
            r.strength=clamp(r.strength+5);p.dissent=Math.min(100,(Number(p.dissent)||0)+5);
            const shattered=window.GempireGemFate?GempireGemFate.enemyShatter(p,r.leader&&r.leader.type==='radical'?.4:.25,'Ataque repelido'):0;
            rlog(p,'Ataque repelido: '+lostQ+' Quartzo(s) poofado(s), '+shattered+' estilhaçado(s) pelos rebeldes, +5 de força rebelde.');chronicle('Ataque fracassado em '+p.shortName,'Os rebeldes repeliram as tropas e ficaram com o campo.',lostQ+' poofadas');notify('O ataque em '+p.shortName+' foi repelido.',true);
        }
        courtReact('assault');
        const to=phaseFor(r);if(to!==r.phase)enterPhase(p,r,r.phase,to);applyInsurrection(p,r);refresh();
    }
    // Negociação com a líder identificada.
    function buildDemands(p,r){
        const L=r.leader,pol=policyKey(),d=[];
        if(['recycle','purge','bubble'].includes(pol))d.push({type:'policy',label:'Abolir a '+(pol==='purge'?'lei de Expurgo':pol==='bubble'?'lei de Embolhamento':'Reciclagem')+' (decretar Toleradas ou mais branda)'});
        const pris=window.GempireGemFate?GempireGemFate.prisoners(p):0;if(pris>0)d.push({type:'prisoners',label:'Libertar as '+fmt(pris)+' prisioneira(s) embolhada(s)'});
        if(r.members>0)d.push({type:'amnesty',label:'Anistia para as '+fmt(r.members)+' desertora(s)'});
        d.push({type:'supplies',label:'Suprimentos para as galerias',cost:{minerals:Math.round((150+r.strength*8)/10)*10}});
        const g=String(p.governor||'');if(g.startsWith('matriarch_'))d.push({type:'governor',label:'Afastar a governante atual'});
        d.push({type:'halt',label:'Suspender a extração em '+p.shortName+' por 15 minutos'});
        const n=L.type==='radical'?3:L.type==='pragmatic'?2:3;
        // A idealista põe lei e anistia na frente; a pragmática, os suprimentos.
        const order={idealist:['prisoners','policy','amnesty','halt','governor','supplies'],pragmatic:['supplies','prisoners','halt','amnesty','governor','policy'],radical:['prisoners','policy','governor','amnesty','halt','supplies']}[L.type];
        return d.sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)).slice(0,Math.min(n,d.length)).map(x=>Object.assign(x,{granted:false}));
    }
    function negotiate(planetId){
        const p=PLANETS[planetId];if(!p)return;const r=res(p);
        if(!r.leader||!r.leader.identified){notify('Identifique a líder rebelde primeiro.',true);return;}
        if(r.negotiation)return;const cd=cooldownLeft(r,'negotiate');if(cd>0){notify('A líder só aceita conversar de novo em '+dur(cd)+'.',true);return;}
        r.negotiation={demands:buildDemands(p,r),remaining:300};rlog(p,r.leader.name+' apresentou suas exigências.');refresh();
    }
    function grantDemand(planetId,i){
        const p=PLANETS[planetId],r=res(p),n=r.negotiation,d=n&&n.demands[i];if(!d||d.granted)return;
        if(d.type==='supplies'){if((Number(state.minerals)||0)<d.cost.minerals){notify('Minerais insuficientes.',true);return;}state.minerals-=d.cost.minerals;}
        else if(d.type==='policy'){if(!window.GempireOffColors)return;const before=GempireOffColors.policy();GempireOffColors.setPolicy('tolerate');if(GempireOffColors.policy()===before){notify('A lei não pode mudar agora (espera da Lei Off-Color).',true);return;}}
        else if(d.type==='governor'){const g=String(p.governor||'');p.governor='none';const m=(state.matriarchs||[]).find(x=>'matriarch_'+x.id===g);if(m)m.loyalty=clamp((Number(m.loyalty)||0)-10);}
        else if(d.type==='amnesty'){const back=returnMembers(p,r,r.members);rlog(p,back.returned+' desertora(s) voltaram com a anistia.');}
        else if(d.type==='prisoners'){if(window.GempireGemFate)GempireGemFate.releasePrisonersToRebels(p);rlog(p,'Prisioneiras libertadas aos rebeldes.');}
        else if(d.type==='halt'){r.haltUntil=Date.now()+900000;r.haltSnapshot=Number(p.resourcesRemaining)||0;}
        d.granted=true;refresh();
    }
    function closeDeal(planetId,abandon){
        const p=PLANETS[planetId],r=res(p),n=r.negotiation;if(!n)return;r.negotiation=null;setCd(r,'negotiate',600);
        const share=n.demands.filter(d=>d.granted).length/Math.max(1,n.demands.length),L=r.leader||(r.leader={name:'a líder',type:'pragmatic',identified:true});
        if(abandon||share===0||(L.type==='radical'&&share<1)){r.strength=clamp(r.strength+(abandon?10:8));L.type=L.type==='pragmatic'?'idealist':'radical';rlog(p,'A negociação fracassou. '+L.name+' se radicalizou.');notify('A negociação em '+p.shortName+' fracassou.',true);}
        else if(share>=1){returnHostages(p,r);r.lastDealAt=Date.now();r.strength=clamp(r.strength-50);r.truceUntil=Date.now()+1200000;p.dissent=Math.max(0,(Number(p.dissent)||0)-30);L.deal=true;rlog(p,'Acordo fechado com '+L.name+': trégua de 20 minutos e −50 de força rebelde.');chronicle('Acordo em '+p.shortName,'O Império aceitou as exigências de '+L.name+'.','Trégua de 20 minutos');notify('Acordo fechado em '+p.shortName+'.');}
        else if(share>=.5){returnHostages(p,r);r.lastDealAt=Date.now();r.strength=clamp(r.strength-25);r.truceUntil=Date.now()+600000;rlog(p,'Acordo parcial com '+L.name+': trégua de 10 minutos e −25 de força rebelde.');notify('Acordo parcial em '+p.shortName+'.');}
        else{r.strength=clamp(r.strength-8);rlog(p,'Concessões insuficientes: '+L.name+' saiu sem acordo (−8 de força rebelde).');}
        courtReact('negotiate');const to=phaseFor(r);if(to!==r.phase)enterPhase(p,r,r.phase,to);applyInsurrection(p,r);refresh();
    }
    // Anistia avulsa: desertoras podem voltar ao censo.
    function amnestyStats(p){const r=res(p),pol=policyKey();const chance=clamp(.35+({tolerate:.15,sanctuary:.25,citizen:.35,bubble:-.05,recycle:-.1,purge:-.3}[pol]||0)+(r.truceUntil>Date.now()?.2:0)-r.phase*.05,.05,.95);return {cost:Math.max(10,r.members*8),chance};}
    function amnesty(planetId){
        const p=PLANETS[planetId],r=res(p);if(!r.members){notify('Não há desertoras.',true);return;}
        const cd=cooldownLeft(r,'amnesty');if(cd>0){notify('Nova anistia em '+dur(cd)+'.',true);return;}
        const st=amnestyStats(p);if(essenceValue(state.essence)<st.cost){notify('A anistia exige '+st.cost+' de essência.',true);return;}
        state.essence=essenceValue(state.essence)-st.cost;setCd(r,'amnesty',480);
        let n=0;for(let i=0;i<r.members;i++)if(Math.random()<st.chance)n++;
        const back=returnMembers(p,r,n);r.strength=clamp(r.strength-back.returned*.8);if(back.returned)r.lastAmnestyAt=Date.now();
        rlog(p,'Anistia: '+back.returned+' de '+(back.returned+r.members)+' desertora(s) voltaram.');notify(back.returned+' desertora(s) aceitaram a anistia em '+p.shortName+'.');
        courtReact('amnesty');refresh();
    }

    // ------------------------------------------------------------ ciclo
    let acc=0,uiAcc=0;
    function update(dt){
        if(!state||!state.firstGameStarted)return;
        dt=Math.max(0,Math.min(5,Number(dt)||0));acc+=dt;uiAcc+=dt;
        if(acc>=5){const step=acc;acc=0;updateNet(step);
            Object.values(PLANETS).filter(p=>p&&p.colonized).forEach(p=>{
                const r=res(p);
                if(r.operation){r.operation.progress+=step*100/Math.max(1,r.operation.duration);if(r.operation.progress>=100)finishOperation(p,r);}
                if(r.assault){r.assault.progress+=step*100/Math.max(1,r.assault.duration);if(r.assault.progress>=100)finishAssault(p,r);}
                if(r.negotiation){r.negotiation.remaining-=step;if(r.negotiation.remaining<=0)closeDeal(p.id,true);}
                if(r.haltUntil>Date.now()&&(Number(p.resourcesRemaining)||0)<(Number(r.haltSnapshot)||0)-50){r.haltUntil=0;r.truceUntil=0;r.strength=clamp(r.strength+25);rlog(p,'O Império quebrou a promessa de suspender a extração: +25 de força rebelde.');notify('Promessa quebrada em '+p.shortName+': os rebeldes se fortaleceram.',true);}
                ensureLeader(p,r);if(r.leader&&r.phase>=4&&!r.leader.identified){r.leader.identified=true;rlog(p,r.leader.name+' declarou-se líder do mundo rebelde.');}
                if(r.leader&&r.phase<=0&&r.strength<5){r.leader=null;}
                if(r.leader&&r.leader.deal&&r.truceUntil<=Date.now())r.leader.deal=false;
                r.strength=clamp(r.strength+growthPerMinute(p)*step/60);
                if(rebelGovernor(p))r.strength=Math.max(r.strength,60);
                const to=phaseFor(r);if(to!==r.phase)enterPhase(p,r,r.phase,to);
                if(r.phase>=1)p.dissent=Math.min(100,(Number(p.dissent)||0)+.5*step/60*mult());
                if(r.phase>=2){r.sabotageTimer-=step*mult();if(r.sabotageTimer<=0){r.sabotageTimer=Math.max(60,240-r.strength*1.5)+Math.random()*60;sabotage(p);}}
                if(r.phase>=3)state.order=Math.max(0,(Number(state.order)||0)-.5*step/60);
                if(r.phase>=3){r.spreadTimer-=step*(r.phase>=4?1:.5);if(r.spreadTimer<=0){r.spreadTimer=240+Math.random()*120;spread(p);}}
                matriarchLeader(p,r);
                applyInsurrection(p,r);
            });
        }
        if(uiAcc>=3){uiAcc=0;if(state.currentScreen==='governance'&&state.governanceSection==='order'){const el=document.getElementById('governance-content');if(el&&!el.contains(document.activeElement)&&window.renderOrderTab)window.renderOrderTab(el);}}
    }
    function refresh(){try{updateHUD();}catch(e){}try{renderDrawerContent();}catch(e){}if(state.currentScreen==='governance'&&state.governanceSection==='order'){const el=document.getElementById('governance-content');if(el&&window.renderOrderTab)window.renderOrderTab(el);}}

    // ------------------------------------------------------------ interface
    // O que o jogador sabe: fases avançadas são evidentes; células só aparecem
    // depois da primeira sabotagem ou com Safiras na colônia.
    function knowledge(p){
        const r=res(p),c=censusOf(p),seers=Number(c.sapphire)||0;
        if(r.phase>=3||r.intelUntil>Date.now())return {exact:true,label:PHASES[r.phase].label};
        if(r.phase===2&&!r.detected&&!seers)return {exact:false,label:'Descontentamento',range:[10,55]};
        if(seers)return {exact:true,label:PHASES[r.phase].label};
        const lo=Math.max(0,Math.floor(r.strength/10)*10-10),hi=Math.min(100,lo+30);return {exact:false,label:PHASES[r.phase].label,range:[lo,hi]};
    }
    function renderPlanet(p){
        const r=res(p),k=knowledge(p),ph=PHASES.find(x=>x.label===k.label)||PHASES[0],st=containStats(p),g=growthPerMinute(p);
        const barStyle=k.exact?'width:'+r.strength+'%':'left:'+k.range[0]+'%;width:'+(k.range[1]-k.range[0])+'%;opacity:.6';
        let html='<div class="resist"><div class="court-row"><b style="color:'+ph.color+'">Resistência · '+esc(k.label)+'</b><small>'+(k.exact?Math.round(r.strength)+'/100':'estimativa')+'</small></div>';
        html+='<div class="resist-bar">'+[10,30,55,80].map(v=>'<i class="tick" style="left:'+v+'%"></i>').join('')+'<span style="'+barStyle+';background:'+ph.color+'"></span></div>';
        const gov=governorOf(p),gs=stanceOf(gov);if(gov)html+='<small style="display:block;color:#c9a6ff">Governante: '+esc(gov.name)+(gov.courtStatus==='rebel'?' · rebelde':' · '+gs.label+(gs.growth>0?' (alimenta a revolta, contém melhor)':gs.growth<0?' (acalma a revolta)':''))+'</small>';
        html+='<small style="display:block;color:var(--text-muted)">'+esc(ph.desc)+(k.exact?' · tendência '+(g>0.05?'subindo':g<-0.05?'caindo':'estável'):'')+(r.members?' · '+fmt(r.members)+' desertora(s)':'')+(r.sabotageUntil>Date.now()?' · produção sabotada':'')+(k.exact?'':' · Safiras na colônia revelariam a força exata')+'</small>';
        if(r.operation)html+='<div class="stat-box">Operação de contenção<div class="founding-progress"><div style="width:'+r.operation.progress+'%"></div></div><small>Chance '+Math.round(r.operation.chance*100)+'% · faltam '+dur(r.operation.duration*(100-r.operation.progress)/100)+'</small></div>';
        else if(r.strength>=10||p.rebellionActive)html+='<button class="btn btn-pink btn-block" onclick="GempireResistance.contain(\''+p.id+'\')">Operação de contenção · '+st.cost+' essência · '+dur(st.duration)+' · '+Math.round(st.chance*100)+'%</button><small style="display:block;color:var(--text-muted)">Guarnição: '+fmt(st.garrison)+' (Quartzos, Rubis, Topázios e Ágatas; generais reforçam). A missão "Pacificar" da Corte também enfraquece a resistência.</small>';
        html+=renderResponses(p,r);
        if(r.log.length)html+='<div class="resist-log">'+r.log.slice(0,4).map(e=>'<small>'+esc(e.text)+'</small>').join('')+'</div>';
        return html+'</div>';
    }
    function btn(label,on,disabled,cls){return '<button class="btn'+(cls?' '+cls:'')+'" '+(disabled?'disabled':'')+' onclick="'+on+'">'+label+'</button>';}
    function renderResponses(p,r){
        if(r.strength<10&&!r.members&&!r.leader)return '';
        const id=p.id,c=censusOf(p),L=r.leader;let h='';
        const hostages=Object.values(r.hostages||{}).reduce((a,b)=>a+b,0);if(hostages)h+='<small style="display:block;color:#fb923c">'+hostages+' espiã(s) embolhada(s) pelos rebeldes · resgate num acordo ou numa vitória</small>';
        if(r.truceUntil>Date.now())h+='<small class="resist-truce">Trégua: '+dur((r.truceUntil-Date.now())/1000)+(r.haltUntil>Date.now()?' · extração suspensa (não extraia ou a trégua cai)':'')+'</small>';
        // Líder
        if(L)h+='<div class="resist-leader"><b>'+(L.identified?esc(L.name):'Líder desconhecida')+'</b>'+(L.identified?'<small>'+LEADER_TYPES[L.type].label+(L.offcolor?' · off-color':'')+' · '+LEADER_TYPES[L.type].desc+(L.deal?' · cumpre um acordo':'')+'</small>':'<small>Use inteligência para identificá-la e poder negociar.</small>')+'</div>';
        // Inteligência
        const cdS=cooldownLeft(r,'intel_seer'),cdE=cooldownLeft(r,'intel_eye'),cdP=cooldownLeft(r,'intel_spy');
        h+='<div class="court-subtitle">Inteligência</div><div class="court-actions">'+
            btn('Safiras videntes'+(cdS?' · '+dur(cdS):''),"GempireResistance.intel('"+id+"','seer')",!(Number(c.sapphire)>0)||cdS>0)+
            btn('Olho Vermelho'+(cdE?' · '+dur(cdE):''),"GempireResistance.intel('"+id+"','eye')",cdE>0)+
            btn('Infiltrar espiã'+(cdP?' · '+dur(cdP):''),"GempireResistance.intel('"+id+"','spy')",cdP>0)+'</div>'+
            '<small style="display:block;color:var(--text-muted)">Safiras: força exata, identificam a líder e preveem a próxima sabotagem. Olho Vermelho: mapeia as células (+15% no ataque) e conta as galerias. Espiã (Pérola ou Quartzo): pode identificar a líder ou ser capturada.</small>';
        // Ataque
        if(r.assault)h+='<div class="stat-box">Ataque militar<div class="founding-progress"><div style="width:'+r.assault.progress+'%"></div></div><small>Chance '+Math.round(r.assault.chance*100)+'% · faltam '+dur(r.assault.duration*(100-r.assault.progress)/100)+'</small></div>';
        else if(r.strength>=10){const a=assaultStats(p);h+='<div class="court-subtitle">Força</div>'+btn('Ataque militar · '+a.cost+' essência · '+dur(a.duration)+' · '+Math.round(a.chance*100)+'%'+(a.intel?' (com mapa)':''),"GempireResistance.assault('"+id+"')",!!r.operation,'btn-pink')+'<small style="display:block;color:var(--text-muted)">Tropas: '+fmt(a.attack)+' contra '+fmt(a.defense)+' (força, desertoras e galerias). Decisivo (−50 a −65). Soldados feridos são poofados e se reformam; se o ataque falhar, os rebeldes estilhaçam parte das gemas caídas. Na vitória, as rebeldes poofadas esperam sua decisão: embolhar ou estilhaçar. Diamantes duras aprovam; gentis reprovam.</small>';}
        // Negociação
        if(r.negotiation){const n=r.negotiation;h+='<div class="court-subtitle">Negociação · '+dur(n.remaining)+'</div>'+n.demands.map((d,i)=>'<div class="court-row resist-demand"><span>'+(d.granted?'✓ ':'')+esc(d.label)+(d.cost?' · '+fmt(d.cost.minerals)+' minerais':'')+'</span>'+(d.granted?'<small>Concedido</small>':btn('Conceder',"GempireResistance.grant('"+id+"',"+i+")"))+'</div>').join('')+
            '<div class="court-actions">'+btn('Fechar acordo',"GempireResistance.deal('"+id+"')",false,'btn-emerald')+btn('Romper',"GempireResistance.deal('"+id+"',true)",false,'btn-pink')+'</div><small style="display:block;color:var(--text-muted)">Tudo concedido: trégua de 20 min e −50 de força. Metade ou mais: trégua de 10 min e −25. A Radical só aceita tudo.</small>';}
        else if(L&&L.identified&&r.strength>=10){const cd=cooldownLeft(r,'negotiate');h+='<div class="court-subtitle">Diplomacia</div>'+btn('Negociar com '+esc(L.name)+(cd?' · '+dur(cd):''),"GempireResistance.negotiate('"+id+"')",cd>0);}
        // Anistia
        if(r.members>0){const a=amnestyStats(p),cd=cooldownLeft(r,'amnesty');h+='<div class="court-subtitle">Anistia</div>'+btn('Oferecer anistia · '+a.cost+' essência · ~'+Math.round(a.chance*100)+'% aceitam'+(cd?' · '+dur(cd):''),"GempireResistance.amnesty('"+id+"')",cd>0)+'<small style="display:block;color:var(--text-muted)">'+fmt(r.members)+' desertora(s): '+Object.entries(r.memberCastes).map(([k,n])=>n+' '+casteName(k.split('|')[0])+(k.endsWith('|off')?' off-color':'')).join(', ')+'. Leis brandas e tréguas aumentam a adesão.</small>';}
        return h;
    }
    // Áreas rebeldes visíveis no globo da colônia.
    function coverFor(p){
        if(!p||!p.resistance)return null;const r=res(p);
        let c=0;if(r.phase>=4)c=.4+(r.strength-80)/100*.5;else if(r.phase===3)c=.1+(r.strength-55)/100*.6;else if(r.phase===2&&r.detected)c=.03+(r.strength-30)/100*.12;
        if(c<=.01)return null;c=Math.round(Math.min(.75,c)*100)/100;
        return {coverage:c,parts:[{id:'rebels',share:1,color:r.phase>=4?'#4c0519':'#7f1d3a'}],key:'rebels:'+c+':'+r.phase};
    }
    function renderNetwork(){
        const n=net(),list=n.transits.filter(t=>t.detected);
        const head='<section class="card"><div class="card-header"><span class="card-title">Rede rebelde</span><span class="badge">'+list.length+' em trânsito detectado(s)</span></div>';
        if(!list.length)return head+'<p class="governance-muted">Nenhum agitador detectado entre as colônias. Colônias em Insurreição ou rebeldes enviam agitadores (às vezes com a líder) para mundos próximos e vulneráveis. Inteligência na origem e Safiras no destino ajudam a detectá-los; naves em órbita podem interceptá-los.</p></section>';
        return head+list.map(t=>{const f=PLANETS[t.from],to=PLANETS[t.to],ships=interceptors(t);return '<div class="stat-box"><div class="court-row"><b>'+esc(f?.shortName||'?')+' → '+esc(to?.shortName||'?')+'</b><span class="badge">chega em '+dur(t.eta)+'</span></div><div class="founding-progress"><div style="width:'+Math.max(0,100-t.eta/t.total*100)+'%"></div></div><small>+'+t.amount+' de força rebelde'+(t.leader?' · leva a líder '+esc(t.leader.name):'')+'</small><button class="btn btn-block" '+(ships.length?'':'disabled')+' onclick="GempireResistance.intercept('+t.id+')">'+(ships.length?'Interceptar com a '+esc(ships[0].name):'Sem nave em órbita na origem ou no destino')+'</button></div>';}).join('')+'</section>';
    }
    function generalAmnesty(fraction){let total=0;Object.values(PLANETS).filter(p=>p.colonized&&p.resistance&&p.resistance.members>0).forEach(p=>{const r=res(p),n=Math.round(r.members*fraction);const back=returnMembers(p,r,n);if(back.returned){r.strength=clamp(r.strength-back.returned*.8);r.lastAmnestyAt=Date.now();rlog(p,'Anistia geral: '+back.returned+' desertora(s) voltaram.');total+=back.returned;}});return total;}
    window.GempireResistance={generalAmnesty,update,intercept,coverFor,renderNetwork,transits:()=>net().transits,stanceOf:m=>stanceOf(m),governorOf,contain,intel,assault,negotiate,grant:grantDemand,deal:closeDeal,amnesty,reduce,yieldFactor,renderPlanet,phase:p=>res(p).phase,_res:res,_sabotage:sabotage,PHASES};
})();
