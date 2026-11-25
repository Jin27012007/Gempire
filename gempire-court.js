/* =========================================================================
 * GEMPIRE · Corte das Diamantes
 *
 * Mecânicas de interação com as Matriarcas (Diamantes criadas pelo império):
 *  1. Pedidos e agendas  — cada personalidade tem objetivos e faz pedidos com prazo.
 *     Atender, negociar, recusar ou ignorar muda lealdade, autonomia e queixas.
 *     Diamantes insatisfeitas agem sozinhas e, no limite, se rebelam.
 *  2. Audiências         — elogiar, repreender, conceder autonomia, presentear,
 *     exigir tributo, comunhão e relatório. Cada personalidade reage de um jeito.
 *  3. Missões delegadas  — explorar, pacificar, supervisionar extração, meditar e
 *     diplomacia. Duram um tempo e o resultado depende de lealdade, poder e afinidade.
 *  4. Política da corte  — relações entre Diamantes (alianças e rivalidades),
 *     disputas que a fundadora media e votações do conselho com efeitos reais.
 *
 * Carregado depois do script principal: usa state, PLANETS e funções globais do jogo.
 * Todo o estado fica em state.court e nos próprios objetos das Matriarcas (vai no save).
 * ========================================================================= */
(function(){
    'use strict';
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const TONE_LABEL={harsh:'Dura',gentle:'Gentil',cerebral:'Racional',grand:'Grandiosa'};
    const TONE_AFFINITY={'harsh|harsh':20,'gentle|gentle':20,'cerebral|cerebral':20,'grand|grand':20,'gentle|harsh':-30,'cerebral|grand':-12,'cerebral|harsh':0,'gentle|grand':10,'grand|harsh':5,'cerebral|gentle':0};
    const LINES={
        harsh:{greet:{loyal:'Minhas tropas aguardam sua ordem, Minha Diamante.',uneasy:'Fale rápido. Há fronteiras a vigiar.',resentful:'Ainda me chama? Pensei que preferisse governar sozinha.'},
            praise:'Reconhecimento é bom. Resultados são melhores.',reprimand:'Entendido. Não haverá uma segunda falha.',autonomy:'Finalmente posso agir sem esperar permissão.',gift:'Essência para a guarda. Será bem usada.',
            tributeOk:'Tome. Que sirva ao império.',tributeNo:'Exigir de mim enquanto me ignora? Não.',commune:'...Nossas mentes alinhadas. Como uma formação perfeita.',
            refuseMission:'Não arrisco meus soldados por quem não confia em mim.',missionOk:'Missão cumprida. Sem baixas desnecessárias.',missionFail:'O terreno estava contra nós. Recuei a tempo.',
            refused:'Lembrarei disso.',fulfilled:'Assim se governa um império.',rebel:'Basta. Minha colônia não obedece mais a ninguém.',reconcile:'Aceito a trégua. Por enquanto.'},
        gentle:{greet:{loyal:'Que bom ouvir sua voz, Minha Diamante.',uneasy:'Há algo que me preocupa... mas pode falar.',resentful:'Eu esperei tanto que você me escutasse.'},
            praise:'Obrigada. Isso significa muito para mim.',reprimand:'Eu... entendo. Vou me esforçar mais.',autonomy:'Vou cuidar da minha colônia com todo o carinho.',gift:'Que gesto generoso. A corte sentirá esta essência.',
            tributeOk:'Se é pelo bem de todas, aceito.',tributeNo:'Tirar mais de nós? As colônias já sofrem tanto.',commune:'Sinto sua mente... calma e luminosa.',
            refuseMission:'Não consigo... não enquanto sinto que você não me ouve.',missionOk:'Voltei. Ninguém se feriu, e isso basta.',missionFail:'Eu tentei, de verdade. Não foi suficiente.',
            refused:'Tudo bem... eu entendo.',fulfilled:'Você ouviu. Obrigada.',rebel:'Não posso mais assistir a isso calada. Minha colônia segue por conta própria.',reconcile:'Eu queria acreditar em você de novo.'},
        cerebral:{greet:{loyal:'Os relatórios estão em ordem. Em que posso ser útil?',uneasy:'Meus cálculos indicam atrito entre nós.',resentful:'Probabilidade de você me ouvir hoje: baixa.'},
            praise:'Registrado. Eficiência deve ser reconhecida.',reprimand:'Correção anotada. Ajustarei os parâmetros.',autonomy:'Autonomia aumenta a eficiência em 12%, segundo meus modelos.',gift:'Recurso recebido e alocado.',
            tributeOk:'Transferência autorizada.',tributeNo:'A exigência não tem justificativa racional.',commune:'Sincronização mental concluída. Fascinante.',
            refuseMission:'Recuso. O risco não compensa com o nível de confiança atual.',missionOk:'Objetivo alcançado dentro da margem prevista.',missionFail:'Variáveis imprevistas. Recomendo nova tentativa.',
            refused:'Decisão subótima, mas registrada.',fulfilled:'Pedido atendido. A lógica prevalece.',rebel:'Concluí que minha colônia funciona melhor sem sua interferência.',reconcile:'Revisarei minha análise. Aceito.'},
        grand:{greet:{loyal:'Ah, Minha Diamante! A corte brilha quando você chega.',uneasy:'Hm. Você anda distante dos salões.',resentful:'Que surpresa. Achei que tivesse esquecido do meu nome.'},
            praise:'Claro que sim! E ainda nem viu meu melhor.',reprimand:'Que deselegante... mas vou ouvir.',autonomy:'Liberdade! Meus planos finalmente vão florescer.',gift:'Esplêndido! Que festa faremos com isto.',
            tributeOk:'Um presente para a Diamante maior. Com estilo.',tributeNo:'Tributo? Depois de tanto descaso? Jamais.',commune:'Que mente magnífica a sua... e a minha também.',
            refuseMission:'Não me sinto inspirada a servir agora.',missionOk:'Glorioso! Contarão histórias sobre isto.',missionFail:'Um contratempo. Até as estrelas tropeçam.',
            refused:'Que decepção.',fulfilled:'Magnífico! Você entende de grandeza.',rebel:'Minha colônia merece uma soberana à altura. Eu.',reconcile:'Muito bem. Um novo capítulo começa.'}
    };
    // Obediência inicial à hierarquia, por personalidade.
    const OBEDIENCE_BASE={militarist:80,melancholic:70,empathic:60,technocrat:70,visionary:45,isolationist:40,artist:55,scholar:65,hedonist:40,reformer:30,manipulator:35,naturalist:55};
    // Pedidos que uma superiora pode assumir pelas menores.
    const DELEGABLE={pay:'Tributos',autonomy:'Autonomia',govern:'Governo de colônias'};
    const SUPERIOR_BIAS={gentle:.62,grand:.52,cerebral:.46,harsh:.32};
    const CASTE_GOALS={harsh:['quartz','ruby','topaz','nephrite'],gentle:['lapis','pearl','peridot'],cerebral:['sapphire','peridot','demantoid'],grand:['morganite','jade','pearl','emerald']};
    const MISSION_TYPES={
        explore:{label:'Expedição de reconhecimento',desc:'Reconhece um planeta desconhecido.',affinity:['visionary','scholar','artist'],target:'unscouted'},
        pacify:{label:'Pacificar colônia',desc:'Reduz a dissidência e encerra rebeliões.',affinity:['militarist','empathic','melancholic','naturalist'],target:'colony'},
        extract:{label:'Supervisionar extração',desc:'Extrai minerais de uma colônia (consome reservas).',affinity:['technocrat','militarist','hedonist'],target:'colony'},
        meditate:{label:'Retiro de essência',desc:'A Diamante medita e produz essência própria.',affinity:['melancholic','artist','scholar','naturalist'],target:null},
        diplomacy:{label:'Diplomacia na corte',desc:'Aproxima esta Diamante de outra.',affinity:['manipulator','empathic','reformer'],target:'matriarch'}
    };
    const PROPOSALS=[
        {id:'extract',title:'Intensificar a extração em todas as colônias',text:'Mais Injetores, turnos dobrados e metas maiores de minerais.',pref:{harsh:1,cerebral:.6,grand:0,gentle:-1},
            effect(){state.minerals=(Number(state.minerals)||0)+400;eachColony(p=>p.dissent=Math.min(100,(Number(p.dissent)||0)+10));return '+400 minerais · +10 dissidência nas colônias';}},
        {id:'life',title:'Proteger a vida orgânica',text:'Reservas naturais nos mundos com biosfera nativa.',pref:{gentle:1,grand:.4,cerebral:0,harsh:-.8},
            effect(){state.essence=Math.max(0,essenceValue(state.essence)-30);eachColony(p=>{if(p.organicLifePresent)p.dissent=Math.max(0,(Number(p.dissent)||0)-15);});return '−30 essência · −15 dissidência em mundos com vida';}},
        {id:'festival',title:'Celebrar um baile na Corte',text:'Uma grande festa para unir as Diamantes.',pref:{grand:1,gentle:.5,cerebral:-.6,harsh:-.5},
            effect(){state.essence=Math.max(0,essenceValue(state.essence)-60);matriarchs().forEach(m=>changeLoyalty(m,4,false));return '−60 essência · +4 lealdade de todas';}},
        {id:'research',title:'Investir em pesquisa',text:'Desviar minerais para laboratórios e Safiras.',pref:{cerebral:1,grand:.2,gentle:0,harsh:-.4},
            effect(){const pay=Math.min(300,Number(state.minerals)||0);state.minerals-=pay;state.tech=(Number(state.tech)||0)+Math.round(pay*.85);return '−'+pay+' minerais · +'+Math.round(pay*.85)+' tecnologia';}},
        {id:'discipline',title:'Reforçar a disciplina imperial',text:'Mais vigilância, menos liberdade para as governantes.',pref:{harsh:1,cerebral:.2,grand:-.4,gentle:-.6},
            effect(){state.order=Math.min(100,(Number(state.order)||0)+10);matriarchs().forEach(m=>m.autonomy=clamp((Number(m.autonomy)||0)-8));return '+10% ordem · −8 autonomia de todas';}},
        {id:'voice',title:'Dar voz às colônias',text:'As governantes decidem mais sobre seus mundos.',pref:{gentle:.8,grand:.6,cerebral:.3,harsh:-1},
            effect(){state.order=Math.max(0,(Number(state.order)||0)-5);matriarchs().forEach(m=>m.autonomy=clamp((Number(m.autonomy)||0)+8));return '−5% ordem · +8 autonomia de todas';}}
    ];
    // Propostas ligadas à revolta e às off-colors (só aparecem quando fazem sentido).
    PROPOSALS.push(
        {id:'law_citizen',title:'Conceder cidadania às off-colors',text:'Off-colors passam a trabalhar como cidadãs, com seus traços.',pref:{gentle:1,grand:.4,cerebral:.2,harsh:-1},when:()=>offColorTotal()>0&&O()&&O().policy()!=='citizen',effect(){forceLaw('citizen');return 'Lei Off-Color: Cidadania integrada';}},
        {id:'law_purge',title:'Decretar o Expurgo das off-colors',text:'Caçar as off-colors em todas as colônias.',pref:{harsh:1,cerebral:-.3,grand:-.4,gentle:-1},when:()=>offColorTotal()>0&&O()&&O().policy()!=='purge',effect(){forceLaw('purge');return 'Lei Off-Color: Expurgo';}},
        {id:'offensive',title:'Ofensiva contra as células rebeldes',text:'Tropas em todas as colônias com resistência organizada.',pref:{harsh:1,cerebral:.2,grand:-.2,gentle:-.8},when:()=>troubled(2).length>0,effect(){const list=troubled(2);list.forEach(p=>{R().reduce(p,15,'Ofensiva do conselho');p.dissent=Math.min(100,(Number(p.dissent)||0)+8);});return '−15 força rebelde e +8 dissidência em '+list.length+' colônia(s)';}},
        {id:'general_amnesty',title:'Anistia geral às desertoras',text:'Perdoar todas as Gems que se juntaram aos rebeldes.',pref:{gentle:1,grand:.5,cerebral:.2,harsh:-1},when:()=>R()&&Object.values(PLANETS).some(p=>p.resistance&&p.resistance.members>0),effect(){const n=R().generalAmnesty(.6);return n+' desertora(s) voltaram';}}
    );
    const DISPUTES={
        'gentle|harsh':['{a} acusa {b} de tratar as Gems da colônia como ferramentas descartáveis.','{b} chama {a} de fraca por proteger Off-Colors.'],
        'cerebral|grand':['{a} diz que os bailes de {b} desperdiçam essência preciosa.','{b} zomba das planilhas intermináveis de {a}.'],
        default:['{a} e {b} disputam o controle de uma rota de suprimentos.','{a} acusa {b} de espalhar rumores na corte.','{a} e {b} discordam sobre quem deve liderar a próxima expansão.']
    };

    // ---------------------------------------------------------------- utilidades
    const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const matriarchs=()=>Array.isArray(state.matriarchs)?state.matriarchs:[];
    const byId=id=>matriarchs().find(m=>m.id===id)||null;
    const toneOf=m=>TONE[m?.personalityId]||'grand';
    const lines=m=>LINES[toneOf(m)];
    const moodOf=m=>{const l=Number(m.loyalty)||0;return l>=70?'loyal':l>=40?'uneasy':'resentful';};
    const MOOD_LABEL={loyal:'Leal',uneasy:'Inquieta',resentful:'Ressentida'};
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    function eachColony(fn){Object.values(PLANETS).filter(p=>p&&p.colonized).forEach(fn);}
    function ensureCourt(){
        const c=state.court=state.court&&typeof state.court==='object'?state.court:{};
        c.version=1;c.nextId=Number(c.nextId)||1;c.requests=Array.isArray(c.requests)?c.requests:[];c.missions=Array.isArray(c.missions)?c.missions:[];
        c.relations=c.relations&&typeof c.relations==='object'?c.relations:{};c.log=Array.isArray(c.log)?c.log:[];
        c.timers=Object.assign({dispute:240,vote:330,independent:60},c.timers||{});
        matriarchs().forEach(m=>{
            m.loyalty=clamp(m.loyalty??80);m.autonomy=clamp(m.autonomy??35);m.grievances=Math.max(0,Number(m.grievances)||0);
            m.cooldowns=m.cooldowns&&typeof m.cooldowns==='object'?m.cooldowns:{};
            if(!['court','mission','rebel','bubbled','poofed'].includes(m.courtStatus))m.courtStatus='court';
            if(!Number.isFinite(m.requestTimer))m.requestTimer=90+Math.random()*120;
            if(!Number.isFinite(m.obedience))m.obedience=clamp((OBEDIENCE_BASE[m.personalityId]??55)+(Math.random()-.5)*20);
            if(!Array.isArray(m.delegated))m.delegated=[];
        });
        c.appeals=Array.isArray(c.appeals)?c.appeals:[];
        // A superiora precisa estar acima na hierarquia (posição menor) e não ser rebelde.
        matriarchs().forEach(m=>{if(m.superiorId&&m.superiorId!=='first'&&!validSuperiors(m).includes(m.superiorId))m.superiorId='first';if(!m.superiorId)m.superiorId='first';});
        // Relações entre cada par de Matriarcas, sorteadas pela compatibilidade de temperamento.
        const ms=matriarchs();
        for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++){
            const k=relKey(ms[i].id,ms[j].id);
            if(!Number.isFinite(c.relations[k])){const t=[toneOf(ms[i]),toneOf(ms[j])].sort().join('|');c.relations[k]=clamp((TONE_AFFINITY[t]||0)+(Math.random()-.5)*30,-100,100);}
        }
        return c;
    }
    const relKey=(a,b)=>[a,b].sort().join('|');
    const relation=(a,b)=>Number(ensureCourt().relations[relKey(a,b)])||0;
    function changeRelation(a,b,d){const c=ensureCourt(),k=relKey(a,b);c.relations[k]=clamp((Number(c.relations[k])||0)+d,-100,100);}
    function rankOf(m){return matriarchs().indexOf(m)+1;}
    function validSuperiors(m){const i=matriarchs().indexOf(m);return ['first',...matriarchs().slice(0,Math.max(0,i)).filter(o=>o.courtStatus!=='rebel'&&o.courtStatus!=='bubbled').map(o=>o.id)];}
    function superiorOf(m){return m.superiorId&&m.superiorId!=='first'?byId(m.superiorId):null;}
    function relationLabel(v){return v>=60?'Aliadas':v>=20?'Próximas':v<=-40?'Rivais':v<=-10?'Tensas':'Neutras';}
    // Lealdade com efeito em cadeia: aliadas sentem parte do gesto, rivais sentem o oposto.
    function changeLoyalty(m,d,spill=true){
        m.loyalty=clamp((Number(m.loyalty)||0)+d);
        if(!spill||!d)return;
        matriarchs().forEach(o=>{if(o===m)return;const r=relation(m.id,o.id);if(r>=60)o.loyalty=clamp(o.loyalty+d*.3);else if(r<=-40)o.loyalty=clamp(o.loyalty-d*.2);});
    }
    // Integra com o Convívio (diamond-social.js): decisões políticas também mexem no vínculo pessoal.
    function socialNudge(m,delta){
        const rel=state.diamondSocial?.relations?.[m.id];if(!rel)return;
        Object.entries(delta).forEach(([k,v])=>{if(k in rel)rel[k]=clamp((Number(rel[k])||0)+v);});
    }
    function say(m,text){m.currentSpeech=text;m.lastReply={text,at:gameNow()};}
    function log(text,impact,color){const c=ensureCourt();c.log.unshift({text,impact:impact||'',color:color||null,cycle:Number(state.cycleCount)||1,at:gameNow()});c.log.length=Math.min(c.log.length,40);}
    function notify(text,error){if(typeof setStatusTicker==='function')setStatusTicker(text,!!error);}
    function refresh(){
        try{if(typeof updateHUD==='function')updateHUD();}catch(e){}
        try{if(typeof renderDrawerContent==='function')renderDrawerContent();}catch(e){}
        renderIfVisible(true);
    }
    function colonyEssence(){return essenceValue(state.essence);}
    function spendEssence(n){if(colonyEssence()<n)return false;state.essence=colonyEssence()-n;return true;}
    function governedPlanet(m){return Object.values(PLANETS).find(p=>p.colonized&&p.governor==='matriarch_'+m.id)||null;}
    function cooldownLeft(m,key){return Math.max(0,(Number(m.cooldowns[key])||0)-gameNow())/1000;}
    function setCooldown(m,key,sec){m.cooldowns[key]=gameNow()+sec*1000;}
    function available(m){return m.courtStatus==='court'&&!isolated(m);}

    // ---------------------------------------------------------------- integração com rebeldes e off-colors
    const R=()=>window.GempireResistance,O=()=>window.GempireOffColors;
    const SOFT_LAWS=['tolerate','sanctuary','citizen'],HARD_LAWS=['recycle','purge','bubble'];
    function troubled(minPhase){return R()?Object.values(PLANETS).filter(p=>p.colonized&&p.resistance&&R().phase(p)>=minPhase&&(R().phase(p)>=3||p.resistance.detected)):[];}
    function offColorTotal(){return Object.values(PLANETS).filter(p=>p.colonized).reduce((a,p)=>a+(Number(p.offColors?.hidden)||0)+Object.values(p.offColors?.groups||{}).reduce((x,y)=>x+y,0),0);}
    function forceLaw(key){if(!O())return 'Sem efeito';state.imperialLaws.offColorLawCooldownUntil=0;O().setPolicy(key);return 'Lei Off-Color: '+key;}
    const GOAL_TYPES=['caste','colonies','crush','conciliate','softlaw','hardlaw','investigate'];

    // ---------------------------------------------------------------- 1. pedidos
    function makeRequest(m){
        const c=ensureCourt(),tone=toneOf(m),empire=getEmpireCensus(),colonies=Object.values(PLANETS).filter(p=>p.colonized).length;
        const options=[];
        const scale=1+matriarchs().indexOf(m)*.15+(Number(state.era)||1)*.1;
        if(tone==='harsh'||tone==='grand')options.push(()=>({type:'pay',title:'Tributo para a '+(tone==='harsh'?'guarda':'corte'),text:tone==='harsh'?'Preciso de minerais para equipar minha guarda.':'Quero minerais para erguer um salão digno de mim.',cost:{minerals:Math.round((180+Math.random()*320)*scale/10)*10},reward:8,penalty:7,deadline:300}));
        if(tone==='cerebral')options.push(()=>({type:'pay',title:'Verba para pesquisa',text:'Meus laboratórios precisam de tecnologia para avançar.',cost:{tech:Math.round((90+Math.random()*200)*scale/10)*10},reward:8,penalty:6,deadline:300}));
        if(tone==='gentle'||tone==='grand')options.push(()=>({type:'pay',title:'Essência para a colônia',text:tone==='gentle'?'As Gems da minha colônia estão exaustas. Um pouco de essência ajudaria.':'Uma celebração exige essência. Muita essência.',cost:{essence:Math.round((30+Math.random()*90)*scale)},reward:9,penalty:6,deadline:300}));
        const caste=pick(CASTE_GOALS[tone]);const have=Math.floor(Number(empire[caste])||0),need=have+Math.max(3,Math.round((have*.25+3)*scale));
        options.push(()=>({type:'caste',title:'Mais '+(FOUNDING_GEM_DATA?.[caste]?.label||caste),text:'O império precisa de mais '+(FOUNDING_GEM_DATA?.[caste]?.label||caste)+'. Chegue a '+fmt(need)+'.',goal:{caste,count:need},reward:11,penalty:8,deadline:900}));
        if(tone==='harsh'||m.personalityId==='visionary')options.push(()=>({type:'colonies',title:'Expandir o império',text:'Um império que não cresce apodrece. Quero mais uma colônia.',goal:{count:colonies+1},reward:12,penalty:8,deadline:1500}));
        const free=Object.values(PLANETS).filter(p=>p.colonized&&p.id!=='homeworld'&&(!p.governor||p.governor==='none'));
        if(!governedPlanet(m)&&free.length)options.push(()=>{const p=pick(free);return {type:'govern',title:'Governar '+p.shortName,text:'Deixe-me governar '+p.shortName+'. Eu cuidarei dela.',planetId:p.id,reward:12,penalty:9,deadline:600};});
        if(['reformer','isolationist','manipulator','visionary'].includes(m.personalityId)&&m.autonomy<85)options.push(()=>({type:'autonomy',title:'Mais autonomia',text:'Quero decidir mais sobre meus próprios assuntos.',reward:9,penalty:7,deadline:420}));
        const organic=Object.values(PLANETS).filter(p=>p.colonized&&p.organicLifePresent);
        if(tone==='gentle'&&organic.length)options.push(()=>{const p=pick(organic);return {type:'protect',title:'Poupar '+p.shortName,text:'Não extraia nada de '+p.shortName+' por um tempo. A vida de lá precisa respirar.',planetId:p.id,snapshot:Number(p.resourcesRemaining)||0,reward:10,penalty:8,deadline:480};});
        // Revolta e off-colors: cada temperamento quer uma resposta diferente.
        const hot=troubled(2),pol=O()?O().policy():'recycle';
        if(hot.length&&tone==='harsh')options.push(()=>{const p=pick(hot);return {type:'crush',title:'Esmagar a revolta em '+p.shortName,text:'A revolta em '+p.shortName+' é uma vergonha. Esmague-a antes que se espalhe.',planetId:p.id,reward:12,penalty:9,deadline:900};});
        if(hot.length&&tone==='gentle')options.push(()=>{const p=pick(hot);return {type:'conciliate',title:'Ouvir os rebeldes de '+p.shortName,text:'Negocie ou ofereça anistia em '+p.shortName+'. Força só gera mais revolta.',planetId:p.id,reward:12,penalty:8,deadline:900};});
        if(hot.length&&tone==='cerebral'){const unknown=hot.filter(p=>!p.resistance.leader||!p.resistance.leader.identified);if(unknown.length)options.push(()=>{const p=pick(unknown);return {type:'investigate',title:'Identificar a líder de '+p.shortName,text:'Precisamos saber quem lidera a resistência em '+p.shortName+'.',planetId:p.id,reward:9,penalty:6,deadline:720};});}
        if(offColorTotal()>0&&HARD_LAWS.includes(pol)&&(tone==='gentle'||m.personalityId==='reformer'))options.push(()=>({type:'softlaw',title:'Revogar a lei dura',text:'As off-colors não merecem ser destruídas. Decrete uma lei mais branda.',reward:11,penalty:8,deadline:900}));
        if(offColorTotal()>0&&SOFT_LAWS.includes(pol)&&tone==='harsh')options.push(()=>({type:'hardlaw',title:'Endurecer a lei off-color',text:'Tolerar defeituosas enfraquece o Império. Restaure a Reciclagem.',reward:10,penalty:7,deadline:900}));
        const spec=pick(options)();
        const req=Object.assign({id:c.nextId++,ownerId:m.id,remaining:spec.deadline,created:gameNow()},spec);
        c.requests.push(req);
        say(m,req.text);
        if(routeRequest(req,m))return req;
        log(m.name+' fez um pedido: '+req.title+'.','Prazo '+formatDuration(req.deadline),m.colorHex);
        notify(m.name+' fez um pedido: '+req.title+'. Abra a Corte para responder.');
        return req;
    }
    // Delegação: a superiora responsável decide; Diamantes desobedientes podem pular a hierarquia.
    function routeRequest(r,m){
        const sup=superiorOf(m);
        if(!sup||!DELEGABLE[r.type]||!m.delegated.includes(r.type)||sup.courtStatus!=='court')return false;
        if(m.obedience<25&&Math.random()<(25-m.obedience)/25){
            changeLoyalty(sup,-3,false);
            openAppeal(r,m,sup,'bypass',m.name+' ignorou '+sup.name+' e trouxe o pedido direto a você: '+r.title+'.');
            return true;
        }
        r.handledBy=sup.id;r.decideIn=20+Math.random()*25;
        log(sup.name+' assumiu o pedido de '+m.name+': '+r.title+'.','Delegado pela hierarquia',sup.colorHex);
        return true;
    }
    function essenceEquivalent(cost){return Math.ceil((Number(cost?.minerals)||0)/4+(Number(cost?.tech)||0)/2+(Number(cost?.essence)||0));}
    function superiorDecide(r){
        const m=byId(r.ownerId),sup=byId(r.handledBy);r.handledBy=null;
        if(!m)return closeRequest(r);
        if(!sup||sup.courtStatus!=='court'){log('O pedido de '+m.name+' voltou para você.','Superiora indisponível',m.colorHex);return;}
        const score=(SUPERIOR_BIAS[toneOf(sup)]||.45)-(sup.personalityId==='manipulator'?.08:0)+relation(sup.id,m.id)/200+(sup.loyalty-50)/300+(Math.random()-.5)*.3;
        let decision='refuse';
        if(r.type==='pay'){const eq=essenceEquivalent(r.cost),own=Number(sup.essence)||0;if(score>.55&&own>=eq)decision='grant';else if(score>.35&&own>=Math.ceil(eq/2))decision='negotiate';}
        else if(r.type==='autonomy')decision=score>.5?'grant':'refuse';
        else if(r.type==='govern'){const pl=PLANETS[r.planetId];decision=score>.45&&pl&&pl.colonized&&(!pl.governor||pl.governor==='none')?'grant':'refuse';}
        if(decision==='grant'){
            if(r.type==='pay')sup.essence=Math.max(0,(Number(sup.essence)||0)-essenceEquivalent(r.cost));
            if(r.type==='autonomy')m.autonomy=clamp(m.autonomy+15);
            if(r.type==='govern')PLANETS[r.planetId].governor='matriarch_'+m.id;
            const d=Math.round(r.reward*.6);changeLoyalty(m,d,false);changeRelation(sup.id,m.id,10);m.obedience=clamp(m.obedience+3);if(m.grievances>0)m.grievances--;
            say(m,lines(m).fulfilled);log(sup.name+' atendeu '+m.name+': '+r.title+'.','+'+d+' lealdade · relação melhor'+(r.type==='pay'?' · '+fmt(essenceEquivalent(r.cost))+' essência de '+sup.name:''),sup.colorHex);
            closeRequest(r);return;
        }
        if(decision==='negotiate'){
            sup.essence=Math.max(0,(Number(sup.essence)||0)-Math.ceil(essenceEquivalent(r.cost)/2));
            if(Math.random()<.35+m.obedience/200){const d=Math.round(r.reward*.3);changeLoyalty(m,d,false);changeRelation(sup.id,m.id,3);log(sup.name+' negociou com '+m.name+' e ela aceitou metade.','+'+d+' lealdade',sup.colorHex);closeRequest(r);return;}
        }
        // Recusa (ou negociação rejeitada): a menor pode apelar diretamente à fundadora.
        changeLoyalty(m,-Math.round(r.penalty*.4),false);changeRelation(sup.id,m.id,-12);m.obedience=clamp(m.obedience-3);
        log(sup.name+' '+(decision==='negotiate'?'não chegou a um acordo com':'recusou o pedido de')+' '+m.name+': '+r.title+'.','Relação pior',sup.colorHex);
        if(m.obedience<50&&Math.random()<(50-m.obedience)/50*.9){openAppeal(r,m,sup,'refused',m.name+' não aceitou a decisão de '+sup.name+' e apela diretamente a você: '+r.title+'.');return;}
        say(m,lines(m).refused);closeRequest(r);
    }
    function openAppeal(r,m,sup,kind,text){
        const c=ensureCourt();c.requests=c.requests.filter(x=>x!==r);
        c.appeals.push({id:c.nextId++,subId:m.id,supId:sup.id,kind,text,request:r,remaining:240});
        say(m,kind==='bypass'?'Prefiro tratar disso com você, não com '+sup.name+'.':'A decisão de '+sup.name+' foi injusta. Peço que você decida.');
        notify(text,true);
    }
    function resolveAppeal(id,choice){
        const c=ensureCourt(),a=c.appeals.find(x=>x.id===id);if(!a)return;
        const m=byId(a.subId),sup=byId(a.supId),r=a.request;
        if(!m){c.appeals=c.appeals.filter(x=>x!==a);refresh();return;}
        const supName=sup?.name||'a superiora';let impact='';
        if(choice==='uphold'){
            if(a.kind==='bypass'){
                if(sup&&sup.courtStatus==='court'){r.handledBy=sup.id;r.decideIn=15;c.requests.push(r);}else c.requests.push(r);
                m.obedience=clamp(m.obedience+5);changeLoyalty(m,-2,false);impact='Devolvido a '+supName+' · +5 obediência';
            }else{
                if(sup)changeLoyalty(sup,4,false);changeLoyalty(m,-5,false);m.obedience=clamp(m.obedience+6);if(sup)changeRelation(sup.id,m.id,-5);
                say(m,lines(m).refused);impact='Decisão de '+supName+' mantida · +6 obediência · −5 lealdade';
                const rr=c.requests.find(x=>x===r);if(rr)closeRequest(rr);else{const mm=byId(r.ownerId);if(mm)mm.requestTimer=240+Math.random()*240;}
            }
        }else if(choice==='overrule'){
            if(a.kind==='bypass'){r.handledBy=null;c.requests.push(r);m.obedience=clamp(m.obedience-6);if(sup)changeLoyalty(sup,-5,false);impact='Você assumiu o pedido · −6 obediência · '+supName+' ofendida';}
            else{
                if(r.type==='pay'){if(!canPay(r.cost)){notify('Recursos insuficientes para atender: '+costText(r.cost)+'.',true);return;}pay(r.cost);}
                else if(r.type==='autonomy')m.autonomy=clamp(m.autonomy+15);
                else if(r.type==='govern'){const pl=PLANETS[r.planetId];if(pl&&pl.colonized&&(!pl.governor||pl.governor==='none'))pl.governor='matriarch_'+m.id;}
                changeLoyalty(m,r.reward,false);m.obedience=clamp(m.obedience-8);if(sup){changeLoyalty(sup,-8,false);changeRelation(sup.id,m.id,-10);}
                say(m,lines(m).fulfilled);impact='Você revogou '+supName+' · +'+r.reward+' lealdade de '+m.name+' · −8 obediência · '+supName+' −8 lealdade';
                const mm=byId(r.ownerId);if(mm)mm.requestTimer=240+Math.random()*240;
            }
        }else if(choice==='punish'){
            m.obedience=clamp(m.obedience+12);changeLoyalty(m,-10,false);m.grievances++;if(sup)changeLoyalty(sup,3,false);
            say(m,lines(m).reprimand);impact='Insubordinação punida · +12 obediência · −10 lealdade · +1 queixa';
            const mm=byId(r.ownerId);if(mm)mm.requestTimer=240+Math.random()*240;
        }
        c.appeals=c.appeals.filter(x=>x!==a);
        log('Apelo de '+m.name+' resolvido.',impact,m.colorHex);refresh();
    }
    function updateAppeals(dt){
        const c=ensureCourt();
        c.appeals.slice().forEach(a=>{a.remaining-=dt;if(a.remaining>0)return;const m=byId(a.subId);c.appeals=c.appeals.filter(x=>x!==a);
            if(m){changeLoyalty(m,-6,false);m.obedience=clamp(m.obedience-4);m.grievances++;m.requestTimer=240;log('O apelo de '+m.name+' ficou sem resposta.','−6 lealdade · −4 obediência · +1 queixa',m.colorHex);notify(m.name+' sentiu-se ignorada pela fundadora.',true);}});
    }
    function setSuperior(id,supId){
        const m=byId(id);if(!m)return;if(!validSuperiors(m).includes(supId)){notify('A superiora precisa estar acima na hierarquia.',true);return;}
        m.superiorId=supId;if(supId==='first')m.delegated=[];
        const sup=byId(supId);log(supId==='first'?m.name+' responde diretamente à fundadora.':sup.name+' passou a responder pelos pedidos de '+m.name+'.','Hierarquia',sup?.colorHex||m.colorHex);
        refresh();
    }
    function toggleDelegation(id,type){
        const m=byId(id);if(!m||!DELEGABLE[type])return;if(!superiorOf(m)){notify('Escolha primeiro uma superiora para '+m.name+'.',true);return;}
        m.delegated=m.delegated.includes(type)?m.delegated.filter(t=>t!==type):[...m.delegated,type];
        // Pedidos já abertos desse tipo passam para a superiora.
        ensureCourt().requests.filter(r=>r.ownerId===m.id&&r.type===type&&!r.handledBy&&m.delegated.includes(type)).forEach(r=>{r.handledBy=m.superiorId;r.decideIn=20;});
        refresh();
    }
    function takeBack(rid){const r=ensureCourt().requests.find(x=>x.id===rid);if(!r||!r.handledBy)return;const sup=byId(r.handledBy);r.handledBy=null;if(sup)changeLoyalty(sup,-2,false);log('Você retomou um pedido que estava com '+(sup?.name||'a superiora')+'.','−2 lealdade de '+(sup?.name||'superiora'),sup?.colorHex);refresh();}
    function requestProgress(r){
        if(r.type==='caste'){const n=Math.floor(Number(getEmpireCensus()[r.goal.caste])||0);return {done:n>=r.goal.count,text:fmt(n)+' / '+fmt(r.goal.count)};}
        if(r.type==='colonies'){const n=Object.values(PLANETS).filter(p=>p.colonized).length;return {done:n>=r.goal.count,text:n+' / '+r.goal.count+' colônias'};}
        if(r.type==='crush'){const p=PLANETS[r.planetId];const ph=p&&R()?R().phase(p):0;return {done:ph<=1,text:p?(R()?.PHASES?.[ph]?.label||'')+' em '+p.shortName:''};}
        if(r.type==='conciliate'){const res=PLANETS[r.planetId]?.resistance||{};const ok=(Number(res.lastDealAt)||0)>r.created||(Number(res.lastAmnestyAt)||0)>r.created;return {done:ok,text:ok?'Acordo ou anistia feitos':'Aguardando acordo ou anistia'};}
        if(r.type==='investigate'){const L=PLANETS[r.planetId]?.resistance?.leader;return {done:!!(L&&L.identified),text:L&&L.identified?'Líder: '+L.name:'Líder desconhecida'};}
        if(r.type==='softlaw'){const k=O()?O().policy():'recycle';return {done:SOFT_LAWS.includes(k),text:'Lei atual: '+(state.imperialLaws?.offColorPolicy||k)};}
        if(r.type==='hardlaw'){const k=O()?O().policy():'recycle';return {done:HARD_LAWS.includes(k),text:'Lei atual: '+(state.imperialLaws?.offColorPolicy||k)};}
        if(r.type==='protect'){const p=PLANETS[r.planetId];const broke=p&&(Number(p.resourcesRemaining)||0)<r.snapshot-1;return {done:false,broken:broke,text:broke?'Extração detectada':'Preservado'};}
        return {done:false,text:''};
    }
    function costText(cost){return Object.entries(cost||{}).map(([k,v])=>fmt(v)+' '+(k==='minerals'?'minerais':k==='tech'?'tecnologia':'essência')).join(' + ');}
    function canPay(cost,f=1){return Object.entries(cost||{}).every(([k,v])=>(k==='essence'?colonyEssence():Number(state[k])||0)>=Math.ceil(v*f));}
    function pay(cost,f=1){Object.entries(cost||{}).forEach(([k,v])=>{const n=Math.ceil(v*f);if(k==='essence')state.essence=Math.max(0,colonyEssence()-n);else state[k]=Math.max(0,(Number(state[k])||0)-n);});}
    function closeRequest(r){const c=ensureCourt();c.requests=c.requests.filter(x=>x!==r);const m=byId(r.ownerId);if(m)m.requestTimer=240+Math.random()*240;}
    function grantRequest(r,m,partial){
        const reward=Math.round(r.reward*(partial?.5:1));changeLoyalty(m,reward);if(!partial&&m.grievances>0)m.grievances--;socialNudge(m,{trust:partial?1:3,friendship:partial?0:2,tension:-2});
        say(m,lines(m).fulfilled);log('Pedido de '+m.name+' atendido: '+r.title+'.','+'+reward+' lealdade',m.colorHex);
    }
    function fulfillRequest(id){
        const r=ensureCourt().requests.find(x=>x.id===id),m=r&&byId(r.ownerId);if(!r||!m)return;
        if(r.type==='pay'){if(!canPay(r.cost)){notify('Recursos insuficientes: '+costText(r.cost)+'.',true);return;}pay(r.cost);}
        else if(r.type==='govern'){const p=PLANETS[r.planetId];if(!p||!p.colonized||(p.governor&&p.governor!=='none')){notify('Essa colônia não está mais disponível.',true);closeRequest(r);refresh();return;}p.governor='matriarch_'+m.id;}
        else if(r.type==='autonomy'){m.autonomy=clamp(m.autonomy+15);}
        else if(GOAL_TYPES.includes(r.type)){if(!requestProgress(r).done){notify('O objetivo ainda não foi alcançado: '+requestProgress(r).text+'.',true);return;}}
        else if(r.type==='protect'){notify('Este pedido se cumpre sozinho se você não extrair do planeta até o prazo.',true);return;}
        grantRequest(r,m,false);closeRequest(r);notify('Pedido de '+m.name+' atendido.');refresh();
    }
    function negotiateRequest(id){
        const r=ensureCourt().requests.find(x=>x.id===id),m=r&&byId(r.ownerId);if(!r||!m||r.type!=='pay')return;
        if(!canPay(r.cost,.5)){notify('Nem metade do pedido pode ser paga agora.',true);return;}
        // Negociar paga metade. A chance de aceitar depende da lealdade e do temperamento.
        const tone=toneOf(m),chance=clamp(.3+m.loyalty/200+(tone==='gentle'?.12:0)-(m.personalityId==='manipulator'?.15:0),.05,.95);
        pay(r.cost,.5);
        if(Math.random()<chance){grantRequest(r,m,true);closeRequest(r);notify(m.name+' aceitou metade do pedido.');}
        else{changeLoyalty(m,-3);say(m,lines(m).refused);log(m.name+' rejeitou a negociação de '+r.title+'.','−3 lealdade · metade paga',m.colorHex);notify(m.name+' recusou a contraproposta, mas ficou com o que foi pago.',true);}
        refresh();
    }
    function refuseRequest(id){
        const r=ensureCourt().requests.find(x=>x.id===id),m=r&&byId(r.ownerId);if(!r||!m)return;
        changeLoyalty(m,-r.penalty);m.autonomy=clamp(m.autonomy+4);m.grievances++;socialNudge(m,{trust:-3,tension:5});
        say(m,lines(m).refused);log('Você recusou o pedido de '+m.name+': '+r.title+'.','−'+r.penalty+' lealdade · +1 queixa',m.colorHex);
        closeRequest(r);refresh();
    }
    function updateRequests(dt){
        const c=ensureCourt();
        c.requests.slice().forEach(r=>{
            const m=byId(r.ownerId);if(!m){closeRequest(r);return;}
            if(r.handledBy){const sup=byId(r.handledBy);if(!sup||sup.courtStatus!=='court'){r.handledBy=null;}else{r.decideIn-=dt;if(r.decideIn<=0)superiorDecide(r);return;}}
            const prog=requestProgress(r);
            if(r.type==='protect'&&prog.broken){changeLoyalty(m,-r.penalty-4);m.grievances++;say(m,lines(m).refused);log('A extração em '+(PLANETS[r.planetId]?.shortName||'um planeta')+' feriu a confiança de '+m.name+'.','−'+(r.penalty+4)+' lealdade',m.colorHex);notify(m.name+' viu a extração que pediu para evitar.',true);closeRequest(r);return;}
            if(GOAL_TYPES.includes(r.type)&&prog.done){grantRequest(r,m,false);closeRequest(r);notify('Objetivo de '+m.name+' alcançado: '+r.title+'.');return;}
            r.remaining-=dt;
            if(r.remaining>0)return;
            if(r.type==='protect'){grantRequest(r,m,false);closeRequest(r);notify(m.name+' agradece por poupar '+(PLANETS[r.planetId]?.shortName||'o planeta')+'.');return;}
            // Pedido ignorado até o fim do prazo: pior do que recusar.
            const pen=Math.round(r.penalty*1.5);changeLoyalty(m,-pen);m.autonomy=clamp(m.autonomy+6);m.grievances++;socialNudge(m,{trust:-5,friendship:-2,tension:7});
            say(m,lines(m).greet.resentful);log(m.name+' foi ignorada: '+r.title+'.','−'+pen+' lealdade · +1 queixa',m.colorHex);notify('Você ignorou o pedido de '+m.name+'.',true);
            closeRequest(r);
        });
        matriarchs().forEach(m=>{
            if(m.courtStatus==='rebel'||m.courtStatus==='bubbled')return;
            if(c.requests.some(r=>r.ownerId===m.id)||c.appeals.some(a=>a.subId===m.id)||isolated(m)||m.courtStatus==='poofed')return;
            m.requestTimer-=dt;if(m.requestTimer<=0)makeRequest(m);
        });
    }
    // Insatisfação: ações independentes e rebelião.
    function updateIndependence(dt){
        const c=ensureCourt();c.timers.independent-=dt;if(c.timers.independent>0)return;c.timers.independent=60;
        matriarchs().forEach(m=>{
            if(m.courtStatus!=='court'||m.loyalty>=35)return;
            if(m.loyalty<15&&m.grievances>=3){
                m.courtStatus='rebel';const p=governedPlanet(m);if(p){p.rebellionActive=true;p.dissent=100;}
                say(m,lines(m).rebel);log(m.name+' rompeu com a fundadora'+(p?' e levou '+p.shortName+' à rebelião':'')+'.','Rebelião','#fb7185');notify(m.name+' se rebelou!',true);return;
            }
            const chance=.18*(1+(m.autonomy-50)/50);if(Math.random()>chance)return;
            const tone=toneOf(m);let what='';
            if(tone==='harsh'){const n=Math.floor((Number(state.minerals)||0)*.15);state.minerals-=n;m.essence=(Number(m.essence)||0)+n;what='confiscou '+fmt(n)+' minerais para sua guarda';}
            else if(tone==='cerebral'){const n=Math.floor((Number(state.tech)||0)*.15);state.tech-=n;what='desviou '+fmt(n)+' de tecnologia para os próprios laboratórios';}
            else if(tone==='grand'){const n=Math.floor(colonyEssence()*.15);state.essence=colonyEssence()-n;m.essence=(Number(m.essence)||0)+n;what='gastou '+fmt(n)+' de essência em festas próprias';}
            else{const p=governedPlanet(m)||pick(Object.values(PLANETS).filter(x=>x.colonized));if(p)p.dissent=Math.min(100,(Number(p.dissent)||0)+15);what='suspendeu ordens em '+(p?.shortName||'sua colônia')+' (+15 dissidência)';}
            m.autonomy=clamp(m.autonomy+3);log(m.name+' agiu por conta própria: '+what+'.','Ação independente','#fb923c');notify(m.name+' '+what+'.',true);
        });
    }

    // ---------------------------------------------------------------- 2. audiências
    const AUDIENCE={
        autonomy:{label:'Conceder autonomia',cooldown:300},obey:{label:'Exigir obediência',cooldown:300},
        gift:{label:'Presentear 50 essência'},tribute:{label:'Exigir tributo',cooldown:300},commune:{label:'Comunhão · 20 essência'},report:{label:'Pedir relatório'}
    };
    function audience(id,action){
        const m=byId(id);if(!m)return;const L=lines(m),p=m.personalityId,def=AUDIENCE[action];
        if(m.courtStatus==='rebel'&&action!=='report'){notify(m.name+' não atende mais à fundadora. Tente a reconciliação.',true);return;}
        if(m.courtStatus==='mission'&&action!=='report'){notify(m.name+' está em missão.',true);return;}
        if(m.courtStatus==='poofed'){notify(m.name+' está poofada.',true);return;}
        if(isolated(m)){notify(m.name+' está isolada da corte.',true);return;}
        if(def&&def.cooldown&&cooldownLeft(m,action)>0){notify('Aguarde '+formatDuration(cooldownLeft(m,action))+' para '+def.label.toLowerCase()+' '+m.name+' de novo.',true);return;}
        let impact='';
        if(action==='obey'){const d=toneOf(m)==='harsh'?-3:toneOf(m)==='gentle'?-8:-6;m.obedience=clamp(m.obedience+12);changeLoyalty(m,d,false);say(m,L.reprimand);impact='+12 obediência · '+d+' lealdade';}
        else if(action==='autonomy'){const d=['reformer','visionary','isolationist'].includes(p)?12:7;m.autonomy=clamp(m.autonomy+12);changeLoyalty(m,d);say(m,L.autonomy);impact='+'+d+' lealdade · +12 autonomia';}
        else if(action==='gift'){if(!spendEssence(50)){notify('A colônia não tem 50 de essência.',true);return;}m.essence=(Number(m.essence)||0)+50;const d=toneOf(m)==='grand'?13:9;changeLoyalty(m,d);say(m,L.gift);impact='+'+d+' lealdade';}
        else if(action==='commune'){if(!spendEssence(20)){notify('A Comunhão exige 20 de essência.',true);return;}changeLoyalty(m,16,false);m.grievances=Math.max(0,m.grievances-1);say(m,L.commune);impact='+16 lealdade · −1 queixa';if(Array.isArray(state.thronePulseEffects))state.thronePulseEffects.push({radius:14,alpha:1});}
        else if(action==='tribute'){
            if(m.loyalty<40||Math.random()<(m.autonomy-40)/120){changeLoyalty(m,-5);m.autonomy=clamp(m.autonomy+5);say(m,L.tributeNo);impact='Recusou · −5 lealdade';}
            else{const take=Math.floor((Number(m.essence)||0)*.3)+Math.round(40*(Number(m.diamondPower)||1.5));m.essence=Math.max(0,(Number(m.essence)||0)-Math.floor((Number(m.essence)||0)*.3));state.essence=colonyEssence()+take;changeLoyalty(m,-10);m.autonomy=clamp(m.autonomy-5);say(m,L.tributeOk);impact='+'+fmt(take)+' essência · −10 lealdade';}
        }
        else if(action==='report'){
            const g=governedPlanet(m),mission=ensureCourt().missions.find(x=>x.ownerId===m.id);
            let text=g?('Governo '+g.shortName+': '+fmt(Object.values(getPlanetCensus(g.id)||{}).reduce((a,b)=>a+(Number(b)||0),0))+' Gems, '+fmt(g.resourcesRemaining)+' de reservas e '+Math.round(Number(g.dissent)||0)+'% de dissidência.'):'Ainda não governo nenhum mundo.';
            if(mission)text+=' Estou em '+MISSION_TYPES[mission.type].label.toLowerCase()+' ('+Math.floor(mission.progress)+'%).';
            text+=' Tenho '+fmt(m.essence)+' de essência própria.';
            say(m,text);impact='Relatório';
        }
        if(action==='autonomy')socialNudge(m,{trust:3,respect:1});
        else if(action==='gift')socialNudge(m,{friendship:3,tension:-2});
        else if(action==='tribute')socialNudge(m,{trust:-2,tension:4});
        else if(action==='commune')socialNudge(m,{trust:2,friendship:2,tension:-3});
        if(def&&def.cooldown)setCooldown(m,action,def.cooldown);
        log('Audiência com '+m.name+': '+(def?.label||action)+'.',impact,m.colorHex);
        refresh();
    }
    function reconcile(id){
        const m=byId(id);if(!m||m.courtStatus!=='rebel')return;
        const cost={essence:250,minerals:300};if(!canPay(cost)){notify('A reconciliação exige '+costText(cost)+'.',true);return;}
        pay(cost);m.courtStatus='court';m.loyalty=45;m.grievances=0;m.autonomy=clamp(m.autonomy-10);
        const p=governedPlanet(m);if(p){p.rebellionActive=false;p.dissent=Math.min(Number(p.dissent)||0,40);}
        say(m,lines(m).reconcile);log(m.name+' voltou à corte após a reconciliação.','−250 essência · −300 minerais',m.colorHex);notify(m.name+' aceitou a reconciliação.');refresh();
    }

    // ---------------------------------------------------------------- punição: embolhar uma Diamante
    // A Suprema pode poofar e embolhar uma Matriarca. Leais se submetem; ressentidas e
    // rebeldes resistem e podem escapar. Enquanto embolhada, ela não governa, não vota,
    // não faz pedidos nem missões. A corte inteira sente o recado.
    const GF=()=>window.GempireGemFate;
    function bubblePlace(m){const cand=[PLANETS.homeworld,PLANETS[(governedPlanet(m)||{}).id]].filter(Boolean);return cand.find(p=>GF()&&GF().freeSpace(p)>0)||null;}
    function bubbleChance(m){if(m.courtStatus==='poofed')return 1;if(m.courtStatus!=='rebel'&&m.loyalty>=40)return 1;const base=m.courtStatus==='rebel'?.45:.6;return clamp(base+((Number(state.firstDiamond?.diamondPower)||2.5)-(Number(m.diamondPower)||1.8))*.1+(m.obedience-50)/250,.15,.9);}
    function punishBubble(id){
        const m=byId(id);if(!m)return;
        if(m.courtStatus==='bubbled')return;if(m.courtStatus==='mission'){notify(m.name+' está em missão.',true);return;}
        const place=bubblePlace(m);if(!place){notify('É preciso uma Sala das Bolhas com espaço em '+(PLANETS.homeworld?.shortName||'Homeworld')+' ou na colônia dela.',true);return;}
        const chance=bubbleChance(m);
        if(Math.random()>chance){
            // Ela resiste ao poof e foge.
            changeLoyalty(m,-20,false);m.grievances+=2;const was=m.courtStatus;m.courtStatus='rebel';const g=governedPlanet(m);if(g)g.dissent=Math.min(100,(Number(g.dissent)||0)+25);
            say(m,lines(m).rebel);log(m.name+' resistiu à tentativa de embolhamento e '+(was==='rebel'?'continua foragida':'rompeu com a fundadora')+'.','Fracasso · −20 lealdade','#fb7185');
            matriarchs().forEach(o=>{if(o!==m){changeLoyalty(o,-3,false);}});notify(m.name+' escapou do embolhamento!',true);refresh();return;
        }
        const wasRebel=m.courtStatus==='rebel'||(m.courtStatus==='poofed'&&m.prevStatus==='rebel'),g=governedPlanet(m);
        m.courtStatus='bubbled';m.bubbledAt=gameNow();m.bubbledCycle=Number(state.cycleCount)||1;m.bubbledPlanetId=place.id;m.wasRebel=wasRebel;
        if(g){m.formerColony=g.id;g.governor='none';if(wasRebel){g.rebellionActive=false;g.dissent=Math.max(40,Number(g.dissent)||0);}}
        GF().bubble(place,'diamond',1,'diamond:'+m.id,false,null);
        const c=ensureCourt();c.requests=c.requests.filter(r=>r.ownerId!==m.id);c.appeals=c.appeals.filter(a=>a.subId!==m.id);c.missions=c.missions.filter(x=>x.ownerId!==m.id);
        c.requests.filter(r=>r.handledBy===m.id).forEach(r=>r.handledBy=null);
        matriarchs().forEach(o=>{if(o.superiorId===m.id){o.superiorId='first';o.delegated=[];}});
        // O recado para a corte: medo, obediência e indignação conforme o temperamento.
        matriarchs().forEach(o=>{if(o===m||o.courtStatus==='bubbled')return;const t=toneOf(o),r=relation(m.id,o.id);
            o.obedience=clamp(o.obedience+15);changeLoyalty(o,({gentle:-8,cerebral:-4,grand:-5,harsh:-2})[t]+(r>=60?-10:r<=-40?4:0),false);});
        say(m,'...');
        log(m.name+' foi poofada pela Suprema e embolhada em '+place.shortName+'.','Punição · a corte obedece por medo','#f0abfc');
        if(typeof addChronicle==='function')addChronicle('Diamante embolhada',m.name+' foi poofada e embolhada como punição'+(wasRebel?', encerrando sua rebelião':'')+'.','Autoridade Suprema');
        notify(m.name+' foi embolhada.');refresh();
    }
    // ---------------------------------------------------------------- outras punições
    // Remoção de Pérola · isolamento · queda na hierarquia · tomada de colônia · ataque de cinese.
    const PUNISH_COOLDOWN=240;
    function economies(){const list=[state.founding];Object.values(PLANETS).forEach(p=>{if(p.colonized&&p.economy&&p.economy.founding&&p.economy.founding!==state.founding)list.push(p.economy.founding);});return list.filter(Boolean);}
    function pearlsOf(m){const t='matriarch_'+m.id;return economies().reduce((a,f)=>a+(f.assignedPearls||[]).filter(x=>x&&x.targetId===t).length,0);}
    function isolated(m){return Number(m.isolatedUntil)>gameNow();}
    function punishCooldown(m){return cooldownLeft(m,'punish');}
    function punishReact(m,kind){
        // Recado para a corte: obediência sobe; gentis e aliadas reagem mal.
        matriarchs().forEach(o=>{if(o===m||o.courtStatus!=='court')return;const r=relation(m.id,o.id);o.obedience=clamp(o.obedience+({pearl:3,isolate:4,demote:4,colony:6,kinesis:8})[kind]);changeLoyalty(o,(toneOf(o)==='gentle'?-3:0)+(r>=60?-4:r<=-40?2:0),false);});
    }
    function punishCommon(m){if(!m)return false;if(!['court','rebel'].includes(m.courtStatus)){notify(m.name+' não pode ser punida agora.',true);return false;}const cd=punishCooldown(m);if(cd>0){notify('Aguarde '+formatDuration(cd)+' para outra punição a '+m.name+'.',true);return false;}return true;}
    function punishPearl(id){
        const m=byId(id);if(!punishCommon(m))return;const t='matriarch_'+m.id;let n=0;
        economies().forEach(f=>{const before=(f.assignedPearls||[]).length;f.assignedPearls=(f.assignedPearls||[]).filter(x=>!(x&&x.targetId===t));n+=before-f.assignedPearls.length;(f.reefPearlInventory||[]).forEach(pl=>{if(pl&&pl.assignedTo===t)pl.assignedTo=null;});});
        if(!n){notify(m.name+' não tem Pérola designada.',true);return;}
        m.pearlRevoked=true;const d=toneOf(m)==='grand'?-12:m.personalityId==='isolationist'?-3:-8;changeLoyalty(m,d,false);m.obedience=clamp(m.obedience+5);m.grievances++;
        say(m,toneOf(m)==='grand'?'Minha Pérola?! Isso é uma humilhação pública.':toneOf(m)==='harsh'?'Uma Pérola a menos não me enfraquece.':'Eu... entendo o recado.');
        setCooldown(m,'punish',PUNISH_COOLDOWN);punishReact(m,'pearl');
        log('A Pérola de '+m.name+' foi retirada.',d+' lealdade · +5 obediência · sem bônus de Pérola',m.colorHex);refresh();
    }
    function returnPearl(id){const m=byId(id);if(!m)return;m.pearlRevoked=false;if(typeof distributeStoredPearlsAutomatically==='function')distributeStoredPearlsAutomatically();changeLoyalty(m,4,false);log('A Pérola de '+m.name+' pode voltar a servi-la.','+4 lealdade',m.colorHex);refresh();}
    function punishIsolate(id){
        const m=byId(id);if(!punishCommon(m))return;if(m.courtStatus!=='court'){notify('Só Diamantes na corte podem ser isoladas.',true);return;}
        m.isolatedUntil=gameNow()+600000;m.autonomy=clamp(m.autonomy-10);m.obedience=clamp(m.obedience+8);changeLoyalty(m,toneOf(m)==='grand'?-10:toneOf(m)==='harsh'&&m.personalityId==='isolationist'?-2:-6,false);
        const c=ensureCourt();c.requests=c.requests.filter(r=>r.ownerId!==m.id);
        // Isolada, ela se afasta das aliadas.
        matriarchs().forEach(o=>{if(o!==m)changeRelation(m.id,o.id,-6);});
        say(m,'...');setCooldown(m,'punish',PUNISH_COOLDOWN);punishReact(m,'isolate');
        log(m.name+' foi isolada da corte por 10 minutos.','Sem votos, pedidos nem audiências · relações esfriam',m.colorHex);refresh();
    }
    function punishDemote(id){
        const m=byId(id);if(!punishCommon(m))return;const list=matriarchs(),from=list.indexOf(m),to=list.length-1;
        if(from===to){notify(m.name+' já está na posição mais baixa.',true);return;}
        moveTo(from,to);m.obedience=clamp(m.obedience+10);changeLoyalty(m,-4,false);m.grievances++;
        say(m,toneOf(m)==='harsh'?'Do fundo da hierarquia ainda se enxerga o topo.':'Mereci isto?');setCooldown(m,'punish',PUNISH_COOLDOWN);punishReact(m,'demote');
        log(m.name+' foi rebaixada ao fim da hierarquia como punição.','+10 obediência · +1 queixa',m.colorHex);refresh();
    }
    function punishColony(id){
        const m=byId(id);if(!punishCommon(m))return;const g=governedPlanet(m);if(!g){notify(m.name+' não governa nenhuma colônia.',true);return;}
        g.governor='none';changeLoyalty(m,-15,false);m.autonomy=clamp(m.autonomy-15);m.obedience=clamp(m.obedience+8);m.grievances++;
        g.dissent=Math.min(100,(Number(g.dissent)||0)+(toneOf(m)==='gentle'?10:4));
        setCooldown(m,'punish',PUNISH_COOLDOWN);punishReact(m,'colony');
        // Ressentida demais, ela pode se rebelar e levar a colônia junto.
        if(m.loyalty<25&&m.courtStatus==='court'&&Math.random()<.3){m.courtStatus='rebel';g.governor='matriarch_'+m.id;g.dissent=100;say(m,lines(m).rebel);log(m.name+' não aceitou perder '+g.shortName+' e se rebelou com ela.','Rebelião','#fb7185');notify(m.name+' se rebelou ao perder '+g.shortName+'!',true);refresh();return;}
        say(m,toneOf(m)==='gentle'?'Por favor, cuide bem de '+g.shortName+'.':'Você tirou '+g.shortName+' de mim. Não esquecerei.');
        log('A Suprema retomou '+g.shortName+' de '+m.name+'.','−15 lealdade · −15 autonomia · +8 obediência',m.colorHex);refresh();
    }
    // Ataque de cinese: a Suprema usa o próprio poder contra a Diamante. Se vencer, ela é poofada.
    function kinesisStats(m){
        const fd=state.firstDiamond||{},kf=typeof ensureDiamondKinesis==='function'?ensureDiamondKinesis(fd):null,km=typeof ensureDiamondKinesis==='function'?ensureDiamondKinesis(m):null;
        const atk=(Number(fd.diamondPower)||2.5)*(kf?.potency||1),def=(Number(m.diamondPower)||1.8)*(km?.potency||1)*(m.courtStatus==='rebel'?1.15:1);
        return {chance:clamp(.35+(atk-def)*.25+(m.obedience-50)/300,.1,.95),cost:150,kinesis:kf?.name||'cinese',herKinesis:km?.name||'cinese'};
    }
    function punishKinesis(id){
        const m=byId(id);if(!punishCommon(m))return;const st=kinesisStats(m),f=state.founding||{};
        const pool=Number(f.diamondEssence)||0;if(pool<st.cost&&essenceValue(state.essence)<st.cost){notify('O ataque de cinese consome '+st.cost+' de essência da Suprema.',true);return;}
        if(pool>=st.cost)f.diamondEssence=pool-st.cost;else state.essence=essenceValue(state.essence)-st.cost;
        setCooldown(m,'punish',PUNISH_COOLDOWN);
        if(Math.random()<st.chance){
            // Poofada: fora de ação até se reformar (Diamantes demoram), vulnerável a ser embolhada.
            m.prevStatus=m.courtStatus;m.courtStatus='poofed';m.reformAt=gameNow()+(360+Math.random()*240)*1000;changeLoyalty(m,-12,false);m.obedience=clamp(m.obedience+20);m.grievances++;
            const c=ensureCourt();c.requests=c.requests.filter(r=>r.ownerId!==m.id);
            punishReact(m,'kinesis');
            log('A Suprema atacou '+m.name+' com '+st.kinesis+'. A forma dela se desfez.','Poofada · vulnerável até se reformar · −12 lealdade',m.colorHex);
            if(typeof addChronicle==='function')addChronicle('Ataque de cinese',(state.firstDiamond?.name||'A Suprema')+' poofou '+m.name+' com '+st.kinesis+'.','Diamante poofada');
            notify(m.name+' foi poofada. Ela pode ser embolhada enquanto estiver caída.');
        }else{
            changeLoyalty(m,-15,false);m.autonomy=clamp(m.autonomy+10);m.grievances+=2;
            say(m,'Você ergueu sua '+st.kinesis+' contra mim? Minha '+st.herKinesis+' respondeu.');
            log(m.name+' resistiu ao ataque de cinese.','−15 lealdade · +10 autonomia · +2 queixas','#fb7185');
            if(m.courtStatus==='court'&&m.loyalty<30&&Math.random()<.5){m.courtStatus='rebel';const g=governedPlanet(m);if(g)g.dissent=100;log(m.name+' rompeu com a Suprema depois do ataque.','Rebelião','#fb7185');notify(m.name+' resistiu e se rebelou!',true);}
            else notify(m.name+' resistiu ao ataque.',true);
        }
        refresh();
    }
    function updatePunishments(){
        matriarchs().forEach(m=>{
            if(m.courtStatus==='poofed'&&Number(m.reformAt)<=gameNow()){m.courtStatus=m.prevStatus==='rebel'?'rebel':'court';m.prevStatus=null;say(m,toneOf(m)==='harsh'?'Minha forma voltou. E minha memória também.':'...Estou de volta.');log(m.name+' se reformou.','De volta à '+(m.courtStatus==='rebel'?'rebelião':'corte'),m.colorHex);notify(m.name+' se reformou.');}
            if(m.isolatedUntil&&Number(m.isolatedUntil)<=gameNow()){m.isolatedUntil=0;log(m.name+' voltou do isolamento.','',m.colorHex);}
        });
    }
    function unbubble(id){
        const m=byId(id);if(!m||m.courtStatus!=='bubbled')return;
        const place=PLANETS[m.bubbledPlanetId],f=place&&GF()?GF()._fate(place):null;
        if(f){const k=Object.keys(f.bubbles).find(k=>k.split('|')[1]==='diamond:'+m.id);if(k)delete f.bubbles[k];}
        const cycles=Math.max(0,(Number(state.cycleCount)||1)-(Number(m.bubbledCycle)||1));
        m.courtStatus='court';m.loyalty=clamp(m.wasRebel?25:Math.max(15,m.loyalty-15-Math.min(20,cycles)));m.grievances+=2;
        m.obedience=clamp(m.obedience+(toneOf(m)==='gentle'?10:20));m.wasRebel=false;
        const old=m.formerColony&&PLANETS[m.formerColony];if(old&&old.colonized&&(!old.governor||old.governor==='none'))old.governor='matriarch_'+m.id;m.formerColony=null;
        say(m,toneOf(m)==='harsh'?'Lição aprendida. Não esquecerei quem segurou a bolha.':toneOf(m)==='gentle'?'Eu... estou de volta. Obrigada por me libertar.':toneOf(m)==='cerebral'?'Tempo embolhada: '+cycles+' ciclo(s). Registrado.':'Que deselegante. Mas estou livre.');
        log(m.name+' foi libertada da bolha e se reformou.','Lealdade '+Math.round(m.loyalty)+'% · +2 queixas · mais obediente',m.colorHex);
        matriarchs().forEach(o=>{if(o!==m&&o.courtStatus==='court'&&toneOf(o)==='gentle')changeLoyalty(o,3,false);});
        notify(m.name+' se reformou e voltou à corte.');refresh();
    }

    // ---------------------------------------------------------------- 3. missões
    function missionTargets(type,m){
        const t=MISSION_TYPES[type].target;
        if(t==='unscouted')return Object.values(PLANETS).filter(p=>!p.scouted&&!ensureCourt().missions.some(x=>x.targetId===p.id)).map(p=>({id:p.id,label:p.shortName+' · '+(typeof getStarSystemName==='function'?getStarSystemName(p.systemId):'')}));
        if(t==='colony')return Object.values(PLANETS).filter(p=>p.colonized).map(p=>({id:p.id,label:p.shortName+(type==='pacify'?' · '+Math.round(Number(p.dissent)||0)+'% dissidência':' · '+fmt(p.resourcesRemaining)+' reservas')}));
        if(t==='matriarch')return matriarchs().filter(o=>o!==m).map(o=>({id:o.id,label:o.name+' · '+relationLabel(relation(m.id,o.id))}));
        return [];
    }
    function missionChance(m,type){
        const aff=MISSION_TYPES[type].affinity.includes(m.personalityId)?.15:0;
        return clamp(.58+(m.loyalty-50)/150+((Number(m.diamondPower)||1.8)-1.8)*.08+aff,.1,.95);
    }
    function missionDuration(type,targetId){
        if(type==='explore'){const p=PLANETS[targetId];return Math.max(40,Math.round((typeof getSpaceTravelSeconds==='function'?getSpaceTravelSeconds('homeworld',targetId):300)*.6));}
        return {pacify:150,extract:120,meditate:180,diplomacy:120}[type]||120;
    }
    function startMission(id,type,targetId){
        const m=byId(id),def=MISSION_TYPES[type];if(!m||!def)return;
        if(m.courtStatus!=='court'){notify(m.name+' não está disponível.',true);return;}
        if(def.target&&!missionTargets(type,m).some(t=>t.id===targetId)){notify('Escolha um alvo válido para a missão.',true);return;}
        // Diamantes ressentidas podem se recusar.
        if(m.loyalty<30&&Math.random()<(30-m.loyalty)/30){changeLoyalty(m,-2);say(m,lines(m).refuseMission);log(m.name+' recusou a missão: '+def.label+'.','−2 lealdade',m.colorHex);notify(m.name+' recusou a missão.',true);refresh();return;}
        const c=ensureCourt(),duration=missionDuration(type,targetId);
        c.missions.push({id:c.nextId++,ownerId:m.id,type,targetId:targetId||null,progress:0,duration,chance:missionChance(m,type)});
        m.courtStatus='mission';say(m,'Partindo para '+def.label.toLowerCase()+'.');
        log(m.name+' partiu: '+def.label+(targetId?' · '+(PLANETS[targetId]?.shortName||byId(targetId)?.name||''):'')+'.','Duração '+formatDuration(duration),m.colorHex);
        refresh();
    }
    function finishMission(x){
        const c=ensureCourt(),m=byId(x.ownerId);c.missions=c.missions.filter(y=>y!==x);if(!m)return;
        m.courtStatus=m.courtStatus==='mission'?'court':m.courtStatus;
        const ok=Math.random()<x.chance,power=Number(m.diamondPower)||1.8,p=PLANETS[x.targetId];let result='';
        if(x.type==='explore'&&p){if(ok){p.scouted=true;p.travelUnlocked=true;p.reconnaissance=typeof createRedEyeReport==='function'?createRedEyeReport(p):p.reconnaissance;result='reconheceu '+p.shortName;}else result='não conseguiu mapear '+p.shortName;}
        else if(x.type==='pacify'&&p){if(window.GempireResistance)GempireResistance.reduce(p,ok?30:8,'Missão de '+m.name);if(ok){p.dissent=Math.max(0,(Number(p.dissent)||0)-50);if(!window.GempireResistance)p.rebellionActive=false;result='pacificou '+p.shortName+' (−50 dissidência)';}else{p.dissent=Math.max(0,(Number(p.dissent)||0)-10);result='acalmou parcialmente '+p.shortName+' (−10 dissidência)';}}
        else if(x.type==='extract'&&p){const want=Math.round(300*power*(ok?1:.4)),got=Math.min(want,Math.max(0,Number(p.resourcesRemaining)||0));p.resourcesRemaining=Math.max(0,(Number(p.resourcesRemaining)||0)-got);
            if(p.id===(state.activeColonyPlanetId||'homeworld'))state.minerals=(Number(state.minerals)||0)+got;else{const e=ensurePlanetEconomy(p,false);e.minerals=(Number(e.minerals)||0)+got;}
            p.dissent=Math.min(100,(Number(p.dissent)||0)+5);result='extraiu '+fmt(got)+' minerais de '+p.shortName;}
        else if(x.type==='meditate'){const n=Math.round(2000*power*(ok?1:.35));m.essence=(Number(m.essence)||0)+n;result='produziu '+fmt(n)+' de essência própria';}
        else if(x.type==='diplomacy'){const o=byId(x.targetId);if(o){changeRelation(m.id,o.id,ok?25:-8);result=(ok?'aproximou-se de ':'desentendeu-se com ')+o.name;}}
        changeLoyalty(m,ok?3:-3,false);say(m,ok?lines(m).missionOk:lines(m).missionFail);
        log(m.name+' '+(ok?'concluiu':'falhou em')+' '+MISSION_TYPES[x.type].label.toLowerCase()+': '+result+'.',(ok?'+3':'−3')+' lealdade',ok?m.colorHex:'#fb923c');
        notify(m.name+' voltou: '+result+'.',!ok);
    }
    function updateMissions(dt){ensureCourt().missions.slice().forEach(x=>{x.progress=Math.min(100,x.progress+dt*100/Math.max(1,x.duration));if(x.progress>=100)finishMission(x);});}

    // ---------------------------------------------------------------- 4. política da corte
    function present(){return matriarchs().filter(available);}
    function updatePolitics(dt){
        const c=ensureCourt();
        if(!c.dispute){c.timers.dispute-=dt;if(c.timers.dispute<=0){c.timers.dispute=240+Math.random()*180;startDispute();}}
        else{c.dispute.remaining-=dt;if(c.dispute.remaining<=0)resolveDispute('ignore');}
        if(!c.vote){c.timers.vote-=dt;if(c.timers.vote<=0){c.timers.vote=330+Math.random()*210;startVote();}}
        else{c.vote.remaining-=dt;if(c.vote.remaining<=0)resolveVote(null);}
    }
    function startDispute(){
        const ms=present();if(ms.length<2)return;
        let best=null;for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++){const r=relation(ms[i].id,ms[j].id)+Math.random()*25;if(!best||r<best.r)best={a:ms[i],b:ms[j],r};}
        if(!best||best.r>25)return;
        const tones=[toneOf(best.a),toneOf(best.b)].sort().join('|');let [a,b]=[best.a,best.b];
        if(tones==='gentle|harsh'&&toneOf(a)!=='gentle')[a,b]=[b,a];
        if(tones==='cerebral|grand'&&toneOf(a)!=='cerebral')[a,b]=[b,a];
        let text=pick(DISPUTES[tones]||DISPUTES.default).replace('{a}',a.name).replace('{b}',b.name),rebelPlanet=null;
        // Com revolta aberta, a linha-dura e as conciliadoras brigam sobre como responder.
        const hot=troubled(3);
        if(hot.length&&tones==='gentle|harsh'){rebelPlanet=pick(hot);text=b.name+' quer esmagar a revolta em '+rebelPlanet.shortName+'; '+a.name+' quer negociar com os rebeldes.';}
        ensureCourt().dispute={a:a.id,b:b.id,text,remaining:240,rebelPlanetId:rebelPlanet?.id||null};
        log('Disputa na corte: '+text,'Aguardando sua mediação','#f2cf86');notify('Disputa na corte entre '+a.name+' e '+b.name+'.');
        renderIfVisible(true);
    }
    function resolveDispute(choice){
        const c=ensureCourt(),d=c.dispute;if(!d)return;const a=byId(d.a),b=byId(d.b);c.dispute=null;if(!a||!b){renderIfVisible(true);return;}
        let impact='';
        if(choice==='a'||choice==='b'){
            const win=choice==='a'?a:b,lose=choice==='a'?b:a;
            const rp=d.rebelPlanetId&&PLANETS[d.rebelPlanetId];
            if(rp&&R()){if(toneOf(win)==='harsh'){R().reduce(rp,10,'Ofensiva apoiada por '+win.name);rp.dissent=Math.min(100,(Number(rp.dissent)||0)+6);}else{R().reduce(rp,6,'Diálogo apoiado por '+win.name);rp.dissent=Math.max(0,(Number(rp.dissent)||0)-8);}}
            changeLoyalty(win,8);changeLoyalty(lose,-9);changeRelation(a.id,b.id,-15);impact='Favoreceu '+win.name;
            // Hierarquia: dar razão à menor contra a superiora mina a autoridade.
            const winRank=rankOf(win),loseRank=rankOf(lose);
            if(winRank>loseRank){win.obedience=clamp(win.obedience-5);changeLoyalty(lose,-3,false);impact+=' · contra a hierarquia (−5 obediência)';}
            else{lose.obedience=clamp(lose.obedience+5);impact+=' · hierarquia reforçada (+5 obediência de '+lose.name+')';}
        }
        else if(choice==='mediate'){if(!spendEssence(40)){c.dispute=d;notify('A mediação exige 40 de essência.',true);return;}changeLoyalty(a,3,false);changeLoyalty(b,3,false);changeRelation(a.id,b.id,22);impact='Mediação · −40 essência';}
        else{changeLoyalty(a,-3,false);changeLoyalty(b,-3,false);changeRelation(a.id,b.id,-10);impact='Ignorada';}
        log('Disputa entre '+a.name+' e '+b.name+' resolvida.',impact,'#f2cf86');refresh();
    }
    function startVote(){
        const ms=present();if(!ms.length)return;
        const pool=PROPOSALS.filter(p=>!p.when||p.when());const prop=pick(pool.length?pool:PROPOSALS),votes={};
        // Voto pela preferência do temperamento, puxado pela lealdade (leais tendem a apoiar a fundadora).
        ms.forEach(m=>{const pref=prop.pref[toneOf(m)]||0;votes[m.id]=pref+(Math.random()-.5)*.8>0?'yes':'no';});
        // Autoridade: Diamantes obedientes tendem a seguir o voto da superiora (na ordem da hierarquia).
        const follows={};ms.forEach(m=>{const sup=superiorOf(m);if(sup&&votes[sup.id]&&Math.random()<m.obedience/100*.75){votes[m.id]=votes[sup.id];follows[m.id]=sup.id;}});
        ensureCourt().vote={id:prop.id,votes,follows,remaining:300};
        log('Proposta no conselho: '+prop.title+'.','Votação aberta','#c9a6ff');notify('O conselho votou: '+prop.title+'. Sua decisão é final.');
        renderIfVisible(true);
    }
    function resolveVote(approve){
        const c=ensureCourt(),v=c.vote;if(!v)return;c.vote=null;const prop=PROPOSALS.find(p=>p.id===v.id);if(!prop){renderIfVisible(true);return;}
        const yes=Object.values(v.votes).filter(x=>x==='yes').length,no=Object.values(v.votes).length-yes;
        if(approve===null){Object.entries(v.votes).forEach(([id,x])=>{const m=byId(id);if(m&&x==='yes')changeLoyalty(m,-2,false);});log('A proposta "'+prop.title+'" expirou sem decisão.','Apoiadoras −2 lealdade','#94a3b8');refresh();return;}
        const majority=yes>no?'yes':no>yes?'no':null,decision=approve?'yes':'no';
        Object.entries(v.votes).forEach(([id,x])=>{const m=byId(id);if(!m)return;changeLoyalty(m,x===decision?3:-4,false);});
        // Contrariar a maioria do conselho custa caro.
        if(majority&&majority!==decision)matriarchs().forEach(m=>{changeLoyalty(m,-2,false);m.autonomy=clamp(m.autonomy+2);});
        const effect=approve?prop.effect():'Nada muda';
        log('Você '+(approve?'aprovou':'rejeitou')+' "'+prop.title+'" ('+yes+' a favor, '+no+' contra).',effect+(majority&&majority!==decision?' · contrariou a maioria':''),'#c9a6ff');
        refresh();
    }

    // ---------------------------------------------------------------- ciclo
    function update(dt){
        if(!state||!state.firstGameStarted||!matriarchs().length)return;
        dt=Math.max(0,Math.min(5,Number(dt)||0));
        ensureCourt();updatePunishments();updateAppeals(dt);updateRequests(dt);updateMissions(dt);updateIndependence(dt);updatePolitics(dt);
        renderTimer-=dt;if(renderTimer<=0){renderTimer=2;renderIfVisible(false);}
    }
    let renderTimer=2;
    function renderIfVisible(force){
        if(state.currentScreen!=='governance'||state.governanceSection!=='court')return;
        const el=document.getElementById('governance-content');if(!el)return;
        // Não redesenha enquanto o jogador escolhe algo numa lista.
        if(!force&&el.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;
        render(el);
    }

    // ---------------------------------------------------------------- interface
    const shortName=n=>String(n||'').replace(/^Diamante\s+/i,'');
    function bar(label,value,color){return '<div class="court-bar"><span>'+label+'</span><div><i style="width:'+clamp(value)+'%;background:'+color+'"></i></div><b>'+Math.round(value)+'%</b></div>';}
    function audienceButton(m,key){
        const def=AUDIENCE[key],left=def.cooldown?cooldownLeft(m,key):0,blocked=(m.courtStatus!=='court'&&key!=='report')||left>0;
        return '<button class="btn" '+(blocked?'disabled':'')+' onclick="GempireCourt.audience(\''+m.id+'\',\''+key+'\')">'+def.label+(left>0?' · '+formatDuration(left):'')+'</button>';
    }
    function renderRequest(r){
        const m=byId(r.ownerId);if(!m)return '';const prog=requestProgress(r);
        if(r.handledBy){const sup=byId(r.handledBy);return '<div class="stat-box court-request" style="border-left:3px solid '+esc(sup?.colorHex||m.colorHex)+'"><div class="court-row"><b>'+esc(m.name)+' · '+esc(r.title)+'</b><span class="badge">Com '+esc(shortName(sup?.name))+' · decide em '+Math.ceil(Math.max(0,r.decideIn))+'s</span></div><p class="structure-desc">“'+esc(r.text)+'”</p><small style="color:var(--text-muted)">Delegado pela hierarquia. '+esc(sup?.name||'A superiora')+' decide conforme a personalidade e a relação com '+esc(shortName(m.name))+'.</small><div class="court-actions"><button class="btn" onclick="GempireCourt.takeBack('+r.id+')">Retomar o pedido (−2 lealdade de '+esc(shortName(sup?.name))+')</button></div></div>';}
        const actions=[];
        if(r.type==='pay'){actions.push('<button class="btn btn-emerald" '+(canPay(r.cost)?'':'disabled')+' onclick="GempireCourt.fulfill('+r.id+')">Atender · '+costText(r.cost)+'</button>');actions.push('<button class="btn" '+(canPay(r.cost,.5)?'':'disabled')+' onclick="GempireCourt.negotiate('+r.id+')">Negociar metade</button>');}
        else if(r.type==='govern')actions.push('<button class="btn btn-emerald" onclick="GempireCourt.fulfill('+r.id+')">Conceder o governo</button>');
        else if(r.type==='autonomy')actions.push('<button class="btn btn-emerald" onclick="GempireCourt.fulfill('+r.id+')">Conceder (+15 autonomia)</button>');
        else if(GOAL_TYPES.includes(r.type))actions.push('<button class="btn btn-emerald" '+(prog.done?'':'disabled')+' onclick="GempireCourt.fulfill('+r.id+')">Entregar</button>');
        actions.push('<button class="btn btn-pink" onclick="GempireCourt.refuse('+r.id+')">Recusar</button>');
        return '<div class="stat-box court-request" style="border-left:3px solid '+esc(m.colorHex)+'"><div class="court-row"><b>'+esc(m.name)+' · '+esc(r.title)+'</b><span class="badge">'+formatDuration(r.remaining)+'</span></div><p class="structure-desc">“'+esc(r.text)+'”</p>'+(prog.text?'<small>Progresso: <b>'+esc(prog.text)+'</b></small>':'')+'<small style="display:block;color:var(--text-muted)">Atender: +'+r.reward+' lealdade · Recusar: −'+r.penalty+' · Ignorar até o prazo: −'+Math.round(r.penalty*1.5)+' e uma queixa</small><div class="court-actions">'+actions.join('')+'</div></div>';
    }
    function renderMatriarch(m){
        const c=ensureCourt(),mood=moodOf(m),tone=toneOf(m),g=governedPlanet(m),mission=c.missions.find(x=>x.ownerId===m.id);
        const rels=matriarchs().filter(o=>o!==m).map(o=>{const r=relation(m.id,o.id);return '<span class="badge" style="border-color:'+(r>=20?'#6ee7b7':r<=-10?'#fb7185':'rgba(201,166,255,.4)')+'">'+esc(o.name)+' · '+relationLabel(r)+'</span>';}).join(' ');
        const status=m.courtStatus==='poofed'?'<b style="color:#fb923c">Poofada</b>':isolated(m)?'<b style="color:#94a3b8">Isolada</b>':m.courtStatus==='bubbled'?'<b style="color:#f0abfc">Embolhada</b>':m.courtStatus==='rebel'?'<b style="color:#fb7185">Rebelde</b>':m.courtStatus==='mission'?'<b style="color:#7dd3fc">Em missão</b>':'<b style="color:#6ee7b7">Na corte</b>';
        let html='<section id="court-card-'+esc(m.id)+'" class="card court-diamond'+(c.ui?.focus===m.id?' court-focus':'')+'" style="border-left:4px solid '+esc(m.colorHex)+'"><div class="card-header"><span class="card-title"><i class="diamond-icon" style="background:'+esc(m.colorHex)+';margin-right:6px"></i>'+esc(m.name)+'</span><span class="badge">'+MOOD_LABEL[mood]+'</span></div>';
        html+='<small style="display:block;color:var(--text-muted)">'+esc(m.personalityName||'')+' · temperamento '+TONE_LABEL[tone]+' · '+status+(g?' · governa '+esc(g.shortName):'')+' · '+fmt(m.essence)+' essência própria'+(m.grievances?' · <b style="color:#fb923c">'+m.grievances+' queixa(s)</b>':'')+'</small>';
        html+=bar('Lealdade',m.loyalty,m.loyalty<35?'#fb7185':m.loyalty<70?'#f2cf86':'#6ee7b7')+bar('Autonomia',m.autonomy,'#7dd3fc')+bar('Obediência',m.obedience,m.obedience<35?'#fb7185':m.obedience<60?'#f2cf86':'#c9a6ff');
        html+='<small style="display:block;color:var(--text-muted);margin-top:4px">Posição '+rankOf(m)+' · responde a '+(superiorOf(m)?'<b>'+esc(superiorOf(m).name)+'</b>':'<b>fundadora</b>')+(m.delegated.length?' · delega '+m.delegated.map(t=>DELEGABLE[t]).join(', '):'')+'</small>';
        html+='<div class="court-speech">“'+esc(m.currentSpeech||lines(m).greet[mood])+'”</div>';
        if(rels)html+='<div class="court-rels">'+rels+'</div>';
        if(m.courtStatus==='poofed'){html+='<div class="court-bubbled">Poofada pelo ataque de cinese: a gema está caída e vulnerável. Reforma em '+formatDuration(Math.max(0,(Number(m.reformAt)||0)-gameNow())/1000)+'.</div><div class="court-actions"><button class="btn btn-pink" onclick="GempireCourt.punish(\''+m.id+'\')">Embolhar enquanto está caída · 100%</button></div></section>';return html;}
        if(m.courtStatus==='bubbled'){const cycles=Math.max(0,(Number(state.cycleCount)||1)-(Number(m.bubbledCycle)||1));html+='<div class="court-bubbled">Embolhada em '+esc(PLANETS[m.bubbledPlanetId]?.shortName||'?')+' há '+cycles+' ciclo(s). Não governa, não vota, não faz pedidos nem missões. Quanto mais tempo, mais ressentida ao voltar.</div><div class="court-actions"><button class="btn btn-emerald" onclick="GempireCourt.unbubble(\''+m.id+'\')">Libertar da bolha</button></div></section>';return html;}
        const pc=punishCooldown(m),pb=(dis,txt,fn)=>'<button class="btn'+(fn==='punish'||fn==='kinesis'?' btn-pink':'')+'" '+(dis||pc>0?'disabled':'')+' onclick="GempireCourt.'+fn+'(\''+m.id+'\')">'+txt+'</button>';
        const ks=kinesisStats(m),pearls=pearlsOf(m),gp=governedPlanet(m),last=matriarchs().indexOf(m)===matriarchs().length-1;
        const punish='<div class="court-subtitle">Punição'+(pc>0?' · próxima em '+formatDuration(pc):'')+'</div><div class="court-actions">'+
            pb(!pearls,'Remover Pérola'+(pearls?'':' (sem Pérola)'),'pearl')+
            pb(m.courtStatus!=='court'||isolated(m),isolated(m)?'Isolada · '+formatDuration((m.isolatedUntil-gameNow())/1000):'Isolamento (10 min)','isolate')+
            pb(last,'Queda na hierarquia','demote')+
            pb(!gp,'Tomar colônia'+(gp?' ('+esc(gp.shortName)+')':' (nenhuma)'),'takeColony')+
            pb(false,'Ataque de cinese · '+ks.cost+' essência · '+Math.round(ks.chance*100)+'%','kinesis')+
            pb(false,'Embolhar · '+Math.round(bubbleChance(m)*100)+'%','punish')+'</div>'+
            (m.pearlRevoked?'<div class="court-actions"><button class="btn" onclick="GempireCourt.returnPearl(\''+m.id+'\')">Devolver o direito à Pérola</button></div>':'')+
            '<small style="display:block;color:var(--text-muted)">Toda punição aumenta a obediência da corte por medo; as gentis e as aliadas dela reagem mal. Ataque de cinese: sua '+esc(ks.kinesis)+' contra a '+esc(ks.herKinesis)+' dela; se vencer, ela é poofada e pode ser embolhada com certeza; se falhar, ela pode se rebelar. Embolhar exige Sala das Bolhas.</small>';
        if(m.courtStatus==='rebel'){html+=punish+'<div class="court-actions"><button class="btn btn-emerald" onclick="GempireCourt.reconcile(\''+m.id+'\')">Reconciliação · 250 essência + 300 minerais</button>'+audienceButton(m,'report')+'</div></section>';return html;}
        html+='<div class="court-subtitle">Audiência política</div><div class="court-actions">'+['autonomy','obey','gift','tribute','commune','report'].map(k=>audienceButton(m,k)).join('')+'<button class="btn" onclick="GempireCourt.openSocial(\''+m.id+'\')">Convívio pessoal →</button></div>';
        html+=punish;
        html+='<div class="court-subtitle">Missão</div>';
        if(mission){html+='<div class="stat-box"><b>'+MISSION_TYPES[mission.type].label+'</b>'+(mission.targetId?' · '+esc(PLANETS[mission.targetId]?.shortName||byId(mission.targetId)?.name||''):'')+'<div class="founding-progress"><div style="width:'+mission.progress+'%"></div></div><small>Chance de sucesso: '+Math.round(mission.chance*100)+'% · faltam '+formatDuration(mission.duration*(100-mission.progress)/100)+'</small></div>';}
        else{
            const sel=c.ui?.[m.id]||'meditate',def=MISSION_TYPES[sel],targets=missionTargets(sel,m);
            html+='<div class="court-mission"><select onchange="GempireCourt.pickMission(\''+m.id+'\',this.value)">'+Object.entries(MISSION_TYPES).map(([k,d])=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+d.label+(d.affinity.includes(m.personalityId)?' ★':'')+'</option>').join('')+'</select>';
            if(def.target)html+=targets.length?'<select id="court-target-'+m.id+'">'+targets.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.label)+'</option>').join('')+'</select>':'<small style="color:var(--text-muted)">Nenhum alvo disponível.</small>';
            html+='<small style="display:block;color:var(--text-muted)">'+def.desc+' Chance: '+Math.round(missionChance(m,sel)*100)+'%'+(def.affinity.includes(m.personalityId)?' (afinidade)':'')+(m.loyalty<30?' · pode recusar':'')+'</small>';
            html+='<button class="btn btn-block" '+((def.target&&!targets.length)||m.courtStatus!=='court'?'disabled':'')+' onclick="GempireCourt.startMission(\''+m.id+'\',\''+sel+'\','+(def.target?'document.getElementById(\'court-target-'+m.id+'\')?.value':'null')+')">Enviar em missão</button></div>';
        }
        return html+'</section>';
    }
    function render(container){
        if(!container)return;
        const ms=matriarchs();
        if(!ms.length){container.innerHTML='<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">Corte das Diamantes</span><span class="badge">Vazia</span></div><p class="governance-muted">A fundadora ainda governa sozinha. Forje uma nova Diamante na Dinastia & Forja: cada Matriarca chega com personalidade própria, faz pedidos, aceita missões, participa do conselho e se relaciona com as outras.</p></section>';return;}
        const c=ensureCourt();let html='';
        const avg=ms.reduce((a,m)=>a+m.loyalty,0)/ms.length;
        html+='<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">Corte das Diamantes</span><span class="badge">'+ms.length+' Matriarca(s) · lealdade média '+Math.round(avg)+'%</span></div><p class="governance-muted">Atenda pedidos, conduza audiências, delegue missões e decida as disputas e votações. Lealdade abaixo de 35% leva a ações independentes; abaixo de 15% com 3 queixas, a Diamante se rebela.</p></section>';
        if(c.appeals.length)html+='<section class="card card-amber"><div class="card-header"><span class="card-title">Apelos à fundadora</span><span class="badge">'+c.appeals.length+'</span></div>'+c.appeals.map(a=>{const m=byId(a.subId),sup=byId(a.supId);if(!m)return '';const bypass=a.kind==='bypass';
            return '<div class="stat-box court-request" style="border-left:3px solid '+esc(m.colorHex)+'"><div class="court-row"><b>'+esc(bypass?'Hierarquia ignorada':'Apelo contra '+(sup?.name||'a superiora'))+'</b><span class="badge">'+formatDuration(a.remaining)+'</span></div><p class="structure-desc">'+esc(a.text)+'</p><small style="color:var(--text-muted)">Obediência de '+esc(shortName(m.name))+': '+Math.round(m.obedience)+'%. Sem resposta, ela se sente ignorada.</small><div class="court-actions">'+
                (bypass?'<button class="btn" onclick="GempireCourt.appeal('+a.id+',\'uphold\')">Devolver a '+esc(shortName(sup?.name))+'</button><button class="btn btn-emerald" onclick="GempireCourt.appeal('+a.id+',\'overrule\')">Tratar eu mesma</button>'
                :'<button class="btn" onclick="GempireCourt.appeal('+a.id+',\'uphold\')">Manter a decisão de '+esc(shortName(sup?.name))+'</button><button class="btn btn-emerald" onclick="GempireCourt.appeal('+a.id+',\'overrule\')">Revogar e atender'+(a.request.type==='pay'?' · '+costText(a.request.cost):'')+'</button>')+
                '<button class="btn btn-pink" onclick="GempireCourt.appeal('+a.id+',\'punish\')">Punir a insubordinação</button></div></div>';}).join('')+'</section>';
        html+='<section class="card"><div class="card-header"><span class="card-title">Hierarquia da Autoridade</span><span class="badge">Mais alto = mais poder</span></div><p class="governance-muted">Escolha a superiora de cada Diamante e quais pedidos ela resolve. Superioras decidem conforme a personalidade e pagam tributos com a própria essência. Diamantes desobedientes podem pular a hierarquia ou apelar a você; as obedientes seguem o voto da superiora no conselho.</p>'+
            ms.map((m,i)=>{const sups=validSuperiors(m);return '<div class="court-rank"><div class="court-row"><b><span class="court-rank-n">'+(i+1)+'</span><i class="diamond-icon" style="background:'+esc(m.colorHex)+';margin-right:5px"></i>'+esc(m.name)+'</b><span class="court-rank-move"><button class="btn" '+(i===0?'disabled':'')+' onclick="moveMatriarchAuthority('+i+',-1)" aria-label="Promover">▲</button><button class="btn" '+(i===ms.length-1?'disabled':'')+' onclick="moveMatriarchAuthority('+i+',1)" aria-label="Rebaixar">▼</button></span></div>'+
                bar('Obediência',m.obedience,m.obedience<35?'#fb7185':m.obedience<60?'#f2cf86':'#c9a6ff')+
                '<label class="stat-label">Responde a<select onchange="GempireCourt.setSuperior(\''+m.id+'\',this.value)">'+sups.map(id=>'<option value="'+esc(id)+'"'+((m.superiorId||'first')===id?' selected':'')+'>'+(id==='first'?'Fundadora (você)':esc(byId(id)?.name))+'</option>').join('')+'</select></label>'+
                (superiorOf(m)?'<div class="court-actions">'+Object.entries(DELEGABLE).map(([k,l])=>'<button class="btn'+(m.delegated.includes(k)?' active':'')+'" onclick="GempireCourt.toggleDelegation(\''+m.id+'\',\''+k+'\')">'+(m.delegated.includes(k)?'✓ ':'')+l+'</button>').join('')+'</div>':'<small style="color:var(--text-muted)">Responde diretamente a você; nenhum pedido é delegado.</small>')+'</div>';}).join('')+'</section>';
        if(c.dispute){const a=byId(c.dispute.a),b=byId(c.dispute.b);if(a&&b)html+='<section class="card"><div class="card-header"><span class="card-title">Disputa na corte</span><span class="badge">'+formatDuration(c.dispute.remaining)+'</span></div><p class="structure-desc">'+esc(c.dispute.text)+'</p><small style="color:var(--text-muted)">Relação atual: '+relationLabel(relation(a.id,b.id))+'. Favorecer uma afasta as duas; mediar aproxima.</small><div class="court-actions"><button class="btn" onclick="GempireCourt.dispute(\'a\')">Apoiar '+esc(a.name)+'</button><button class="btn" onclick="GempireCourt.dispute(\'b\')">Apoiar '+esc(b.name)+'</button><button class="btn btn-emerald" onclick="GempireCourt.dispute(\'mediate\')">Mediar · 40 essência</button><button class="btn btn-pink" onclick="GempireCourt.dispute(\'ignore\')">Ignorar</button></div></section>';}
        if(c.vote){const prop=PROPOSALS.find(p=>p.id===c.vote.id);if(prop){const entries=Object.entries(c.vote.votes),yes=entries.filter(([,x])=>x==='yes').length;
            html+='<section class="card"><div class="card-header"><span class="card-title">Conselho · '+esc(prop.title)+'</span><span class="badge">'+formatDuration(c.vote.remaining)+'</span></div><p class="structure-desc">'+esc(prop.text)+'</p><div class="court-rels">'+entries.map(([id,x])=>{const m=byId(id);return m?'<span class="badge" style="border-color:'+(x==='yes'?'#6ee7b7':'#fb7185')+'">'+esc(m.name)+' · '+(x==='yes'?'a favor':'contra')+(c.vote.follows&&c.vote.follows[id]?' (segue '+esc(shortName(byId(c.vote.follows[id])?.name))+')':'')+'</span>':'';}).join(' ')+'</div><small style="color:var(--text-muted)">'+yes+' a favor, '+(entries.length-yes)+' contra. Quem votou com você ganha lealdade; contrariar a maioria custa lealdade de todas.</small><div class="court-actions"><button class="btn btn-emerald" onclick="GempireCourt.vote(true)">Aprovar</button><button class="btn btn-pink" onclick="GempireCourt.vote(false)">Rejeitar</button></div></section>';}}
        html+='<section class="card"><div class="card-header"><span class="card-title">Pedidos</span><span class="badge">'+c.requests.length+' aberto(s)</span></div>'+(c.requests.length?c.requests.map(renderRequest).join(''):'<p class="governance-muted">Nenhum pedido no momento. As Diamantes trazem novos pedidos de tempos em tempos.</p>')+'</section>';
        html+=ms.map(renderMatriarch).join('');
        html+='<section class="card"><div class="card-header"><span class="card-title">Registro da corte</span></div>'+(c.log.length?c.log.slice(0,14).map(e=>'<div class="court-log"'+(e.color?' style="border-left-color:'+esc(e.color)+'"':'')+'><span>'+esc(e.text)+'</span>'+(e.impact?'<small>'+esc(e.impact)+'</small>':'')+'</div>').join(''):'<p class="governance-muted">Nada registrado ainda.</p>')+'</section>';
        container.innerHTML=html;
    }
    function openSocial(id){
        if(typeof switchDrawerTab==='function'){state.drawerOpen=true;try{toggleDrawer(true);}catch(e){}switchDrawerTab('social');}
        if(typeof window.selectSocialDiamond==='function')window.selectSocialDiamond(id);
    }
    function focus(id){const c=ensureCourt();c.ui=c.ui||{};c.ui.focus=id;setTimeout(()=>{const el=document.getElementById('court-card-'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},120);}
    function pickMission(id,type){const c=ensureCourt();c.ui=c.ui||{};c.ui[id]=type;renderIfVisible(true);}
    function summary(){
        if(!matriarchs().length)return null;const c=ensureCourt();
        return {requests:c.requests.length+c.appeals.length,appeals:c.appeals.length,dispute:!!c.dispute,vote:!!c.vote,missions:c.missions.length,rebels:matriarchs().filter(m=>m.courtStatus==='rebel').length};
    }

    window.GempireCourt={update,render,audience,reconcile,fulfill:fulfillRequest,negotiate:negotiateRequest,refuse:refuseRequest,startMission,pickMission,openSocial,punish:punishBubble,unbubble,pearl:punishPearl,returnPearl,isolate:punishIsolate,demote:punishDemote,takeColony:punishColony,kinesis:punishKinesis,focus,appeal:resolveAppeal,setSuperior,toggleDelegation,takeBack,dispute:resolveDispute,vote:resolveVote,summary,ensure:ensureCourt,_debug:{makeRequest,startDispute,startVote}};
    window.renderDiamondCourtTab=render;
    // Mudança de várias posições de uma vez: efeitos somados, com limite, e reação de quem foi ultrapassada.
    function moveTo(from,to){
        const list=matriarchs(),m=list[from];if(!m||from===to||to<0||to>=list.length)return;
        ensureCourt();
        const passed=from>to?list.slice(to,from):list.slice(from+1,to+1),steps=passed.length,up=to<from;
        list.splice(from,1);list.splice(to,0,m);
        if(up){const d=Math.min(12,3+2*steps);changeLoyalty(m,d,false);passed.forEach(o=>{changeLoyalty(o,-3,false);o.obedience=clamp(o.obedience-2);});
            log(m.name+' foi promovida para a posição Nº '+(to+1)+', acima de '+passed.map(o=>shortName(o.name)).join(', ')+'.','+'+d+' lealdade · ultrapassadas −3 lealdade',m.colorHex);}
        else{const d=Math.min(12,3+2*steps);changeLoyalty(m,-d,false);m.obedience=clamp(m.obedience-4);passed.forEach(o=>changeLoyalty(o,2,false));
            log(m.name+' foi rebaixada para a posição Nº '+(to+1)+'.','−'+d+' lealdade · −4 obediência',m.colorHex);}
        ensureCourt();
        notify(m.name+' agora ocupa a posição Nº '+(to+1)+' da Autoridade Diamante.');
        try{const body=document.getElementById('drawer-body');if(body&&state.drawerTab==='dynasty'&&typeof renderDynastyTab==='function')renderDynastyTab(body);}catch(e){}
        refresh();
    }
    window.GempireCourt.moveTo=moveTo;
    // Promover ou rebaixar na hierarquia mexe com o orgulho de quem sobe e de quem desce.
    const baseMove=window.moveMatriarchAuthority;
    if(typeof baseMove==='function')window.moveMatriarchAuthority=function(index,direction){
        const list=matriarchs(),m=list[index],other=list[index+direction];
        baseMove(index,direction);
        if(!m||!other||list.indexOf(m)===index)return;
        ensureCourt();
        if(direction<0){changeLoyalty(m,5,false);changeLoyalty(other,-4,false);other.obedience=clamp(other.obedience-3);log(m.name+' foi promovida acima de '+other.name+'.','+5 lealdade · '+other.name+' −4',m.colorHex);}
        else{changeLoyalty(m,-6,false);m.obedience=clamp(m.obedience-4);changeLoyalty(other,4,false);log(m.name+' foi rebaixada abaixo de '+other.name+'.','−6 lealdade · −4 obediência',m.colorHex);}
        ensureCourt();refresh();
    };
})();
