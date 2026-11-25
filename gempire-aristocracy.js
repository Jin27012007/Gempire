/* =========================================================================
 * GEMPIRE · Aristocracia, bailes e o Tribunal das Zircônias
 *
 *  1. Nobreza — cada Gem aristocrata do censo (Safiras, Jades, Morganitas,
 *     Águas-marinhas, Esmeraldas, Lápis e Zircônias) ganha nome, temperamento,
 *     favor, prestígio e uma Diamante patrona. A jogadora honra, repreende,
 *     concede cargos, exila ou leva a julgamento. As nobres pedem cargos,
 *     oferecem tributos, fazem intrigas, causam escândalos e, se caírem em
 *     desgraça, desertam para a rebelião.
 *  2. Bailes — no Palácio Real (ou num Palácio de Recepção das Morganitas):
 *     tema, porte, homenageada e convidadas. Durante o baile surgem momentos
 *     que pedem uma decisão (dança de abertura, fusões no salão, brigas entre
 *     Diamantes, visões das Safiras...). O resultado mexe com lealdade,
 *     relações da Corte, favor das nobres, prestígio imperial e dissidência.
 *  3. Tribunal — exige o Palácio Real e ao menos uma Zircônia (a promotora).
 *     Com duas ou mais, outra Zircônia defende. A jogadora preside (ou delega a
 *     uma Diamante): três rodadas de argumentos, provas e testemunhas, uma
 *     possível reviravolta da defesa, veredito e sentença. Cada caso tem uma
 *     verdade escondida; vereditos contra as provas e sentenças desproporcionais
 *     corroem a Reputação da Justiça, que mexe com a dissidência das colônias.
 * Estado em state.aristocracy (vai no save).
 * ========================================================================= */
(function(){
    'use strict';
    const uiGate=(()=>{let last=0;return ms=>{const t=performance.now();if(t-last<ms)return false;last=t;return true;};})();
    const CASTES=['sapphire','jade','morganite','aquamarine','emerald','lapis','zircon'];
    const PER_PLANET=3,MAX_NOBLES=30;
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const TRAITS={
        vain:{label:'Vaidosa',desc:'Adora bailes e honrarias; se ofende quando é esquecida.'},
        scheming:{label:'Intrigante',desc:'Acusa rivais, às vezes sem razão.'},
        loyal:{label:'Leal',desc:'Serve ao trono e oferece tributos.'},
        devoted:{label:'Devota',desc:'Fiel à sua Diamante patrona acima de tudo.'},
        ambitious:{label:'Ambiciosa',desc:'Quer um cargo na Corte.'},
        scandalous:{label:'Escandalosa',desc:'Propensa a escândalos e gafes.'},
        reserved:{label:'Reservada',desc:'Discreta; pouco pede e pouco causa.'}
    };
    const OFFICES={
        ceremonies:{label:'Mestra de Cerimônias',castes:['jade'],desc:'Bailes melhores (+8 de qualidade).'},
        seer:{label:'Vidente da Corte',castes:['sapphire'],desc:'Provas e testemunhas mais certeiras nos julgamentos; antecipa momentos dos bailes.'},
        prosecutor:{label:'Promotora Imperial',castes:['zircon'],desc:'Conduz as acusações no Tribunal (+10 à acusação).'},
        architect:{label:'Arquiteta dos Salões',castes:['morganite'],desc:'Bailes 30% mais baratos.'},
        counselor:{label:'Conselheira Imperial',castes:['aquamarine','emerald','lapis','sapphire'],desc:'Favor das nobres cresce mais; menos intrigas.'}
    };
    const CHARGES={
        fusion:{label:'Fusão entre castas',sev:2},
        insubordination:{label:'Insubordinação',sev:2},
        conspiracy:{label:'Conspiração contra a Corte',sev:3},
        embezzlement:{label:'Desvio de essência',sev:2},
        prophecy:{label:'Profecia falsa',sev:1},
        negligence:{label:'Negligência no dever',sev:1},
        offcolor:{label:'Ocultar um defeito de corte',sev:1},
        offense:{label:'Ofensa a uma Diamante',sev:2},
        rebellion:{label:'Liderar a rebelião',sev:3}
    };
    const SENTENCES={
        warning:{label:'Advertência pública',harsh:0,kinds:['noble','gem']},
        pardon:{label:'Anistia condicional',harsh:0,kinds:['leader']},
        strip:{label:'Perda de título e cargo',harsh:1,kinds:['noble']},
        exile:{label:'Exílio numa colônia distante',harsh:2,kinds:['noble']},
        bubble:{label:'Embolhamento',harsh:3,kinds:['noble','gem','leader']},
        shatter:{label:'Estilhaçamento',harsh:4,kinds:['noble','gem','leader']}
    };
    const THEMES={
        gala:{label:'Gala de Luz',desc:'Brilho, cristais e música. Agrada às Grandiosas.',pref:{grand:1,gentle:.4,cerebral:-.2,harsh:-.3}},
        victory:{label:'Celebração de Vitória',desc:'Desfile das tropas e troféus. Agrada às Duras.',pref:{harsh:1,grand:.4,cerebral:0,gentle:-.5}},
        recital:{label:'Sarau das Mentes',desc:'Debates, previsões e música calculada. Agrada às Racionais.',pref:{cerebral:1,gentle:.2,grand:-.1,harsh:-.2}},
        garden:{label:'Baile do Jardim',desc:'Jardins vivos, água e silêncio. Agrada às Gentis.',pref:{gentle:1,cerebral:.2,grand:.1,harsh:-.4}}
    };
    const SCALES={
        intimate:{label:'Íntimo',cost:{minerals:150,essence:20},base:22,mult:1,nobles:4,moments:2,duration:150},
        grand:{label:'Grandioso',cost:{minerals:350,essence:50},base:30,mult:1.6,nobles:8,moments:3,duration:210},
        imperial:{label:'Imperial',cost:{minerals:700,essence:120},base:38,mult:2.4,nobles:16,moments:4,duration:270}
    };
    const TIERS=[{min:-999,label:'Desastroso',f:-1,color:'#fb7185'},{min:35,label:'Morno',f:.3,color:'#f2cf86'},{min:55,label:'Elegante',f:1,color:'#6ee7b7'},{min:75,label:'Lendário',f:1.6,color:'#c4b5fd'}];
    const BALL_COOLDOWN=480;

    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const dur=s=>typeof formatDuration==='function'?formatDuration(s):Math.ceil(s)+'s';
    const now=()=>typeof gameNow==='function'?gameNow():Date.now();
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    const label=c=>FOUNDING_GEM_DATA?.[c]?.label||c;
    const colorOf=c=>FOUNDING_GEM_DATA?.[c]?.color||'#c4b5fd';
    const GF=()=>window.GempireGemFate,R=()=>window.GempireResistance;
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function colonies(){return Object.values(PLANETS).filter(p=>p&&p.colonized);}
    function censusOf(p){return p.id===activeId()?(state.census||(state.census={})):(ensurePlanetEconomy(p,false).census||{});}
    function setCensus(p,c){if(p.id===activeId())state.census=c;else ensurePlanetEconomy(p,false).census=c;}
    function addCensus(p,caste,d){const c=Object.assign({},censusOf(p));c[caste]=Math.max(0,(Number(c[caste])||0)+d);setCensus(p,c);}
    function structuresOf(p){return p.id===activeId()?(state.structures||{}):(ensurePlanetEconomy(p,false).structures||{});}
    function empireCount(caste){return colonies().reduce((a,p)=>a+Math.max(0,Math.floor(Number(censusOf(p)[caste])||0)),0);}
    function essence(){return typeof essenceValue==='function'?essenceValue(state.essence):Number(state.essence)||0;}
    function canPay(cost){return (Number(state.minerals)||0)>=(cost.minerals||0)&&essence()>=(cost.essence||0);}
    function pay(cost){state.minerals=Math.max(0,(Number(state.minerals)||0)-(cost.minerals||0));state.essence=Math.max(0,essence()-(cost.essence||0));}
    const matriarchs=()=>Array.isArray(state.matriarchs)?state.matriarchs:[];
    const diamondById=id=>matriarchs().find(m=>m.id===id)||null;
    const presentDiamonds=()=>matriarchs().filter(m=>(m.courtStatus||'court')==='court'&&!(Number(m.isolatedUntil)>now()));
    const toneOf=m=>TONE[m?.personalityId]||'grand';
    function loyalty(m,d){if(m)m.loyalty=clamp((Number(m.loyalty)||0)+d);}
    function relation(a,b,d){const c=state.court;if(!c||!c.relations||a===b)return 0;const k=[a,b].sort().join('|');if(d)c.relations[k]=clamp((Number(c.relations[k])||0)+d,-100,100);return Number(c.relations[k])||0;}
    function byTone(fn){presentDiamonds().forEach(m=>{const d=fn(toneOf(m),m);if(d)loyalty(m,d);});}
    function patronName(id){if(!id||id==='first')return state.firstDiamond?.name||'Diamante Fundadora';return diamondById(id)?.name||'Diamante';}

    // ------------------------------------------------------------ estado
    function A(){
        const a=state.aristocracy=state.aristocracy&&typeof state.aristocracy==='object'?state.aristocracy:{};
        a.nobles=Array.isArray(a.nobles)?a.nobles:[];
        a.nextId=Number(a.nextId)||1;
        a.offices=a.offices&&typeof a.offices==='object'?a.offices:{};
        Object.keys(OFFICES).forEach(k=>{if(!(k in a.offices))a.offices[k]=null;});
        a.petitions=Array.isArray(a.petitions)?a.petitions:[];
        a.cases=Array.isArray(a.cases)?a.cases:[];
        a.history=Array.isArray(a.history)?a.history:[];
        a.balls=Array.isArray(a.balls)?a.balls:[];
        a.log=Array.isArray(a.log)?a.log:[];
        a.justice=clamp(a.justice??60);
        a.prestige=clamp(a.prestige??30);
        a.timers=a.timers&&typeof a.timers==='object'?a.timers:{};
        if(!('intrigue' in a.timers))a.timers.intrigue=300;
        a.view=['nobles','balls','trials'].includes(a.view)?a.view:'nobles';
        a.plan=a.plan&&typeof a.plan==='object'?a.plan:{theme:'gala',scale:'intimate',honoree:null,diamonds:{}};
        a.ballReadyAt=Number(a.ballReadyAt)||0;
        a.leaderCases=a.leaderCases&&typeof a.leaderCases==='object'?a.leaderCases:{};
        return a;
    }
    function log(text,impact,color){const a=A();a.log.unshift({text,impact:impact||'',color:color||null,at:now()});a.log.length=Math.min(a.log.length,40);}
    const nobleById=id=>A().nobles.find(n=>n.id===id)||null;
    const activeNobles=()=>A().nobles.filter(n=>n.status==='court'||n.status==='trial');
    const atCourt=n=>n&&n.status==='court'&&!(Number(n.exiledUntil)>now());

    // ------------------------------------------------------------ nomes e sincronia com o censo
    const CODES='ABCDEFGHJKLMNPQRSTUVWXYZ';
    function newName(caste){return label(caste)+' Faceta-'+(1+Math.floor(Math.random()*9))+' Corte-'+(1+Math.floor(Math.random()*9))+CODES[Math.floor(Math.random()*CODES.length)]+CODES[Math.floor(Math.random()*CODES.length)];}
    function defaultPatron(p){const g=String(p?.governor||'');return g.startsWith('matriarch_')&&diamondById(g.slice(10))?g.slice(10):'first';}
    function makeNoble(caste,p){
        const a=A(),trait=pick(Object.keys(TRAITS));
        const n={id:a.nextId++,name:newName(caste),caste,planetId:p.id,grade:Math.random()<.15?'S':'A',trait,favor:Math.round(45+Math.random()*20),prestige:Math.round(15+Math.random()*25),patron:defaultPatron(p),status:'court',office:null,honest:trait==='scheming'?Math.random()<.4:Math.random()<.9,hiddenDefect:Math.random()<.08,since:now()};
        a.nobles.push(n);return n;
    }
    function sync(){
        const a=A();
        colonies().forEach(p=>{
            const c=censusOf(p);
            CASTES.forEach(caste=>{
                const pop=Math.max(0,Math.floor(Number(c[caste])||0));
                const mine=a.nobles.filter(n=>n.planetId===p.id&&n.caste===caste&&['court','trial','poofed'].includes(n.status));
                const poofed=mine.filter(n=>n.status==='poofed').length;
                const want=Math.min(PER_PLANET,pop+poofed);
                if(mine.length>want){
                    const removable=mine.filter(n=>n.status==='court'&&!n.office).sort((x,y)=>y.since-x.since);
                    removable.slice(0,mine.length-want).forEach(n=>{n.status='gone';});
                }else if(mine.length<want){
                    for(let i=mine.length;i<want&&a.nobles.filter(n=>['court','trial','poofed'].includes(n.status)).length<MAX_NOBLES;i++)makeNoble(caste,p);
                }
            });
        });
        Object.keys(a.offices).forEach(k=>{const n=nobleById(a.offices[k]);if(!n||!['court','trial','poofed'].includes(n.status)){a.offices[k]=null;if(n)n.office=null;}});
        a.nobles=a.nobles.filter(n=>n.status!=='gone');
        // Nobres poofadas voltam quando a gema se reforma.
        a.nobles.forEach(n=>{if(n.status!=='poofed')return;const p=PLANETS[n.planetId];const tag='noble:'+n.id;if(!p||!GF()||!GF()._fate(p).poofed.some(g=>g.reason===tag)){n.status='court';log(n.name+' se reformou.','');}});
    }

    // ------------------------------------------------------------ nobreza: ações
    function honor(id){
        const n=nobleById(id);if(!atCourt(n))return;const cost=20;
        if(essence()<cost){notify('Honrarias custam '+cost+' de essência.',true);return;}
        if(Number(n.honorAt)>now()){notify(n.name+' já foi honrada há pouco.',true);return;}
        state.essence=essence()-cost;n.honorAt=now()+120000;
        const k=A().offices.counselor?1.25:1;
        n.favor=clamp(n.favor+12*k);n.prestige=clamp(n.prestige+8);
        activeNobles().filter(o=>o!==n&&o.trait==='vain'&&o.planetId===n.planetId).forEach(o=>o.favor=clamp(o.favor-3));
        if(n.patron!=='first')loyalty(diamondById(n.patron),2);
        log('Você honrou '+n.name+' diante da Corte.','+12 favor · +8 prestígio',colorOf(n.caste));refresh();
    }
    function reprimand(id){
        const n=nobleById(id);if(!atCourt(n))return;
        n.favor=clamp(n.favor-15);n.prestige=clamp(n.prestige-6);if(n.trait==='scheming')A().timers.intrigue+=120;
        log('Você repreendeu '+n.name+' em público.','−15 favor · −6 prestígio',colorOf(n.caste));refresh();
    }
    function appoint(id,office){
        const a=A(),n=nobleById(id),o=OFFICES[office];if(!atCourt(n)||!o)return;
        if(!o.castes.includes(n.caste)){notify(o.label+' exige '+o.castes.map(label).join(' ou ')+'.',true);return;}
        if(n.office&&n.office!==office)a.offices[n.office]=null;
        const prev=nobleById(a.offices[office]);
        if(prev&&prev!==n){prev.office=null;prev.favor=clamp(prev.favor-12);log(prev.name+' perdeu o cargo de '+o.label+'.','−12 favor',colorOf(prev.caste));}
        a.offices[office]=n.id;n.office=office;n.favor=clamp(n.favor+(n.trait==='ambitious'?18:10));n.prestige=clamp(n.prestige+10);
        activeNobles().filter(x=>x!==n&&x.trait==='ambitious'&&!x.office).forEach(x=>x.favor=clamp(x.favor-4));
        log(n.name+' agora é '+o.label+'.','+favor · +10 prestígio',colorOf(n.caste));refresh();
    }
    function dismiss(id){const a=A(),n=nobleById(id);if(!n||!n.office)return;const o=OFFICES[n.office];a.offices[n.office]=null;n.office=null;n.favor=clamp(n.favor-15);log(n.name+' foi dispensada do cargo de '+(o?.label||'')+'.','−15 favor',colorOf(n.caste));refresh();}
    function exileTarget(n){const from=PLANETS[n.planetId];const list=colonies().filter(p=>p.id!==n.planetId);if(!list.length)return null;const d=p=>Math.hypot((Number(p.x)||0)-(Number(from?.x)||0),(Number(p.y)||0)-(Number(from?.y)||0))+(p.systemId!==from?.systemId?1000:0);return list.sort((x,y)=>d(y)-d(x))[0];}
    function exile(n,quiet){
        const to=exileTarget(n);if(!to){if(!quiet)notify('Não há outra colônia para onde exilar.',true);return false;}
        const from=PLANETS[n.planetId];if(from)addCensus(from,n.caste,-1);addCensus(to,n.caste,1);
        if(n.office){A().offices[n.office]=null;n.office=null;}
        n.planetId=to.id;n.exiledUntil=now()+20*60000;n.favor=clamp(n.favor-35);n.prestige=clamp(n.prestige-20);
        if(n.patron!=='first')loyalty(diamondById(n.patron),-4);
        log(n.name+' foi exilada para '+to.shortName+'.','−35 favor · fora dos salões por 20 min',colorOf(n.caste));return true;
    }
    function exileAction(id){const n=nobleById(id);if(!atCourt(n))return;if(exile(n))refresh();}
    function accuseAction(id,charge){const n=nobleById(id);if(!atCourt(n))return;openCase({kind:'noble',nobleId:n.id},charge||pickCharge(n),{type:'empire'},null);notify('Acusação registrada no Tribunal.');refresh();}
    function pickCharge(n){if(n.hiddenDefect)return 'offcolor';if(n.caste==='sapphire'&&Math.random()<.4)return 'prophecy';return pick(['insubordination','embezzlement','negligence','offense','conspiracy']);}

    // ------------------------------------------------------------ intrigas e pedidos
    function petition(kind,nobleId,data){const a=A();if(a.petitions.some(p=>p.kind===kind&&p.nobleId===nobleId))return;a.petitions.unshift(Object.assign({id:'pt'+(a.nextId++),kind,nobleId,expires:now()+6*60000},data||{}));a.petitions.length=Math.min(a.petitions.length,8);}
    function intrigue(){
        const a=A(),list=activeNobles().filter(atCourt);if(list.length<1)return;
        const opts=[];
        const ambitious=list.filter(n=>n.trait==='ambitious'&&!n.office);
        ambitious.forEach(n=>{const off=Object.entries(OFFICES).find(([k,o])=>o.castes.includes(n.caste)&&!a.offices[k]);const any=Object.entries(OFFICES).find(([,o])=>o.castes.includes(n.caste));const o=off||any;if(o)opts.push(()=>petition('office',n.id,{office:o[0]}));});
        list.filter(n=>(n.trait==='loyal'||n.trait==='devoted')&&n.favor>65).forEach(n=>opts.push(()=>petition('gift',n.id,{amount:Math.round(20+n.prestige/2)})));
        const schemers=list.filter(n=>n.trait==='scheming'&&n.favor<70);
        if(list.length>=2)schemers.forEach(n=>opts.push(()=>{const t=pick(list.filter(o=>o!==n));const charge=pick(['conspiracy','embezzlement','insubordination','offense']);openCase({kind:'noble',nobleId:t.id},charge,{type:'noble',nobleId:n.id},n.honest?null:false);log(n.name+' acusou '+t.name+' de '+CHARGES[charge].label.toLowerCase()+'.','Caso no Tribunal',colorOf(n.caste));}));
        list.filter(n=>n.trait==='scandalous'||n.hiddenDefect).forEach(n=>opts.push(()=>{const charge=n.hiddenDefect?'offcolor':pick(['fusion','offense','insubordination']);openCase({kind:'noble',nobleId:n.id},charge,{type:'empire'},Math.random()<.7);log('Escândalo: '+n.name+' é suspeita de '+CHARGES[charge].label.toLowerCase()+'.','Caso no Tribunal',colorOf(n.caste));}));
        if(matriarchs().length)list.filter(n=>n.trait!=='devoted'&&n.favor<45).forEach(n=>opts.push(()=>{const other=pick(presentDiamonds().filter(m=>m.id!==n.patron));if(other)petition('patron',n.id,{to:other.id});}));
        if(opts.length)pick(opts)();
    }
    function resolvePetition(pid,accept){
        const a=A(),pt=a.petitions.find(p=>p.id===pid);if(!pt)return;a.petitions=a.petitions.filter(p=>p!==pt);
        const n=nobleById(pt.nobleId);if(!n){refresh();return;}
        if(pt.kind==='office'){if(accept)appoint(n.id,pt.office);else{n.favor=clamp(n.favor-8);log('Você negou a '+n.name+' o cargo de '+OFFICES[pt.office].label+'.','−8 favor',colorOf(n.caste));}}
        else if(pt.kind==='gift'){if(accept){state.essence=essence()+pt.amount;n.favor=clamp(n.favor+2);log(n.name+' entregou um tributo de '+pt.amount+' de essência.','+'+pt.amount+' essência',colorOf(n.caste));}else{n.favor=clamp(n.favor+6);n.prestige=clamp(n.prestige+3);log('Você recusou com gratidão o tributo de '+n.name+'.','+6 favor',colorOf(n.caste));}}
        else if(pt.kind==='patron'){const to=diamondById(pt.to),from=n.patron!=='first'?diamondById(n.patron):null;
            if(accept&&to){n.patron=to.id;n.favor=clamp(n.favor+10);loyalty(to,3);if(from){loyalty(from,-5);relation(from.id,to.id,-6);}log(n.name+' passou para a corte de '+to.name+'.','+10 favor'+(from?' · '+from.name+' −5 lealdade':''),colorOf(n.caste));}
            else{n.favor=clamp(n.favor-10);if(from)loyalty(from,2);log('Você manteve '+n.name+' na corte de '+patronName(n.patron)+'.','−10 favor',colorOf(n.caste));}}
        refresh();
    }
    function defect(n){
        const p=PLANETS[n.planetId];if(!p)return;
        addCensus(p,n.caste,-1);n.status='defected';if(n.office){A().offices[n.office]=null;n.office=null;}
        const r=R()&&R()._res(p);
        if(r){r.members=(Number(r.members)||0)+1;r.memberCastes=r.memberCastes||{};r.memberCastes[n.caste]=(r.memberCastes[n.caste]||0)+1;r.strength=clamp((Number(r.strength)||0)+8);if(!r.leader)r.leader={name:n.name,caste:n.caste,type:'idealist',identified:true};}
        p.dissent=Math.min(100,(Number(p.dissent)||0)+4);
        log(n.name+' caiu em desgraça e desertou para a rebelião em '+p.shortName+'.','+8 força rebelde','#fb7185');
        chronicle('Deserção na aristocracia',n.name+' abandonou a Corte e se uniu aos rebeldes de '+p.shortName+'.','Nobreza');
        notify(n.name+' desertou para os rebeldes!',true);
    }
    function updateNobles(dt){
        const a=A(),target=40+a.prestige/4,k=dt/60;
        activeNobles().forEach(n=>{
            n.favor=clamp(n.favor+(target-n.favor)*.02*k+(n.office?1.5*k:0));
            n.prestige=clamp(n.prestige-.15*k);
            if(n.status==='court'&&n.favor<12&&Math.random()<.04*k)defect(n);
        });
        a.nobles=a.nobles.filter(n=>n.status!=='defected');
        a.petitions=a.petitions.filter(p=>{if(p.expires>now())return true;const n=nobleById(p.nobleId);if(n){n.favor=clamp(n.favor-5);log('O pedido de '+n.name+' ficou sem resposta.','−5 favor',colorOf(n.caste));}return false;});
        a.timers.intrigue-=dt*(a.offices.counselor?.7:1)*(1+(60-a.justice)/120);
        if(a.timers.intrigue<=0){a.timers.intrigue=240+Math.random()*240;intrigue();}
    }

    // ------------------------------------------------------------ bailes
    function venue(){
        const hw=PLANETS.homeworld;
        if(hw&&hw.colonized&&(Number(structuresOf(hw).royal_palace)||0)>0)return {id:'royal',label:'Palácio Real · '+(hw.shortName||'Homeworld'),planetId:'homeworld',bonus:10};
        const done=(state.morganiteArchitecture?.completed||[]).find(r=>r&&r.projectId==='reception_palace'&&PLANETS[r.planetId]?.colonized);
        if(done)return {id:'reception',label:'Palácio de Recepção · '+PLANETS[done.planetId].shortName,planetId:done.planetId,bonus:6};
        return null;
    }
    function ballCost(scale){const c=SCALES[scale].cost,f=A().offices.architect?.7:1;return {minerals:Math.round(c.minerals*f),essence:Math.round(c.essence*f)};}
    function guestNobles(scale){return activeNobles().filter(atCourt).sort((x,y)=>y.prestige-x.prestige).slice(0,SCALES[scale].nobles);}
    function setPlan(key,value){const p=A().plan;if(key==='diamond'){p.diamonds[value]=!p.diamonds[value];}else p[key]=value;refresh();}
    function startBall(){
        const a=A(),plan=a.plan,v=venue();
        if(a.ball){notify('Já há um baile em andamento.',true);return;}
        if(!v){notify('Bailes exigem o Palácio Real em Homeworld ou um Palácio de Recepção das Morganitas.',true);return;}
        if(a.ballReadyAt>now()){notify('O salão ainda está sendo preparado ('+dur((a.ballReadyAt-now())/1000)+').',true);return;}
        const scale=SCALES[plan.scale]?plan.scale:'intimate',cost=ballCost(scale);
        if(!canPay(cost)){notify('O baile custa '+fmt(cost.minerals)+' minerais e '+fmt(cost.essence)+' de essência.',true);return;}
        pay(cost);
        const diamonds=presentDiamonds().filter(m=>plan.diamonds[m.id]).map(m=>m.id);
        const honoree=plan.honoree&&diamonds.includes(plan.honoree)?plan.honoree:null;
        const nobles=guestNobles(scale).map(n=>n.id);
        const S=SCALES[scale],moments=[];for(let i=0;i<S.moments;i++)moments.push((i+1)/(S.moments+1));
        a.ball={id:a.nextId++,theme:THEMES[plan.theme]?plan.theme:'gala',scale,venue:v,diamonds,honoree,nobles,progress:0,moments,used:[],event:null,score:0,notes:[],started:now(),peek:null};
        const b=a.ball;
        // Qualidade de partida.
        let q=S.base+v.bonus;const notes=[];
        const jades=Math.min(6,empireCount('jade'));if(jades){q+=jades*3;notes.push(jades+' Jade(s) animam o salão (+'+jades*3+')');}
        if(a.offices.ceremonies){q+=8;notes.push('Mestra de Cerimônias (+8)');}
        const pearls=Math.min(5,empireCount('pearl'));if(pearls){q+=pearls*2;notes.push(pearls+' Pérola(s) servem (+'+pearls*2+')');}
        const fit=diamonds.length?diamonds.reduce((s,id)=>s+(THEMES[b.theme].pref[toneOf(diamondById(id))]||0),0)/diamonds.length:0;
        if(diamonds.length){const d=Math.round(fit*10);q+=d;notes.push('Tema para as Diamantes convidadas ('+(d>=0?'+':'')+d+')');}
        b.score=q;b.notes=notes;
        log('Começou o baile "'+THEMES[b.theme].label+'" ('+S.label+') no '+v.label+'.',diamonds.length+' Diamante(s) · '+nobles.length+' nobre(s)','#c4b5fd');
        notify('O baile começou. Fique atenta aos momentos do salão.');
        a.view='balls';refresh();
    }
    function ctxNames(){const b=A().ball;return {D:b.diamonds.map(diamondById).filter(Boolean),N:b.nobles.map(nobleById).filter(n=>n&&n.status==='court'),H:diamondById(b.honoree),host:PLANETS[b.venue.planetId]};}
    const EVENTS=[
        {id:'entrance',when:c=>!!c.H,title:c=>c.H.name+' chega ao salão',text:c=>'Todas as luzes se voltam para a homenageada da noite. O protocolo espera o seu gesto.',
            choices:[{label:'Recebê-la de pé, diante de todas',run:c=>{loyalty(c.H,5);c.D.filter(m=>m!==c.H&&relation(m.id,c.H.id)<0).forEach(m=>loyalty(m,-2));return [5,c.H.name+' foi recebida com honra (+5 lealdade)'];}},
                {label:'Seguir o protocolo à risca',run:()=>[2,'Entrada protocolar']},
                {label:'Fazê-la esperar, para mostrar quem manda',run:c=>{loyalty(c.H,-6);A().prestige=clamp(A().prestige+2);return [-3,c.H.name+' esperou (−6 lealdade, +2 prestígio)'];}}]},
        {id:'dance',when:c=>c.D.length>0,setup:c=>({m:pick(c.D).id}),title:(c,s)=>diamondById(s.m).name+' convida você para a dança de abertura',text:()=>'O salão abre espaço. Uma recusa seria notada por todas.',
            choices:[{label:'Aceitar a dança',run:(c,s)=>{const m=diamondById(s.m);loyalty(m,6);c.D.filter(o=>o!==m&&relation(o.id,m.id)<=-20).forEach(o=>loyalty(o,-3));return [5,'Você dançou com '+m.name+' (+6 lealdade)'];}},
                {label:'Ceder a dança a uma aristocrata',run:(c,s)=>{const m=diamondById(s.m),n=pick(c.N);loyalty(m,-2);if(n){n.favor=clamp(n.favor+10);n.prestige=clamp(n.prestige+6);}return [2,n?n.name+' dançou no seu lugar (+10 favor)':'A dança foi cedida'];}},
                {label:'Recusar com elegância',run:(c,s)=>{loyalty(diamondById(s.m),-4);return [0,'Recusa elegante (−4 lealdade)'];}}]},
        {id:'fusion',when:c=>{const k=censusOf(c.host);return (Number(k.ruby)||0)>=1&&(Number(k.sapphire)||0)>=1;},title:()=>'Uma Rubi e uma Safira se fundem no meio do salão',text:()=>'Da luz das duas surge uma Granada, que dança sozinha diante das convidadas. Fusões entre castas são proibidas. Todas olham para você.',
            choices:[{label:'Separá-las e levá-las ao Tribunal',run:c=>{openCase({kind:'gem',castes:['ruby','sapphire'],planetId:c.host.id,name:'Rubi e Safira da escolta'},'fusion',{type:'empire'},true);byTone(t=>t==='harsh'?2:t==='gentle'?-2:0);return [-2,'A Granada foi desfeita e o caso vai ao Tribunal'];}},
                {label:'Fingir que não viu',run:()=>{byTone(t=>t==='harsh'?-2:t==='gentle'?1:0);A().prestige=clamp(A().prestige-2);return [-3,'O escândalo correu pelo salão (−2 prestígio)'];}},
                {label:'Deixar a Granada dançar',run:()=>{byTone(t=>t==='harsh'?-5:t==='gentle'?3:t==='grand'?1:0);colonies().forEach(p=>p.dissent=Math.max(0,(Number(p.dissent)||0)-2));A().prestige=clamp(A().prestige-4);return [4,'A Granada encantou o salão; as Duras ficaram furiosas'];}}]},
        {id:'quarrel',when:c=>c.D.length>=2,setup:c=>{const pairs=[];c.D.forEach((x,i)=>c.D.slice(i+1).forEach(y=>pairs.push([x,y])));pairs.sort((p,q)=>relation(p[0].id,p[1].id)-relation(q[0].id,q[1].id));return {a:pairs[0][0].id,b:pairs[0][1].id};},
            title:(c,s)=>diamondById(s.a).name+' e '+diamondById(s.b).name+' discutem diante das convidadas',text:()=>'A música para. As aristocratas fingem não ouvir, mas ouvem tudo.',
            choices:[{label:'Apoiar a primeira',run:(c,s)=>{const x=diamondById(s.a),y=diamondById(s.b);loyalty(x,5);loyalty(y,-6);relation(x.id,y.id,-6);return [-1,x.name+' venceu a discussão'];}},
                {label:'Apoiar a segunda',run:(c,s)=>{const x=diamondById(s.a),y=diamondById(s.b);loyalty(y,5);loyalty(x,-6);relation(x.id,y.id,-6);return [-1,y.name+' venceu a discussão'];}},
                {label:'Mediar com calma',run:(c,s)=>{const x=diamondById(s.a),y=diamondById(s.b);relation(x.id,y.id,8);loyalty(x,1);loyalty(y,1);return [1,'Você reconciliou as duas (+8 relação)'];}},
                {label:'Mandar as duas se retirarem',run:(c,s)=>{const x=diamondById(s.a),y=diamondById(s.b);loyalty(x,-6);loyalty(y,-6);A().prestige=clamp(A().prestige+4);A().ball.diamonds=A().ball.diamonds.filter(id=>id!==x.id&&id!==y.id);return [-4,'As duas deixaram o baile (+4 prestígio)'];}}]},
        {id:'pearl',when:c=>empireCount('pearl')>0&&c.N.length>0,setup:c=>({n:pick(c.N).id}),title:(c,s)=>'Uma Pérola tropeça e derruba uma bandeja sobre '+nobleById(s.n).name,text:()=>'Cristais pelo chão. A Pérola se encolhe e espera o castigo.',
            choices:[{label:'Perdoar a Pérola',run:(c,s)=>{const n=nobleById(s.n);if(n)n.favor=clamp(n.favor-3);byTone(t=>t==='gentle'?1:0);return [1,'A Pérola foi perdoada'];}},
                {label:'Repreendê-la',run:(c,s)=>{const n=nobleById(s.n);if(n)n.favor=clamp(n.favor+2);return [0,'A Pérola foi repreendida'];}},
                {label:'Mandar embolhá-la',run:(c,s)=>{const n=nobleById(s.n);if(n)n.favor=clamp(n.favor+4);const p=c.host;let done=false;if(GF()&&GF().freeSpace(p)>0&&(Number(censusOf(p).pearl)||0)>0){addCensus(p,'pearl',-1);done=GF().bubble(p,'pearl',1,'empire',false,null)>0;}byTone(t=>t==='harsh'?2:t==='gentle'?-3:0);return [-3,done?'A Pérola foi embolhada diante de todas':'Sem Sala das Bolhas: a Pérola foi expulsa'];}}]},
        {id:'toast',when:c=>c.N.some(n=>n.trait==='vain'||n.trait==='scandalous'||n.trait==='ambitious'),setup:c=>({n:pick(c.N.filter(n=>['vain','scandalous','ambitious'].includes(n.trait))).id}),title:(c,s)=>nobleById(s.n).name+' ergue a taça e pede a palavra',text:()=>'Ela quer brilhar diante da Corte inteira.',
            choices:[{label:'Conceder a palavra',run:(c,s)=>{const n=nobleById(s.n);if(n.trait==='scandalous'&&Math.random()<.5){n.prestige=clamp(n.prestige-6);return [-4,n.name+' cometeu uma gafe no brinde'];}n.favor=clamp(n.favor+8);n.prestige=clamp(n.prestige+6);return [2,n.name+' fez um brinde memorável (+8 favor)'];}},
                {label:'Interromper com um gesto',run:(c,s)=>{const n=nobleById(s.n);n.favor=clamp(n.favor-10);return [1,n.name+' foi silenciada (−10 favor)'];}}]},
        {id:'crisis',when:()=>colonies().some(p=>(R()&&R().phase(p)>=2)||(p.hazards&&(p.hazards.lava||Number(p.hazards.blackoutUntil)>now()))),setup:()=>({p:pick(colonies().filter(p=>(R()&&R().phase(p)>=2)||(p.hazards&&(p.hazards.lava||Number(p.hazards.blackoutUntil)>now())))).id}),
            title:(c,s)=>'Um mensageiro chega de '+PLANETS[s.p].shortName,text:(c,s)=>'A situação em '+PLANETS[s.p].shortName+' piorou. As convidadas observam se você vai deixar o salão.',
            choices:[{label:'Encerrar o baile e voltar ao trono',run:(c,s)=>{const p=PLANETS[s.p];p.dissent=Math.max(0,(Number(p.dissent)||0)-6);if(R()){const r=R()._res(p);r.strength=clamp(r.strength-4);}A().ball.endNow=true;byTone(t=>t==='harsh'||t==='gentle'?2:t==='grand'?-3:0);return [-5,'Você deixou o baile para cuidar de '+p.shortName];}},
                {label:'Continuar o baile',run:(c,s)=>{const p=PLANETS[s.p];p.dissent=Math.min(100,(Number(p.dissent)||0)+6);byTone(t=>t==='gentle'?-2:t==='grand'?2:0);return [2,'O baile seguiu; '+p.shortName+' ficou sem resposta (+6 dissidência)'];}}]},
        {id:'whisper',when:c=>c.N.length>=2&&c.N.some(n=>n.trait==='scheming'),setup:c=>{const a=pick(c.N.filter(n=>n.trait==='scheming'));return {a:a.id,b:pick(c.N.filter(n=>n!==a)).id};},title:(c,s)=>nobleById(s.a).name+' sussurra uma acusação',text:(c,s)=>'"'+nobleById(s.b).name+' anda conspirando contra a Corte, Minha Diamante."',
            choices:[{label:'Levar ao Tribunal',run:(c,s)=>{const a=nobleById(s.a),b=nobleById(s.b);openCase({kind:'noble',nobleId:b.id},'conspiracy',{type:'noble',nobleId:a.id},a.honest?null:false);return [-1,'A acusação contra '+b.name+' foi ao Tribunal'];}},
                {label:'Ignorar a fofoca',run:(c,s)=>{const a=nobleById(s.a);a.favor=clamp(a.favor-5);return [0,'A fofoca foi ignorada'];}},
                {label:'Repreender quem sussurra',run:(c,s)=>{const a=nobleById(s.a);a.favor=clamp(a.favor-10);A().justice=clamp(A().justice+1);return [1,a.name+' foi repreendida pela fofoca'];}}]},
        {id:'vision',when:c=>c.N.some(n=>n.caste==='sapphire'),setup:c=>({n:pick(c.N.filter(n=>n.caste==='sapphire')).id,good:Math.random()<.6}),title:(c,s)=>nobleById(s.n).name+' tem uma visão no meio do baile',text:()=>'O olho da Safira brilha. Ela pede para falar.',
            choices:[{label:'Ouvir em particular',run:(c,s)=>{const pend=A().cases.find(x=>x.status==='pending'&&!x.revealed);if(pend){pend.revealed=true;return [3,'A Safira revelou a verdade de um caso pendente: '+caseName(pend)+' é '+(pend.truth?'culpada':'inocente')];}A().ball.peek=true;return [3,'A Safira antecipou o próximo momento do baile'];}},
                {label:'Pedir que anuncie a todas',run:(c,s)=>s.good?[6,'A profecia encantou o salão']:[-5,'A profecia sombria assustou as convidadas']}]},
        {id:'water',when:c=>c.N.some(n=>n.caste==='lapis'),title:()=>'As Lápis-Lazúlis erguem um espetáculo de água sobre o salão',text:()=>'Colunas de água dançam sob a luz dos cristais.',
            choices:[{label:'Aplaudir',run:c=>{c.N.filter(n=>n.caste==='lapis').forEach(n=>n.favor=clamp(n.favor+6));return [4,'O espetáculo foi aplaudido'];}},
                {label:'Pedir algo ainda maior',run:c=>Math.random()<.6?(c.N.filter(n=>n.caste==='lapis').forEach(n=>{n.favor=clamp(n.favor+8);n.prestige=clamp(n.prestige+5);}),[8,'Uma cascata gloriosa encerrou o número']):[-6,'A água desabou sobre as convidadas']}]},
        {id:'offcolor',when:()=>colonies().some(p=>Object.values(p.offColors?.groups||{}).some(v=>v>0)),title:()=>'Uma off-color entrou escondida entre as Pérolas',text:()=>'Seu corte é imperfeito. Algumas convidadas já notaram e cochicham.',
            choices:[{label:'Expulsá-la do salão',run:()=>{byTone(t=>t==='harsh'?2:t==='gentle'?-1:0);return [1,'A off-color foi expulsa'];}},
                {label:'Deixá-la ficar',run:()=>{byTone(t=>t==='gentle'?3:t==='harsh'?-3:0);colonies().forEach(p=>p.dissent=Math.max(0,(Number(p.dissent)||0)-1.5));return [-2,'A off-color ficou; as colônias souberam (−dissidência)'];}},
                {label:'Prendê-la para julgamento',run:c=>{const p=colonies().find(p=>Object.values(p.offColors?.groups||{}).some(v=>v>0));const k=Object.entries(p.offColors.groups).find(([,v])=>v>0)[0].split('|')[0];openCase({kind:'gem',castes:[k],planetId:p.id,name:label(k)+' off-color',off:true},'offcolor',{type:'empire'},true);byTone(t=>t==='harsh'?2:t==='gentle'?-2:0);return [-1,'A off-color foi presa para julgamento'];}}]}
    ];
    function nextEvent(){
        const b=A().ball,c=ctxNames();
        const pool=EVENTS.filter(e=>!b.used.includes(e.id)&&e.when(c));
        if(!pool.length)return null;
        const e=b.honoree&&!b.used.includes('entrance')&&pool.find(x=>x.id==='entrance')||pick(pool);
        b.used.push(e.id);
        const s=e.setup?e.setup(c):{};
        return {id:e.id,s,title:e.title(c,s),text:e.text(c,s),choices:e.choices.map(x=>x.label),deadline:now()+45000};
    }
    function choose(i){
        const a=A(),b=a.ball;if(!b||!b.event)return;
        const e=EVENTS.find(x=>x.id===b.event.id),ch=e&&e.choices[i];if(!ch)return;
        const [d,note]=ch.run(ctxNames(),b.event.s);
        b.score+=d;b.notes.push((d>=0?'+':'')+d+' · '+note);b.event=null;
        if(b.endNow)finishBall();
        refresh();
    }
    function tierOf(q){let t=TIERS[0];TIERS.forEach(x=>{if(q>=x.min)t=x;});return t;}
    function finishBall(){
        const a=A(),b=a.ball;if(!b)return;
        const S=SCALES[b.scale],q=Math.round(b.score*(b.endNow?.7:1)),t=tierOf(q),f=t.f*S.mult;
        const D=b.diamonds.map(diamondById).filter(Boolean),N=b.nobles.map(nobleById).filter(n=>n&&n.status==='court');
        D.forEach(m=>loyalty(m,Math.round(3*f)));
        const H=diamondById(b.honoree);if(H)loyalty(H,Math.round(4*t.f));
        D.forEach((x,i)=>D.slice(i+1).forEach(y=>relation(x.id,y.id,Math.round(4*f))));
        presentDiamonds().filter(m=>!b.diamonds.includes(m.id)).forEach(m=>loyalty(m,-2));
        N.forEach(n=>{n.favor=clamp(n.favor+5*f);n.prestige=clamp(n.prestige+4*f);});
        activeNobles().filter(n=>!b.nobles.includes(n.id)&&n.trait==='vain').forEach(n=>n.favor=clamp(n.favor-4));
        a.prestige=clamp(a.prestige+6*f);
        const host=PLANETS[b.venue.planetId];if(host)host.dissent=clamp((Number(host.dissent)||0)-5*f);
        const summary={id:b.id,theme:b.theme,scale:b.scale,score:q,tier:t.label,color:t.color,at:now(),notes:b.notes.slice(),diamonds:D.length,nobles:N.length,early:!!b.endNow};
        a.balls.unshift(summary);a.balls.length=Math.min(a.balls.length,8);
        a.ball=null;a.ballReadyAt=now()+BALL_COOLDOWN*1000;
        log('O baile "'+THEMES[b.theme].label+'" terminou: '+t.label+' ('+q+').',(f>=0?'+':'')+Math.round(6*f)+' prestígio imperial',t.color);
        chronicle('Baile '+t.label,'O baile "'+THEMES[b.theme].label+'" reuniu '+D.length+' Diamante(s) e '+N.length+' nobre(s).','Prestígio '+(f>=0?'+':'')+Math.round(6*f));
        notify('Baile encerrado: '+t.label+'.',t.f<0);
    }
    function updateBall(dt){
        const a=A(),b=a.ball;if(!b)return;
        if(b.event){if(b.event.deadline<=now()){const e=EVENTS.find(x=>x.id===b.event.id);const idx=Math.min(1,(e?.choices.length||1)-1);const [d,note]=e.choices[idx].run(ctxNames(),b.event.s);b.score+=d-2;b.notes.push((d-2>=0?'+':'')+(d-2)+' · Sem resposta: '+note);b.event=null;if(b.endNow)finishBall();}return;}
        b.progress=Math.min(1,b.progress+dt/SCALES[b.scale].duration);
        const due=b.moments.find(m=>m!=null&&b.progress>=m);
        if(due!=null){b.moments[b.moments.indexOf(due)]=null;b.event=nextEvent();if(b.event)notify('Baile: '+b.event.title+'.');}
        if(b.progress>=1&&!b.event)finishBall();
    }

    // ------------------------------------------------------------ tribunal
    function hasPalace(){const hw=PLANETS.homeworld;return !!(hw&&hw.colonized&&(Number(structuresOf(hw).royal_palace)||0)>0);}
    function zircons(except){return activeNobles().filter(n=>n.caste==='zircon'&&n.status==='court'&&!(except||[]).includes(n.id));}
    function caseName(c){const d=c.defendant;if(d.kind==='noble')return nobleById(d.nobleId)?.name||d.name||'Nobre';return d.name||'Ré';}
    function openCase(defendant,charge,accuser,forcedTruth){
        const a=A();
        if(defendant.kind==='noble'){const n=nobleById(defendant.nobleId);if(!n)return null;if(a.cases.some(c=>c.status!=='closed'&&c.defendant.kind==='noble'&&c.defendant.nobleId===n.id))return null;defendant.name=n.name;defendant.caste=n.caste;}
        let truth;
        if(forcedTruth===true||forcedTruth===false)truth=forcedTruth;
        else if(accuser.type==='noble'){const acc=nobleById(accuser.nobleId);truth=acc?(acc.honest?Math.random()<.8:Math.random()<.25):Math.random()<.6;}
        else truth=Math.random()<.65;
        if(defendant.kind==='noble'&&charge==='offcolor')truth=!!nobleById(defendant.nobleId)?.hiddenDefect||truth;
        const c={id:'cs'+(a.nextId++),defendant,charge,accuser,truth,status:'pending',created:now(),expires:now()+20*60000,revealed:false};
        a.cases.unshift(c);a.cases.length=Math.min(a.cases.length,12);
        if(defendant.kind==='noble'){const n=nobleById(defendant.nobleId);if(n)n.status='trial';}
        return c;
    }
    function freeDefendant(c){if(c.defendant.kind==='noble'){const n=nobleById(c.defendant.nobleId);if(n&&n.status==='trial')n.status='court';}}
    function scanLeaders(){
        if(!GF())return;const a=A();
        colonies().forEach(p=>Object.entries(GF()._fate(p).bubbles).forEach(([k,n])=>{
            if(!n||!k.split('|')[1]||k.split('|')[1]!=='leader')return;const id=p.id+'#'+k;if(a.leaderCases[id])return;
            a.leaderCases[id]=true;const caste=k.split('|')[0];
            openCase({kind:'leader',planetId:p.id,key:k,caste,name:'Líder rebelde ('+label(caste)+') de '+p.shortName},'rebellion',{type:'empire'},true);
            log('Uma líder rebelde embolhada em '+p.shortName+' aguarda julgamento.','Caso no Tribunal','#fb7185');
        }));
    }
    function dismissCase(id){
        const a=A(),c=a.cases.find(x=>x.id===id);if(!c||c.status!=='pending')return;
        c.status='closed';freeDefendant(c);
        if(c.accuser.type==='noble'){const acc=nobleById(c.accuser.nobleId);if(acc)acc.favor=clamp(acc.favor-6);}
        if(CHARGES[c.charge].sev>=3)a.justice=clamp(a.justice-2);
        a.history.unshift({name:caseName(c),charge:CHARGES[c.charge].label,verdict:'Arquivado',sentence:'',at:now(),truth:c.truth,judge:'Você'});a.history.length=Math.min(a.history.length,12);
        log('O caso contra '+caseName(c)+' foi arquivado.',CHARGES[c.charge].sev>=3?'−2 justiça':'',null);refresh();
    }
    function trialRequirements(c){
        if(!hasPalace())return 'O Tribunal funciona no Palácio Real de Homeworld.';
        const ex=c&&c.defendant.kind==='noble'?[c.defendant.nobleId]:[];
        if(!zircons(ex).length)return 'É preciso ao menos uma Zircônia na Corte para acusar.';
        return '';
    }
    function startTrial(id,judgeId){
        const a=A(),c=a.cases.find(x=>x.id===id);if(!c||c.status!=='pending')return;
        if(a.cases.some(x=>x.status==='trial'&&!x.delegated)&&!judgeId){notify('Já há um julgamento em andamento que você preside.',true);return;}
        const why=trialRequirements(c);if(why){notify(why,true);return;}
        const ex=c.defendant.kind==='noble'?[c.defendant.nobleId]:[];
        const office=nobleById(a.offices.prosecutor);
        const pros=office&&office.status==='court'&&!ex.includes(office.id)?office:zircons(ex)[0];
        const def=zircons([...ex,pros.id])[0]||null;
        const sev=CHARGES[c.charge].sev,dn=c.defendant.kind==='noble'?nobleById(c.defendant.nobleId):null;
        const accN=c.accuser.type==='noble'?nobleById(c.accuser.nobleId):null;
        let P=40+(c.truth?14:-4)+(pros.grade==='S'?8:0)+(a.offices.prosecutor===pros.id?10:0)+(accN?accN.prestige/10:0)+sev*2;
        let D=40+(c.truth?-4:14)+(def?(def.grade==='S'?16:8):-6)+(dn?dn.prestige/8:0);
        Object.assign(c,{status:'trial',prosecutor:pros.id,defender:def?def.id:null,P:Math.round(P),D:Math.round(D),round:0,stage:'args',clues:[],args:[],delegated:judgeId||null,started:now(),twist:null});
        if(judgeId){const m=diamondById(judgeId);c.judgeName=m?.name||'Diamante';c.endsAt=now()+90000;log(c.judgeName+' preside o julgamento de '+caseName(c)+'.','Decisão em 1:30','#5eead4');}
        else{nextArgs(c);a.view='trials';}
        refresh();
    }
    const PROS_LINES={
        fusion:['Todas no salão viram a fusão. A forma combinada dançou diante da Corte.','Fusões entre castas confundem a ordem que nos sustenta.'],
        insubordination:['Ela recebeu a ordem e a ignorou. Há registros.','Sua desobediência inspirou outras a hesitar.'],
        conspiracy:['Mensagens trocadas às escondidas indicam um plano contra a Corte.','Reuniões fora do protocolo, sempre nas mesmas câmaras.'],
        embezzlement:['A essência do seu setor desapareceu em ciclos regulares.','Os registros não fecham: falta essência.'],
        prophecy:['A visão anunciada não se cumpriu e custou caro ao império.','Ela anunciou um futuro que sabia ser impossível.'],
        negligence:['Seu posto ficou vazio quando era mais necessário.','O dano poderia ter sido evitado.'],
        offcolor:['O corte da ré não corresponde ao padrão do Jardim de Infância.','Ela escondeu um defeito de todas nós.'],
        offense:['Diante de testemunhas, ela desrespeitou uma Diamante.','Palavras assim não podem ficar sem resposta.'],
        rebellion:['Ela liderou a revolta. As colônias sangraram por sua causa.','Cada ataque rebelde levava a sua marca.']
    };
    const DEF_LINES=['As provas são circunstanciais; ninguém viu de fato.','A ré serviu ao império por ciclos sem uma única falha.','Quem acusa tem interesse direto na queda da ré.','Os registros apresentados foram adulterados.','A ré agiu sob ordem de uma superior; a culpa não é dela.','Há outra explicação, e a promotoria a ignorou.'];
    function nextArgs(c){c.round++;c.args=[pick(PROS_LINES[c.charge]||PROS_LINES.insubordination),c.defender?pick(DEF_LINES):'A ré se defende sozinha: "'+pick(['Eu sou inocente, Minha Diamante!','Nunca faria isso!','Tudo foi um mal-entendido.','Eu servi fielmente!'])+'"'];}
    function clue(c,accuracy,source){
        const right=Math.random()<accuracy,points=right===c.truth;
        const text=points?pick(['indica que a acusação procede','confirma a versão da promotoria','contradiz o álibi da ré']):pick(['indica que a ré diz a verdade','contradiz a promotoria','aponta outra explicação']);
        if(points)c.P+=12;else c.D+=12;
        c.clues.push(source+': '+text+'.');
    }
    function witnesses(c){
        const list=[];
        if(empireCount('pearl')>0)list.push({id:'pearl',label:'Uma Pérola (registra tudo)'});
        const seer=activeNobles().find(n=>n.caste==='sapphire'&&n.status==='court');if(seer)list.push({id:'sapphire',label:seer.name+' (visão)'});
        if(c.accuser.type==='noble'&&nobleById(c.accuser.nobleId))list.push({id:'accuser',label:'A acusadora, '+nobleById(c.accuser.nobleId).name});
        return list;
    }
    function act(id,action,arg){
        const a=A(),c=a.cases.find(x=>x.id===id);if(!c||c.status!=='trial'||c.delegated)return;
        if(c.stage==='args'){
            if(action==='pros'){c.P+=8+Math.round(Math.random()*4);c.D-=3;c.clues.push('Você acolheu a acusação.');}
            else if(action==='def'){c.D+=8+Math.round(Math.random()*4);c.P-=3;c.clues.push('Você acolheu a objeção da defesa.');}
            else if(action==='investigate'){if(essence()<10){notify('Investigar custa 10 de essência.',true);return;}state.essence=essence()-10;clue(c,.68+(a.offices.seer?.18:0),'Investigação');}
            else if(action==='witness'){
                if(arg==='pearl')clue(c,.9,'Gravação da Pérola');
                else if(arg==='sapphire')clue(c,a.offices.seer?.92:.8,'Visão da Safira');
                else if(arg==='accuser'){const acc=nobleById(c.accuser.nobleId);if(acc&&!acc.honest&&!c.truth){if(Math.random()<.45+(a.offices.seer?.2:0)){c.D+=18;c.liar=true;c.clues.push(acc.name+' se contradisse diante do Tribunal!');}else{c.P+=10;c.clues.push(acc.name+' repetiu a acusação com firmeza.');}}else{c.P+=9;c.clues.push((acc?acc.name:'A acusadora')+' confirmou a acusação.');}}
                else return;
            }else return;
            if(c.round>=3){
                const def=nobleById(c.defender);
                const chance=def?(c.truth?.12:.45)+(def.grade==='S'?.15:0):0;
                if(Math.random()<chance)c.twist=makeTwist(c);
                c.stage=c.twist?'twist':'verdict';
            }else nextArgs(c);
        }else if(c.stage==='twist'){
            const t=c.twist,def=nobleById(c.defender);
            if(action==='listen'){
                c.D+=25;c.clues.push('A defensora concluiu: '+t.text);
                if(t.kind==='accuser'){const acc=nobleById(t.nobleId);if(acc&&acc.status==='court'){openCase({kind:'noble',nobleId:acc.id},'conspiracy',{type:'empire'},!acc.honest);log(acc.name+' agora é ré por acusação falsa.','Novo caso','#5eead4');}}
                else if(t.kind==='diamond'){const m=diamondById(t.diamondId);if(m){loyalty(m,-8);m.grievances=(Number(m.grievances)||0)+1;log('A defesa acusou '+m.name+' diante da Corte.',m.name+' −8 lealdade',m.colorHex);}}
            }else if(action==='silence'){
                c.D-=20;a.justice=clamp(a.justice-12);byTone(t=>t==='harsh'?2:t==='gentle'?-3:-1);
                if(def){const p=PLANETS[def.planetId];if(p&&GF()&&GF().poof(p,'zircon',1,{reason:'noble:'+def.id})){def.status='poofed';}}
                c.clues.push('Você silenciou a defensora antes que terminasse.');
                log('Você poofou a Zircônia de defesa no meio do julgamento.','−12 justiça','#fb7185');
            }else return;
            c.stage='verdict';
        }else if(c.stage==='verdict'){
            if(action==='guilty'){c.verdict=true;c.stage='sentence';}
            else if(action==='innocent'){c.verdict=false;closeTrial(c,null,'Você');}
            else return;
        }else if(c.stage==='sentence'){
            if(!SENTENCES[action]||!SENTENCES[action].kinds.includes(c.defendant.kind))return;
            closeTrial(c,action,'Você');
        }
        refresh();
    }
    function makeTwist(c){
        const acc=c.accuser.type==='noble'?nobleById(c.accuser.nobleId):null;
        const dn=c.defendant.kind==='noble'?nobleById(c.defendant.nobleId):null;
        const patron=dn&&dn.patron!=='first'?diamondById(dn.patron):null;
        if(acc&&acc.status==='court'&&(!acc.honest||Math.random()<.4))return {kind:'accuser',nobleId:acc.id,text:'"A verdadeira culpada é quem acusa: '+acc.name+' armou tudo para derrubar a ré!"'};
        if(patron&&(Number(patron.loyalty)||0)<55)return {kind:'diamond',diamondId:patron.id,text:'"A ré apenas obedeceu. Quem deu a ordem foi '+patron.name+'!"'};
        return {kind:'doubt',text:'"As provas foram plantadas. Alguém nesta sala quer a ré estilhaçada!"'};
    }
    function balanceOf(c){return Math.max(0,c.P)/(Math.max(0,c.P)+Math.max(1,c.D));}
    function closeTrial(c,sentence,judge){
        const a=A(),sev=CHARGES[c.charge].sev,bal=balanceOf(c);
        let j=0;
        if(c.verdict){j+=bal>=.55?3:bal<.45?-6:0;}else{j+=bal<=.45?3:bal>.6?-4:0;}
        if(c.verdict&&sentence){const h=SENTENCES[sentence].harsh,ideal=sev===1?.5:sev===2?1.5:3;const diff=h-ideal;if(Math.abs(diff)<=1)j+=2;else if(diff>1)j-=Math.round((diff-1)*4);else j-=2;}
        a.justice=clamp(a.justice+j);
        const result=applySentence(c,sentence);
        // Reações
        if(c.accuser.type==='noble'){const acc=nobleById(c.accuser.nobleId);if(acc)acc.favor=clamp(acc.favor+(c.verdict?8:-8));}
        const h=sentence?SENTENCES[sentence].harsh:0;
        if(c.verdict&&h>=3)byTone(t=>t==='harsh'?2:t==='gentle'?-3:0);
        if(!c.verdict)byTone(t=>t==='harsh'&&bal>.6?-2:t==='gentle'?1:0);
        if(c.defendant.kind==='noble'){const n=nobleById(c.defendant.nobleId);if(n&&n.patron!=='first'){const m=diamondById(n.patron);loyalty(m,c.verdict?-h*2:2);}}
        c.status='closed';c.closedAt=now();
        c.verdictText=c.verdict?'Culpada':'Inocente';c.sentenceText=sentence?SENTENCES[sentence].label:'';
        if(c.verdict!==c.truth&&Math.random()<.4)c.revealAt=now()+(4+Math.random()*8)*60000;
        a.history.unshift({id:c.id,name:caseName(c),charge:CHARGES[c.charge].label,verdict:c.verdictText,sentence:c.sentenceText+(result?' · '+result:''),at:now(),judge,justice:j});a.history.length=Math.min(a.history.length,12);
        a.pendingReveals=(a.pendingReveals||[]).concat(c.revealAt?[{at:c.revealAt,name:caseName(c),truth:c.truth,verdict:c.verdict}]:[]);
        log('Julgamento de '+caseName(c)+': '+c.verdictText+(sentence?' · '+SENTENCES[sentence].label:'')+'.',(j>=0?'+':'')+j+' justiça','#5eead4');
        chronicle('Julgamento no Tribunal',caseName(c)+' foi declarada '+c.verdictText.toLowerCase()+' de '+CHARGES[c.charge].label.toLowerCase()+(sentence?' ('+SENTENCES[sentence].label.toLowerCase()+')':'')+'.','Justiça '+(j>=0?'+':'')+j);
        a.cases=a.cases.filter(x=>x!==c);
        notify('Veredito: '+c.verdictText+'.');
    }
    function applySentence(c,sentence){
        const d=c.defendant;
        if(d.kind==='noble'){
            const n=nobleById(d.nobleId);if(!n)return '';if(n.status==='trial')n.status='court';
            if(!c.verdict){n.favor=clamp(n.favor+6);n.prestige=clamp(n.prestige+4);return 'reputação restaurada';}
            if(d.kind==='noble'&&c.charge==='offcolor')n.hiddenDefect=false;
            if(sentence==='warning'){n.favor=clamp(n.favor-10);n.prestige=clamp(n.prestige-10);return '';}
            if(sentence==='strip'){if(n.office){A().offices[n.office]=null;n.office=null;}n.prestige=0;n.favor=clamp(n.favor-25);return '';}
            if(sentence==='exile'){exile(n,true);return PLANETS[n.planetId]?.shortName||'';}
            const p=PLANETS[n.planetId];
            if(sentence==='bubble'){if(p&&GF()&&GF().freeSpace(p)>0){addCensus(p,n.caste,-1);GF().bubble(p,n.caste,1,'empire',false,null);n.status='bubbled';}else{exile(n,true);return 'sem Sala das Bolhas: exilada';}}
            if(sentence==='shatter'){if(p)addCensus(p,n.caste,-1);if(GF())GF().stats().shattered++;n.status='shattered';activeNobles().forEach(o=>o.favor=clamp(o.favor-3));}
            if(n.office){A().offices[n.office]=null;n.office=null;}
            A().nobles=A().nobles.filter(x=>x!==n);
            return '';
        }
        if(d.kind==='gem'){
            const p=PLANETS[d.planetId];if(!p||!c.verdict)return '';
            if(sentence==='bubble'){let k=0;d.castes.forEach(caste=>{if((Number(censusOf(p)[caste])||0)>0&&GF()&&GF().freeSpace(p)>0){addCensus(p,caste,-1);GF().bubble(p,caste,1,'empire',!!d.off,null);k++;}});return k?k+' embolhada(s)':'sem Sala das Bolhas';}
            if(sentence==='shatter'){let k=0;d.castes.forEach(caste=>{if((Number(censusOf(p)[caste])||0)>0){addCensus(p,caste,-1);k++;}});if(GF())GF().stats().shattered+=k;p.dissent=Math.min(100,(Number(p.dissent)||0)+3*k);return k+' estilhaçada(s)';}
            return '';
        }
        if(d.kind==='leader'){
            const p=PLANETS[d.planetId];if(!p||!GF())return '';
            if(!c.verdict||sentence==='pardon'){GF().release(p.id,d.key,'free');const r=R()&&R()._res(p);if(r){r.strength=clamp(r.strength-8);}return 'libertada';}
            if(sentence==='shatter'){GF().release(p.id,d.key,'shatter');const r=R()&&R()._res(p);if(r)r.strength=clamp(r.strength-4);return 'mártir para os rebeldes';}
            return 'segue embolhada';
        }
        return '';
    }
    function delegatedVerdict(c){
        const m=diamondById(c.delegated),t=toneOf(m),bal=balanceOf(c),sev=CHARGES[c.charge].sev;
        let guilty;
        if(t==='harsh')guilty=bal>.35;else if(t==='gentle')guilty=bal>.65;else if(t==='cerebral')guilty=Math.random()<.8?c.truth:!c.truth;
        else{const acc=c.accuser.type==='noble'?nobleById(c.accuser.nobleId):null,dn=c.defendant.kind==='noble'?nobleById(c.defendant.nobleId):null;guilty=(acc?acc.prestige:50)>(dn?dn.prestige:30)||bal>.5;}
        c.verdict=guilty;
        let s=null;
        if(guilty){const kind=c.defendant.kind;const want=t==='harsh'?(sev>=2?'shatter':'bubble'):t==='gentle'?(kind==='leader'?'pardon':'warning'):t==='cerebral'?(sev>=3?'bubble':sev===2?(kind==='noble'?'strip':'bubble'):(kind==='leader'?'pardon':'warning')):(kind==='noble'?'exile':'bubble');
            s=SENTENCES[want].kinds.includes(kind)?want:(kind==='leader'?'bubble':'warning');}
        loyalty(m,3);
        closeTrial(c,s,m?.name||'Diamante');
    }
    function updateTrials(){
        const a=A();
        a.cases.slice().forEach(c=>{
            if(c.status==='trial'&&c.delegated&&c.endsAt<=now())delegatedVerdict(c);
            else if(c.status==='pending'&&c.expires<=now()){c.status='closed';freeDefendant(c);a.cases=a.cases.filter(x=>x!==c);a.justice=clamp(a.justice-2);log('O caso contra '+caseName(c)+' prescreveu sem julgamento.','−2 justiça',null);}
        });
        a.pendingReveals=(a.pendingReveals||[]).filter(r=>{if(r.at>now())return true;a.justice=clamp(a.justice-15);
            const text=r.truth?'Novas provas: '+r.name+' era culpada e foi absolvida.':'Novas provas: '+r.name+' era inocente e foi condenada.';
            log(text,'−15 justiça','#fb7185');chronicle('Erro judicial',text,'Justiça −15');notify(text,true);return false;});
    }
    function updateJustice(dt){
        const a=A(),k=dt/60;
        colonies().forEach(p=>{
            if(a.justice>70)p.dissent=Math.max(0,(Number(p.dissent)||0)-.5*k);
            else if(a.justice<30){p.dissent=Math.min(100,(Number(p.dissent)||0)+.8*k);const r=R()&&p.resistance&&R()._res(p);if(r&&r.strength>0)r.strength=clamp(r.strength+.3*k);}
        });
    }

    // ------------------------------------------------------------ laço
    let acc=0,ui=0;
    function update(dt){
        if(!state||!dt)return;
        acc+=dt;ui+=dt;
        updateBall(dt);
        if(acc>=5){const step=acc;acc=0;sync();scanLeaders();updateNobles(step);updateTrials();updateJustice(step);}
        if(ui>=1){ui=0;if(uiGate(1000))renderIfVisible();}
    }
    function refresh(){try{updateHUD();}catch(e){}const el=document.getElementById('governance-content');if(el&&state.currentScreen==='governance'&&state.governanceSection==='aristocracy')render(el);}
    function renderIfVisible(){if(state.currentScreen!=='governance'||state.governanceSection!=='aristocracy')return;const el=document.getElementById('governance-content');if(el&&!el.contains(document.activeElement)||el&&document.activeElement===document.body)render(el);}
    function setView(v){A().view=v;refresh();}

    // ------------------------------------------------------------ interface
    const bar=(lbl,v,color)=>'<div class="court-bar"><span>'+lbl+'</span><div><i style="width:'+clamp(v)+'%;background:'+color+'"></i></div><b>'+Math.round(v)+'</b></div>';
    function header(){
        const a=A(),pend=a.cases.filter(c=>c.status==='pending').length,trial=a.cases.filter(c=>c.status==='trial').length;
        const tabs=[['nobles','Nobreza',a.petitions.length],['balls','Bailes',a.ball?(a.ball.event?'!':'♪'):0],['trials','Tribunal',pend+trial]];
        return '<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">🎭 Aristocracia</span><span class="badge">'+activeNobles().length+' nobres</span></div>'+
            '<p class="governance-muted">As aristocratas da Corte têm nome, temperamento e ambições. Bailes aproximam ou afastam as Diamantes; o Tribunal das Zircônias julga escândalos, intrigas e rebeldes.</p>'+
            bar('Prestígio',a.prestige,'#c4b5fd')+bar('Justiça',a.justice,a.justice<30?'#fb7185':a.justice>70?'#6ee7b7':'#f2cf86')+
            '<small class="governance-muted">Justiça acima de 70 acalma as colônias; abaixo de 30 alimenta a dissidência e a rebelião. Prestígio eleva o favor natural das nobres.</small>'+
            '<div class="ar-tabs">'+tabs.map(([k,l,n])=>'<button class="btn'+(a.view===k?' active':'')+'" onclick="GempireAristocracy.view(\''+k+'\')">'+l+(n?' <span class="ar-dot">'+n+'</span>':'')+'</button>').join('')+'</div></section>';
    }
    function nobleCard(n){
        const a=A(),exiled=Number(n.exiledUntil)>now(),p=PLANETS[n.planetId];
        const offices=Object.entries(OFFICES).filter(([,o])=>o.castes.includes(n.caste));
        let h='<div class="ar-noble'+(n.status==='trial'?' ar-ontrial':'')+'" style="--gem:'+colorOf(n.caste)+'"><div class="court-row"><b><i class="ar-gem"></i>'+esc(n.name)+(n.grade==='S'?' <span class="badge">Rank S</span>':'')+'</b><span class="badge" title="'+esc(TRAITS[n.trait].desc)+'">'+TRAITS[n.trait].label+'</span></div>'+
            '<small class="governance-muted">'+esc(label(n.caste))+' · '+esc(p?.shortName||'')+' · corte de '+esc(patronName(n.patron))+(n.office?' · <b style="color:#f2cf86">'+OFFICES[n.office].label+'</b>':'')+(exiled?' · exilada ('+dur((n.exiledUntil-now())/1000)+')':'')+(n.status==='trial'?' · <b style="color:#5eead4">em julgamento</b>':'')+(n.status==='poofed'?' · <b style="color:#fb7185">poofada</b>':'')+'</small>'+
            bar('Favor',n.favor,n.favor<25?'#fb7185':'#6ee7b7')+bar('Prestígio',n.prestige,'#c4b5fd');
        if(n.status==='court'&&!exiled){
            h+='<div class="court-actions"><button class="btn" onclick="GempireAristocracy.honor('+n.id+')">Honrar · 20 essência</button><button class="btn" onclick="GempireAristocracy.reprimand('+n.id+')">Repreender</button>'+
                (n.office?'<button class="btn" onclick="GempireAristocracy.dismiss('+n.id+')">Dispensar do cargo</button>':offices.map(([k,o])=>'<button class="btn" onclick="GempireAristocracy.appoint('+n.id+',\''+k+'\')" title="'+esc(o.desc)+'">'+o.label+(a.offices[k]?' (substituir)':'')+'</button>').join(''))+
                '<button class="btn" onclick="GempireAristocracy.exile('+n.id+')">Exilar</button><button class="btn btn-pink" onclick="GempireAristocracy.accuse('+n.id+')">Levar ao Tribunal</button></div>';
        }
        return h+'</div>';
    }
    function renderNobles(){
        const a=A(),list=activeNobles().concat(a.nobles.filter(n=>n.status==='poofed'));
        let h='';
        if(a.petitions.length){h+='<section class="card card-amber"><div class="card-header"><span class="card-title">Pedidos da nobreza</span><span class="badge">'+a.petitions.length+'</span></div>'+a.petitions.map(pt=>{const n=nobleById(pt.nobleId);if(!n)return '';
            const t=pt.kind==='office'?n.name+' pede o cargo de '+OFFICES[pt.office].label+'.'+(a.offices[pt.office]?' (Hoje com '+esc(nobleById(a.offices[pt.office])?.name||'outra')+'.)':''):pt.kind==='gift'?n.name+' oferece um tributo de '+pt.amount+' de essência ao trono.':n.name+' pede para deixar a corte de '+patronName(n.patron)+' e servir '+patronName(pt.to)+'.';
            return '<div class="ar-event"><span>'+esc(t)+'</span><small class="governance-muted">Expira em '+dur((pt.expires-now())/1000)+'</small><div class="court-actions"><button class="btn btn-emerald" onclick="GempireAristocracy.petition(\''+pt.id+'\',true)">'+(pt.kind==='gift'?'Aceitar o tributo':'Conceder')+'</button><button class="btn" onclick="GempireAristocracy.petition(\''+pt.id+'\',false)">'+(pt.kind==='gift'?'Recusar com gratidão':'Recusar')+'</button></div></div>';}).join('')+'</section>';}
        h+='<section class="card"><div class="card-header"><span class="card-title">Cargos da Corte</span></div><div class="ar-offices">'+Object.entries(OFFICES).map(([k,o])=>{const n=nobleById(a.offices[k]);return '<div class="stat-box"><b>'+o.label+'</b><small style="display:block;color:var(--text-muted)">'+esc(o.desc)+' Casta: '+o.castes.map(label).join(', ')+'.</small><span style="color:'+(n?colorOf(n.caste):'#94a3b8')+'">'+(n?esc(n.name):'Vago')+'</span></div>';}).join('')+'</div></section>';
        if(!list.length)h+='<section class="card"><p class="governance-muted">Ainda não há aristocratas na Corte. Safiras, Jades, Morganitas, Águas-marinhas, Esmeraldas, Lápis-Lazúlis e Zircônias formadas nas colônias entram aqui automaticamente (até '+PER_PLANET+' de cada casta por colônia).</p></section>';
        else h+='<section class="card ar-wide"><div class="card-header"><span class="card-title">Nobres</span><span class="badge">'+list.length+'</span></div><div class="ar-grid">'+list.sort((x,y)=>y.prestige-x.prestige).map(nobleCard).join('')+'</div></section>';
        h+=renderLog();
        return h;
    }
    function renderBalls(){
        const a=A(),v=venue(),b=a.ball,plan=a.plan;
        let h='';
        if(b){
            const S=SCALES[b.scale],t=tierOf(b.score);
            h+='<section class="card card-amber ar-ball ar-wide"><div class="card-header"><span class="card-title title-font">♪ '+THEMES[b.theme].label+'</span><span class="badge">'+S.label+' · '+esc(b.venue.label)+'</span></div>'+
                bar('Noite',b.progress*100,'#f2cf86')+'<div class="court-row"><span>Qualidade atual: <b style="color:'+t.color+'">'+Math.round(b.score)+' · '+t.label+'</b></span><small class="governance-muted">'+b.diamonds.length+' Diamante(s) · '+b.nobles.length+' nobre(s)</small></div>';
            if(b.event){h+='<div class="ar-event ar-moment"><b>'+esc(b.event.title)+'</b><span>'+esc(b.event.text)+'</span><small class="governance-muted">Sem resposta em '+dur((b.event.deadline-now())/1000)+', o salão decide por você.</small><div class="court-actions">'+b.event.choices.map((c,i)=>'<button class="btn'+(i===0?' btn-emerald':'')+'" onclick="GempireAristocracy.choose('+i+')">'+esc(c)+'</button>').join('')+'</div></div>';}
            else if(b.peek){const nxt=EVENTS.filter(e=>!b.used.includes(e.id)&&e.when(ctxNames()));h+='<small class="governance-muted">A Safira prevê: '+(nxt.length?esc(nxt.map(e=>e.id==='dance'?'uma dança':e.id==='quarrel'?'uma discussão':e.id==='fusion'?'uma fusão':e.id==='crisis'?'notícias ruins':e.id==='toast'?'um brinde':e.id==='water'?'um espetáculo':'algo inesperado').slice(0,2).join(' ou ')):'uma noite tranquila')+'.</small>';}
            h+='<div class="ar-notes">'+b.notes.map(n=>'<small>'+esc(n)+'</small>').join('')+'</div></section>';
        }else{
            const cost=ballCost(plan.scale),ready=a.ballReadyAt<=now();
            h+='<section class="card card-amber ar-wide"><div class="card-header"><span class="card-title title-font">Organizar um baile</span><span class="badge">'+(v?esc(v.label):'Sem salão')+'</span></div>';
            if(!v)h+='<p class="governance-muted">Bailes acontecem no Palácio Real de Homeworld ou num Palácio de Recepção construído pelas Morganitas.</p>';
            h+='<div class="court-subtitle">Tema</div><div class="ar-choice">'+Object.entries(THEMES).map(([k,t])=>'<button class="btn'+(plan.theme===k?' active':'')+'" onclick="GempireAristocracy.plan(\'theme\',\''+k+'\')" title="'+esc(t.desc)+'">'+t.label+'</button>').join('')+'</div><small class="governance-muted">'+esc(THEMES[plan.theme]?.desc||'')+'</small>';
            h+='<div class="court-subtitle">Porte</div><div class="ar-choice">'+Object.entries(SCALES).map(([k,s])=>{const c=ballCost(k);return '<button class="btn'+(plan.scale===k?' active':'')+'" onclick="GempireAristocracy.plan(\'scale\',\''+k+'\')">'+s.label+'<small style="display:block">'+fmt(c.minerals)+' min · '+fmt(c.essence)+' ess · '+s.moments+' momentos</small></button>';}).join('')+'</div>';
            const D=presentDiamonds();
            h+='<div class="court-subtitle">Diamantes convidadas</div>'+(D.length?'<div class="ar-choice">'+D.map(m=>{const on=!!plan.diamonds[m.id],fit=THEMES[plan.theme].pref[toneOf(m)]||0;return '<button class="btn'+(on?' active':'')+'" style="border-color:'+m.colorHex+'" onclick="GempireAristocracy.plan(\'diamond\',\''+m.id+'\')"><i class="diamond-icon" style="background:'+m.colorHex+'"></i> '+esc(m.name)+'<small style="display:block">'+(fit>0?'gosta do tema':fit<0?'não gosta do tema':'indiferente')+'</small></button>';}).join('')+'</div><small class="governance-muted">Diamantes na Corte que não forem convidadas se sentem esnobadas (−2 lealdade).</small>':'<small class="governance-muted">Nenhuma Diamante disponível na Corte.</small>');
            const inv=D.filter(m=>plan.diamonds[m.id]);
            if(inv.length)h+='<div class="court-subtitle">Homenageada</div><div class="ar-choice"><button class="btn'+(!plan.honoree?' active':'')+'" onclick="GempireAristocracy.plan(\'honoree\',null)">Nenhuma</button>'+inv.map(m=>'<button class="btn'+(plan.honoree===m.id?' active':'')+'" onclick="GempireAristocracy.plan(\'honoree\',\''+m.id+'\')">'+esc(m.name)+'</button>').join('')+'</div>';
            const N=guestNobles(plan.scale);
            h+='<div class="court-subtitle">Nobres convidadas (as de maior prestígio)</div><small class="governance-muted">'+(N.length?N.map(n=>esc(n.name)).join(', '):'nenhuma')+'. Vaidosas deixadas de fora perdem favor.</small>';
            h+='<small class="governance-muted" style="display:block;margin-top:6px">Atrações: '+Math.min(6,empireCount('jade'))+' Jade(s)'+(A().offices.ceremonies?' + Mestra de Cerimônias':'')+' · '+Math.min(5,empireCount('pearl'))+' Pérola(s)'+(A().offices.architect?' · Arquiteta dos Salões (−30% custo)':'')+'</small>';
            h+='<div class="court-actions"><button class="btn btn-emerald" '+(v&&ready&&canPay(cost)?'':'disabled')+' onclick="GempireAristocracy.startBall()">Abrir o baile · '+fmt(cost.minerals)+' minerais · '+fmt(cost.essence)+' essência</button></div>'+(ready?'':'<small class="governance-muted">O salão estará pronto em '+dur((a.ballReadyAt-now())/1000)+'.</small>')+'</section>';
        }
        if(a.balls.length)h+='<section class="card"><div class="card-header"><span class="card-title">Bailes anteriores</span></div>'+a.balls.map(x=>'<div class="court-log" style="border-left-color:'+x.color+'"><span><b>'+esc(THEMES[x.theme]?.label||'')+'</b> · '+SCALES[x.scale].label+' · <b style="color:'+x.color+'">'+x.tier+' ('+x.score+')</b>'+(x.early?' · encerrado cedo':'')+'</span><small>'+x.diamonds+' Diamante(s) · '+x.nobles+' nobre(s)</small></div>').join('')+'</section>';
        return h;
    }
    function scaleHTML(c){const b=balanceOf(c),deg=Math.round((b-.5)*40);return '<div class="ar-scale"><span>Defesa</span><div class="ar-beam" style="transform:rotate('+deg+'deg)"><i></i><i></i></div><span>Acusação</span></div><small class="governance-muted" style="display:block;text-align:center">A balança mostra o peso dos argumentos diante da Corte ('+Math.round(b*100)+'% pela acusação).</small>';}
    function caseHeader(c){const d=c.defendant,acc=c.accuser.type==='noble'?nobleById(c.accuser.nobleId):null;
        return '<div class="court-row"><b>'+esc(caseName(c))+'</b><span class="badge">'+CHARGES[c.charge].label+' · gravidade '+CHARGES[c.charge].sev+'</span></div><small class="governance-muted">'+(d.kind==='leader'?'Embolhada em '+esc(PLANETS[d.planetId]?.shortName||''):d.kind==='gem'?esc(PLANETS[d.planetId]?.shortName||''):esc(label(d.caste))+' · '+esc(PLANETS[nobleById(d.nobleId)?.planetId]?.shortName||''))+' · acusação: '+(acc?esc(acc.name):'o Império')+(c.revealed?' · <b style="color:#c4b5fd">a Safira viu: '+(c.truth?'culpada':'inocente')+'</b>':'')+'</small>';}
    function renderTrials(){
        const a=A();let h='';
        const zs=zircons();
        h+='<section class="card"><div class="card-header"><span class="card-title title-font">⚖️ Tribunal das Zircônias</span><span class="badge">'+(hasPalace()?'Palácio Real':'Sem Palácio Real')+'</span></div><p class="governance-muted">Uma Zircônia acusa; com duas ou mais, outra defende (sem defensora, a ré fala por si e perde força). Você preside ou delega a uma Diamante: Duras condenam com facilidade e punem forte, Gentis absolvem e perdoam, Racionais seguem a verdade, Grandiosas favorecem quem tem mais prestígio.</p><small class="governance-muted">Zircônias na Corte: '+(zs.length?zs.map(z=>esc(z.name)+(a.offices.prosecutor===z.id?' (Promotora)':'')).join(', '):'nenhuma — forme Zircônias com Silicato refinado')+'</small></section>';
        const mine=a.cases.find(c=>c.status==='trial'&&!c.delegated);
        if(mine){const c=mine,pros=nobleById(c.prosecutor),def=nobleById(c.defender);
            h+='<section class="card card-cyan ar-trial ar-wide">'+caseHeader(c)+scaleHTML(c);
            h+='<div class="ar-bench"><div style="--gem:'+colorOf('zircon')+'"><small>Acusação</small><b>'+esc(pros?.name||'Zircônia')+'</b></div><div style="--gem:'+(def?colorOf('zircon'):'#94a3b8')+'"><small>Defesa</small><b>'+esc(def?def.name:'A própria ré')+'</b></div></div>';
            if(c.stage==='args'){h+='<div class="court-subtitle">Rodada '+c.round+' de 3</div><div class="ar-event"><span><b>Promotora:</b> "'+esc(c.args[0])+'"</span><span><b>Defesa:</b> '+(c.defender?'"'+esc(c.args[1])+'"':esc(c.args[1]))+'</span></div>'+
                '<div class="court-actions"><button class="btn" onclick="GempireAristocracy.act(\''+c.id+'\',\'pros\')">Acolher a acusação</button><button class="btn" onclick="GempireAristocracy.act(\''+c.id+'\',\'def\')">Acolher a objeção da defesa</button><button class="btn" onclick="GempireAristocracy.act(\''+c.id+'\',\'investigate\')">Exigir provas · 10 essência</button>'+witnesses(c).map(w=>'<button class="btn" onclick="GempireAristocracy.act(\''+c.id+'\',\'witness\',\''+w.id+'\')">Testemunha: '+esc(w.label)+'</button>').join('')+'</div>';}
            else if(c.stage==='twist'){h+='<div class="ar-event ar-moment"><b>Reviravolta!</b><span>'+esc(def?.name||'A defensora')+' se levanta: '+esc(c.twist.text)+'</span><div class="court-actions"><button class="btn btn-emerald" onclick="GempireAristocracy.act(\''+c.id+'\',\'listen\')">Deixá-la concluir</button><button class="btn btn-pink" onclick="GempireAristocracy.act(\''+c.id+'\',\'silence\')">Silenciá-la (poofar a Zircônia)</button></div></div>';}
            else if(c.stage==='verdict'){h+='<div class="court-subtitle">Veredito</div><div class="court-actions"><button class="btn btn-pink" onclick="GempireAristocracy.act(\''+c.id+'\',\'guilty\')">Culpada</button><button class="btn btn-emerald" onclick="GempireAristocracy.act(\''+c.id+'\',\'innocent\')">Inocente</button></div><small class="governance-muted">Um veredito contra a balança custa justiça; vereditos errados podem ser revelados mais tarde.</small>';}
            else if(c.stage==='sentence'){const p=c.defendant.planetId?PLANETS[c.defendant.planetId]:PLANETS[nobleById(c.defendant.nobleId)?.planetId];const bubbleOk=c.defendant.kind==='leader'||(p&&GF()&&GF().freeSpace(p)>0);
                h+='<div class="court-subtitle">Sentença</div><div class="court-actions">'+Object.entries(SENTENCES).filter(([,s])=>s.kinds.includes(c.defendant.kind)).map(([k,s])=>{const lbl=c.defendant.kind==='leader'&&k==='bubble'?'Manter embolhada':s.label;const dis=(k==='bubble'&&!bubbleOk)||(k==='exile'&&!exileTarget(nobleById(c.defendant.nobleId)||{}));return '<button class="btn'+(s.harsh>=3?' btn-pink':'')+'" '+(dis?'disabled':'')+' onclick="GempireAristocracy.act(\''+c.id+'\',\''+k+'\')">'+lbl+'</button>';}).join('')+'</div><small class="governance-muted">Sentenças proporcionais à gravidade aumentam a justiça; exageros ou brandura demais a reduzem.</small>';}
            if(c.clues.length)h+='<div class="ar-notes">'+c.clues.map(x=>'<small>'+esc(x)+'</small>').join('')+'</div>';
            h+='</section>';}
        a.cases.filter(c=>c.status==='trial'&&c.delegated).forEach(c=>{h+='<section class="card">'+caseHeader(c)+'<small class="governance-muted">'+esc(c.judgeName)+' preside. Veredito em '+dur((c.endsAt-now())/1000)+'.</small>'+scaleHTML(c)+'</section>';});
        const pend=a.cases.filter(c=>c.status==='pending');
        h+='<section class="card"><div class="card-header"><span class="card-title">Casos aguardando</span><span class="badge">'+pend.length+'</span></div>'+(pend.length?pend.map(c=>{const why=trialRequirements(c);const judges=presentDiamonds();
            return '<div class="ar-event">'+caseHeader(c)+'<small class="governance-muted">Prescreve em '+dur((c.expires-now())/1000)+'.'+(why?' '+esc(why):'')+'</small><div class="court-actions"><button class="btn btn-emerald" '+(why||mine?'disabled':'')+' onclick="GempireAristocracy.startTrial(\''+c.id+'\')">Presidir o julgamento</button>'+judges.map(m=>'<button class="btn" '+(why?'disabled':'')+' onclick="GempireAristocracy.startTrial(\''+c.id+'\',\''+m.id+'\')">Delegar a '+esc(m.name)+'</button>').join('')+'<button class="btn" onclick="GempireAristocracy.dismissCase(\''+c.id+'\')">Arquivar</button></div></div>';}).join(''):'<p class="governance-muted">Nenhum caso. Escândalos nos bailes, intrigas da nobreza e líderes rebeldes embolhadas chegam aqui.</p>')+'</section>';
        if(a.history.length)h+='<section class="card"><div class="card-header"><span class="card-title">Vereditos</span></div>'+a.history.map(x=>'<div class="court-log"><span><b>'+esc(x.name)+'</b> · '+esc(x.charge)+' · <b>'+esc(x.verdict)+'</b>'+(x.sentence?' · '+esc(x.sentence):'')+'</span><small>Juíza: '+esc(x.judge)+(x.justice!=null?' · '+(x.justice>=0?'+':'')+x.justice+' justiça':'')+'</small></div>').join('')+'</section>';
        return h;
    }
    function renderLog(){const L=A().log;return L.length?'<section class="card"><div class="card-header"><span class="card-title">Crônica da nobreza</span></div>'+L.slice(0,12).map(e=>'<div class="court-log"'+(e.color?' style="border-left-color:'+e.color+'"':'')+'><span>'+esc(e.text)+'</span>'+(e.impact?'<small>'+esc(e.impact)+'</small>':'')+'</div>').join('')+'</section>':'';}
    function render(container){
        sync();
        const a=A();
        const body=a.view==='balls'?renderBalls():a.view==='trials'?renderTrials():renderNobles();
        const scroll=container.scrollTop;
        container.innerHTML=header()+body;
        container.scrollTop=scroll;
    }
    function throneCard(){
        const a=A(),pend=a.cases.filter(c=>c.status==='pending').length;
        if(!activeNobles().length&&!pend&&!a.ball)return '';
        return '<div class="card card-amber"><div class="card-header"><span class="card-title title-font">🎭 Aristocracia</span><span class="badge">'+(a.ball?'Baile em andamento':pend?pend+' caso(s)':activeNobles().length+' nobres')+'</span></div><p class="structure-desc">Prestígio '+Math.round(a.prestige)+' · Justiça '+Math.round(a.justice)+(a.petitions.length?' · '+a.petitions.length+' pedido(s) da nobreza':'')+'</p><button class="btn btn-block" onclick="switchScreen(\'governance\');switchGovernanceSection(\'aristocracy\')">Abrir Aristocracia</button></div>';
    }
    window.GempireAristocracy={update,render,throneCard,view:setView,honor,reprimand,appoint,dismiss,exile:exileAction,accuse:accuseAction,petition:resolvePetition,plan:setPlan,startBall,choose,startTrial,act,dismissCase,
        summary:()=>({nobles:activeNobles().length,cases:A().cases.length,ball:!!A().ball,justice:A().justice,prestige:A().prestige}),
        _debug:{A,sync,openCase,intrigue,finishBall,defect,nobleById,EVENTS}};
    window.renderAristocracyTab=render;
})();
