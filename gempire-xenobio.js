/* =========================================================================
 * GEMPIRE · Xenobiologia: espécies orgânicas, reservas e zoológicos
 *
 *  - Cada mundo com vida orgânica recebe de 2 a 5 espécies alienígenas
 *    procedurais (semente da partida): megafauna, insetoides, planadores,
 *    aquáticas, flora, serpentes e colônias. Cada uma tem temperamento,
 *    inteligência (até civilizações nativas), traço especial e população.
 *  - Descoberta: o reconhecimento do Olho Vermelho revela a primeira espécie;
 *    colônias catalogam as demais com o tempo ou por expedição (tecnologia).
 *  - Impacto na colonização: a extração destrói habitats e as espécies
 *    declinam até a extinção. Predadoras e peçonhentas poofam Gems; devoradoras
 *    de cristal reduzem a extração; flora simbiótica e bioluminescentes rendem
 *    essência e energia; psíquicas aumentam off-colors; civilizações nativas
 *    endurecem a hostilidade. Reservas protegem uma espécie ao custo de
 *    extração; erradicar resolve pragas mas revolta as Gentis e as colônias.
 *  - Diamantes reagem conforme a personalidade e fazem pedidos: preservar,
 *    trazer ao zoológico, estudar ou erradicar uma espécie.
 *  - Zoológico Orbital: estrutura com 4 recintos cada. Espécimes capturados
 *    ficam a salvo da extinção, rendem tecnologia e prestígio e podem ser
 *    reintroduzidos no mundo de origem.
 * Estado por planeta em planet.xeno; global em state.xeno.
 * ========================================================================= */
(function(){
    'use strict';
    const uiGate=(()=>{let last=0;return ms=>{const t=performance.now();if(t-last<ms)return false;last=t;return true;};})();
    const TAU=Math.PI*2;
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const KINDS={
        beast:{label:'Megafauna',nouns:['Pastador','Colosso','Galhudo','Trombeteiro'],pop:[2000,20000],capture:2},
        insect:{label:'Insetoide',nouns:['Rastejante','Escavador','Zumbidor','Tecelão'],pop:[200000,2000000],capture:1},
        flyer:{label:'Planador',nouns:['Planador','Asa','Cantor','Vela'],pop:[20000,300000],capture:1},
        aquatic:{label:'Aquático',nouns:['Medusa','Nadador','Lula','Sino'],pop:[50000,800000],capture:1.4},
        flora:{label:'Flora móvel',nouns:['Flor','Bulbo','Lírio','Raiz'],pop:[500000,5000000],capture:.8},
        serpent:{label:'Serpentiforme',nouns:['Serpente','Enguia','Fio','Cordão'],pop:[5000,80000],capture:1.3},
        colony:{label:'Colônia coletiva',nouns:['Colônia','Enxame','Coro','Massa'],pop:[1000000,9000000],capture:1.1}
    };
    const MATTER=['âmbar','névoa','cristal','fogo','sal','vidro','sombra','orvalho','cinza','espinho','maré','eco'];
    const SYL=['zor','qua','vel','thi','mok','ra','xen','lu','ib','sha','kor','ny','el','oth','pra','gu','ae','dri','sol','vy','ka','mi','tu','or'];
    const TEMPER={docile:{label:'Dócil'},herd:{label:'Gregária'},territorial:{label:'Territorial'},predator:{label:'Predadora'}};
    const INTEL=['Instintiva','Social','Usa ferramentas','Civilização nativa'];
    const TRAITS={
        none:{label:'—',desc:''},
        biolum:{label:'Bioluminescente',desc:'Rende energia à colônia enquanto prospera.'},
        crystal:{label:'Devoradora de cristal',desc:'Come veios minerais: −8% de extração enquanto não for contida.'},
        symbiotic:{label:'Simbiótica',desc:'Purifica a crosta: +6% de essência na colônia.'},
        venom:{label:'Peçonhenta',desc:'Ataca e poofa Gems de vez em quando.'},
        psychic:{label:'Psíquica',desc:'Interfere nos Injetores: +3% de chance de off-colors.'},
        song:{label:'Canto hipnótico',desc:'Acalma as Gems da colônia: −dissidência.'}
    };
    const STATUS=[['extinct','Extinta','#64748b'],['critical','Criticamente ameaçada','#fb7185'],['endangered','Ameaçada','#fb923c'],['declining','Em declínio','#f2cf86'],['thriving','Próspera','#6ee7b7']];
    const ENCLOSURES_PER_ZOO=4;
    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const dur=s=>typeof formatDuration==='function'?formatDuration(s):Math.ceil(s)+'s';
    const now=()=>typeof gameNow==='function'?gameNow():Date.now();
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function econ(p){return p.id===activeId()?state:ensurePlanetEconomy(p,false);}
    function censusOf(p){return econ(p).census||{};}
    function structuresOf(p){return econ(p).structures||{};}
    function essence(){return typeof essenceValue==='function'?essenceValue(state.essence):Number(state.essence)||0;}
    const matriarchs=()=>Array.isArray(state.matriarchs)?state.matriarchs:[];
    const toneOf=m=>TONE[m?.personalityId]||'grand';
    function loyalty(m,d){if(m)m.loyalty=clamp((Number(m.loyalty)||0)+d);}
    function byTone(map){matriarchs().forEach(m=>{const d=map[toneOf(m)]||0;if(d)loyalty(m,d);});}
    function lifeWorlds(){return Object.values(PLANETS).filter(p=>p&&p.organicLifePresent);}
    function depletion(p){const t=Math.max(1,Number(p.resourceTotal)||1);return clamp(1-(Number(p.resourcesRemaining)||0)/t,0,1);}

    // ------------------------------------------------------------ estado
    function X(){
        const x=state.xeno=state.xeno&&typeof state.xeno==='object'?state.xeno:{};
        x.enclosures=Array.isArray(x.enclosures)?x.enclosures:[];
        x.captures=Array.isArray(x.captures)?x.captures:[];
        x.requests=Array.isArray(x.requests)?x.requests:[];
        x.log=Array.isArray(x.log)?x.log:[];
        x.nextId=Number(x.nextId)||1;
        x.timers=x.timers&&typeof x.timers==='object'?x.timers:{request:360};
        return x;
    }
    function log(text,impact,color){const x=X();x.log.unshift({text,impact:impact||'',color:color||null,at:now()});x.log.length=Math.min(x.log.length,30);}
    function rngFor(key){let h=2166136261;for(const ch of key){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}let v=h>>>0;return ()=>{v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
    function genSpecies(p){
        const R=rngFor(p.id+'|xeno|'+(state.galaxy?.seed||0)),n=2+Math.floor(R()*4),list=[];
        const rp=a=>a[Math.floor(R()*a.length)];
        let sapient=R()<.35;
        const kinds=Object.keys(KINDS);
        for(let i=0;i<n;i++){
            const kind=rp(kinds),K=KINDS[kind];
            const sci=(rp(SYL)+rp(SYL)+(R()<.5?rp(SYL):'')).replace(/^./,c=>c.toUpperCase())+' '+(rp(SYL)+rp(SYL)+'is');
            const intel=sapient&&kind!=='flora'&&kind!=='colony'?3:(R()<.25?2:R()<.5?1:0);if(intel===3)sapient=false;
            const temper=kind==='flora'?'docile':rp(intel===3?['territorial','herd','docile']:['docile','herd','territorial','predator','predator']);
            const traitPool=['none','none','biolum','crystal','symbiotic','song',temper==='predator'||kind==='serpent'?'venom':'none',kind==='colony'||intel>=2?'psychic':'none'];
            const trait=rp(traitPool);
            const base=Math.round(K.pop[0]+R()*(K.pop[1]-K.pop[0]));
            const hue=Math.floor(R()*360);
            list.push({id:p.id+'_s'+i,name:rp(K.nouns)+'-de-'+rp(MATTER),sci,kind,temper,intel,trait,base,pop:base,
                vuln:+(.6+R()*.8).toFixed(2),hue,eyes:1+Math.floor(R()*5),pattern:Math.floor(R()*3),limbs:Math.floor(R()*3),
                discovered:false,studied:false,reserve:false,extinctWild:false,eradicated:false});
        }
        return list;
    }
    function bio(p){
        if(!p.organicLifePresent)return null;
        const b=p.xeno=p.xeno&&typeof p.xeno==='object'?p.xeno:{};
        if(!Array.isArray(b.species)||!b.species.length){b.species=genSpecies(p);b.sum=b.species.reduce((a,s)=>a+s.pop,0);if(!(Number(p.organicLifePopulation)>0))p.organicLifePopulation=b.sum;}
        b.catalogTimer=Number(b.catalogTimer)||240;
        return b;
    }
    const speciesById=id=>{for(const p of lifeWorlds()){const s=bio(p).species.find(x=>x.id===id);if(s)return {s,p};}return null;};
    function statusOf(s){if(s.pop<=0)return 0;const r=s.pop/s.base;return r<.08?1:r<.25?2:r<.6?3:4;}
    function inZoo(id){return X().enclosures.some(e=>e.speciesId===id);}
    function zooCapacity(){return Object.values(PLANETS).filter(p=>p.colonized).reduce((a,p)=>a+Math.max(0,Math.floor(Number(structuresOf(p).zoo)||0)),0)*ENCLOSURES_PER_ZOO;}
    function hasZooHere(){return Object.values(PLANETS).some(p=>p.colonized&&(Number(structuresOf(p).zoo)||0)>0);}
    function discover(p,s,how){if(s.discovered)return;s.discovered=true;log('Nova espécie catalogada em '+p.shortName+': '+s.name+' ('+KINDS[s.kind].label+').',how||'',null);notify('🧬 Espécie descoberta em '+p.shortName+': '+s.name+'.');
        if(s.intel===3)chronicle('Civilização nativa em '+p.shortName,'Os '+s.name+' usam linguagem e ferramentas. A colonização terá de lidar com eles.','Xenobiologia');}

    // ------------------------------------------------------------ efeitos na colônia
    function alive(p){const b=bio(p);return b?b.species.filter(s=>s.pop>0):[];}
    function thriving(s){return s.pop>0&&s.pop/s.base>=.25;}
    function yieldFactor(p){if(!p||!p.organicLifePresent||!p.colonized)return 1;let f=1;alive(p).forEach(s=>{if(s.trait==='crystal'&&thriving(s))f*=.92;});const res=bio(p).species.filter(s=>s.reserve&&s.pop>0).length;if(res)f*=Math.max(.7,1-.06*res);return f;}
    function essenceFactor(p){if(!p||!p.organicLifePresent)return 1;return alive(p).some(s=>s.trait==='symbiotic'&&thriving(s))?1.06:1;}
    function offColorBonus(p){if(!p||!p.organicLifePresent)return 0;return alive(p).some(s=>s.trait==='psychic'&&thriving(s))?.03:0;}
    function hostilityFactor(p){if(!p||!p.organicLifePresent)return 1;let f=.6;alive(p).forEach(s=>{if(s.intel===3)f+=.6;if(s.temper==='territorial')f+=.2;if(s.temper==='predator')f+=.15;});return f;}

    // ------------------------------------------------------------ ações
    function catalog(planetId){
        const p=PLANETS[planetId],b=p&&bio(p);if(!b)return;
        const next=b.species.find(s=>!s.discovered&&s.pop>0);if(!next){notify('Todas as espécies conhecidas de '+p.shortName+' já foram catalogadas.');return;}
        if((Number(state.tech)||0)<40){notify('Uma expedição de catalogação custa 40 de tecnologia.',true);return;}
        state.tech-=40;discover(p,next,'Expedição de catalogação');refresh();
    }
    function study(id){
        const f=speciesById(id);if(!f||!f.s.discovered||f.s.studied)return;
        if((Number(state.tech)||0)<25){notify('Estudar uma espécie custa 25 de tecnologia.',true);return;}
        state.tech-=25;f.s.studied=true;const reward=Math.round(40+f.s.intel*30+(f.s.trait!=='none'?30:0));state.tech=(Number(state.tech)||0)+reward;
        byTone({cerebral:3,grand:1});
        log('Peridotos e Safiras estudaram os '+f.s.name+'.','+'+reward+' tecnologia','#818cf8');checkRequests();refresh();
    }
    function toggleReserve(id){
        const f=speciesById(id);if(!f||!f.s.discovered||f.s.pop<=0)return;const s=f.s;
        s.reserve=!s.reserve;
        if(s.reserve){byTone({gentle:3,cerebral:1,harsh:-1});f.p.dissent=Math.max(0,(Number(f.p.dissent)||0)-2);log('Reserva criada em '+f.p.shortName+' para os '+s.name+'.','−6% de extração no planeta','#6ee7b7');}
        else{byTone({gentle:-3});log('A reserva dos '+s.name+' foi desfeita.','Extração plena','#fb923c');}
        checkRequests();refresh();
    }
    function eradicate(id){
        const f=speciesById(id);if(!f||!f.s.discovered||f.s.pop<=0)return;const s=f.s,p=f.p;
        const census=censusOf(p),troops=(Number(census.quartz)||0)+(Number(census.ruby)||0)*1.5+(Number(census.topaz)||0)*3;
        if(troops<10){notify('Erradicar exige ao menos 10 soldados na colônia.',true);return;}
        if((Number(state.minerals)||0)<150){notify('Erradicar custa 150 minerais.',true);return;}
        state.minerals-=150;
        s.pop=0;s.eradicated=true;s.reserve=false;
        if(s.temper==='predator'||s.temper==='territorial'||s.trait==='venom'){const poof=window.GempireGemFate?GempireGemFate.poof(p,'quartz',Math.min(Number(census.quartz)||0,2+Math.floor(Math.random()*4)),{reason:'Ferida na caçada'}):0;if(poof)log(poof+' Quartzo(s) poofado(s) na caçada aos '+s.name+'.','',null);}
        const sapient=s.intel===3;
        byTone(sapient?{gentle:-12,cerebral:-5,grand:-4,harsh:2}:{gentle:-6,cerebral:-2,harsh:3});
        Object.values(PLANETS).filter(q=>q.colonized).forEach(q=>q.dissent=Math.min(100,(Number(q.dissent)||0)+(sapient?6:q===p?4:1)));
        if(window.GempireResistance&&p.colonized){const r=GempireResistance._res(p);r.strength=clamp(r.strength+(sapient?15:5));}
        if(window.GempireDisasters&&p.hazards){const N=GempireDisasters._hz(p).natives;if(N)N.hostility=sapient?clamp(N.hostility+40):Math.max(0,N.hostility-15);}
        const zooNote=inZoo(s.id)?' Ainda resta um casal no Zoológico.':'';
        log('Os '+s.name+' foram erradicados de '+p.shortName+'.'+zooNote,sapient?'Genocídio: revolta nas colônias':'Diamantes Gentis −6',sapient?'#fb7185':'#fb923c');
        chronicle(sapient?'Genocídio em '+p.shortName:'Erradicação em '+p.shortName,'Os '+s.name+' foram eliminados por ordem imperial.'+zooNote,sapient?'Civilização destruída':'Espécie erradicada');
        notify('Os '+s.name+' foram erradicados.',true);checkRequests();refresh();
    }
    function freeEnclosures(){return zooCapacity()-X().enclosures.length-X().captures.length;}
    function captureCost(s){const k=KINDS[s.kind].capture;return {minerals:Math.round(120*k),essence:Math.round(20*k),time:Math.round(90*k)};}
    function capture(id){
        const f=speciesById(id);if(!f||!f.s.discovered||f.s.pop<=0)return;const s=f.s;
        if(!hasZooHere()){notify('Construa um Zoológico Orbital primeiro.',true);return;}
        if(freeEnclosures()<1){notify('Não há recinto livre no Zoológico.',true);return;}
        if(inZoo(s.id)||X().captures.some(c=>c.speciesId===s.id)){notify('Esta espécie já está no Zoológico.',true);return;}
        const c=captureCost(s);if((Number(state.minerals)||0)<c.minerals||essence()<c.essence){notify('A captura custa '+c.minerals+' minerais e '+c.essence+' de essência.',true);return;}
        state.minerals-=c.minerals;state.essence=essence()-c.essence;
        X().captures.push({id:'cp'+(X().nextId++),speciesId:s.id,planetId:f.p.id,remaining:c.time,total:c.time});
        log('Uma expedição partiu para capturar um casal de '+s.name+' em '+f.p.shortName+'.','Chega em '+dur(c.time),null);refresh();
    }
    function finishCapture(c){
        const f=speciesById(c.speciesId);if(!f)return;const s=f.s;
        const risky=s.temper==='predator'||s.trait==='venom'||s.intel===3;
        const ok=Math.random()<(risky?.65:.9);
        if(!ok){const poof=window.GempireGemFate?GempireGemFate.poof(f.p,'quartz',Math.min(Number(censusOf(f.p).quartz)||0,1+Math.floor(Math.random()*3)),{reason:'Ferida na captura'}):0;
            log('A captura dos '+s.name+' fracassou'+(poof?': '+poof+' Gem(s) poofada(s)':'')+'.','Tente de novo','#fb7185');notify('A captura dos '+s.name+' fracassou.',true);return;}
        s.pop=Math.max(0,s.pop-2);
        X().enclosures.push({speciesId:s.id,planetId:f.p.id,since:now(),name:s.name});
        byTone(s.intel===3?{gentle:-6,grand:3,cerebral:1}:{grand:3,cerebral:2,gentle:1});
        if(s.intel===3&&window.GempireDisasters&&f.p.hazards){const N=GempireDisasters._hz(f.p).natives;if(N)N.hostility=clamp(N.hostility+20);}
        if(state.aristocracy)state.aristocracy.prestige=clamp((Number(state.aristocracy.prestige)||0)+3);
        log('Um casal de '+s.name+' chegou ao Zoológico Orbital.',s.intel===3?'Prender seres pensantes revolta as Gentis':'+3 prestígio','#c4b5fd');
        chronicle('Novo recinto no Zoológico','Um casal de '+s.name+' de '+f.p.shortName+' foi instalado no Zoológico Orbital.','Coleção imperial');notify('🦠 '+s.name+' chegaram ao Zoológico.');
        checkRequests();
    }
    function release(id){
        const x=X(),i=x.enclosures.findIndex(e=>e.speciesId===id);if(i<0)return;const e=x.enclosures[i],f=speciesById(id);x.enclosures.splice(i,1);
        if(f){const s=f.s;if(s.pop<=0&&!s.eradicated)s.extinctWild=false;s.pop=Math.max(s.pop,Math.round(s.base*.05));s.eradicated=false;byTone({gentle:5,grand:-1});
            log('Os '+s.name+' foram reintroduzidos em '+f.p.shortName+'.','A população volta a crescer','#6ee7b7');chronicle('Espécie reintroduzida','Os '+s.name+' voltaram a '+f.p.shortName+'.','Xenobiologia');}
        refresh();
    }

    // ------------------------------------------------------------ pedidos das Diamantes
    function candidates(){const out=[];lifeWorlds().forEach(p=>bio(p).species.forEach(s=>{if(s.discovered)out.push({s,p});}));return out;}
    function makeRequest(){
        const x=X(),list=matriarchs().filter(m=>(m.courtStatus||'court')==='court'&&!x.requests.some(r=>r.ownerId===m.id));
        const known=candidates();if(!list.length||!known.length)return;
        const m=pick(list),t=toneOf(m);
        let r=null;
        if(t==='gentle'){const c=known.filter(({s})=>s.pop>0&&!s.reserve&&statusOf(s)<=3);const k=pick(c.length?c:known.filter(({s})=>s.pop>0&&!s.reserve));if(k)r={type:'preserve',speciesId:k.s.id,text:'Os '+k.s.name+' de '+k.p.shortName+' estão sumindo. Preserve-os: uma reserva ou um recinto no Zoológico.'};}
        else if(t==='grand'){const k=pick(known.filter(({s})=>s.pop>0&&!inZoo(s.id)));if(k)r={type:'zoo',speciesId:k.s.id,text:'Quero ver os '+k.s.name+' de '+k.p.shortName+' no Zoológico Orbital. Que espetáculo seriam!'};}
        else if(t==='cerebral'){const k=pick(known.filter(({s})=>s.pop>0&&!s.studied));if(k)r={type:'study',speciesId:k.s.id,text:'Os '+k.s.name+' de '+k.p.shortName+' guardam segredos. Ordene um estudo completo.'};}
        else{const k=pick(known.filter(({s})=>s.pop>0&&(s.temper==='predator'||s.temper==='territorial'||s.trait==='venom'||s.trait==='crystal')));if(k)r={type:'eradicate',speciesId:k.s.id,text:'Os '+k.s.name+' ameaçam nossas operações em '+k.p.shortName+'. Erradique-os.'};}
        if(!r)return;
        Object.assign(r,{id:'xr'+(x.nextId++),ownerId:m.id,created:now(),deadline:now()+12*60000});
        x.requests.push(r);log(m.name+' fez um pedido sobre a fauna.',r.text,m.colorHex);notify('🧬 '+m.name+' tem um pedido sobre uma espécie alienígena.');
    }
    function requestDone(r){const f=speciesById(r.speciesId);if(!f)return false;const s=f.s;
        if(r.type==='preserve')return s.pop>0&&(s.reserve||inZoo(s.id));
        if(r.type==='zoo')return inZoo(s.id);
        if(r.type==='study')return s.studied;
        if(r.type==='eradicate')return s.pop<=0&&s.eradicated;return false;}
    function requestFailed(r){const f=speciesById(r.speciesId);if(!f)return true;const s=f.s;
        if(r.type==='preserve'||r.type==='zoo'||r.type==='study')return s.pop<=0&&!inZoo(s.id);return false;}
    function checkRequests(){
        const x=X();x.requests=x.requests.filter(r=>{const m=matriarchs().find(o=>o.id===r.ownerId);if(!m)return false;
            if(requestDone(r)){loyalty(m,8);m.currentSpeech='Obrigada por atender ao meu pedido sobre os '+(speciesById(r.speciesId)?.s.name||'')+'.';log(m.name+' ficou satisfeita: pedido atendido.','+8 lealdade',m.colorHex);return false;}
            if(requestFailed(r)){loyalty(m,-10);log('A espécie do pedido de '+m.name+' se perdeu.','−10 lealdade',m.colorHex);return false;}
            if(r.deadline<=now()){loyalty(m,-6);log('O prazo do pedido de '+m.name+' terminou.','−6 lealdade',m.colorHex);return false;}
            return true;});
    }
    function refuse(rid){const x=X(),r=x.requests.find(q=>q.id===rid);if(!r)return;const m=matriarchs().find(o=>o.id===r.ownerId);loyalty(m,-5);x.requests=x.requests.filter(q=>q!==r);if(m)log('Você recusou o pedido de '+m.name+'.','−5 lealdade',m.colorHex);refresh();}

    // ------------------------------------------------------------ laço
    let acc=0,ui=0;
    function update(dt){
        if(!state||!dt)return;
        const x=X();
        x.captures=x.captures.filter(c=>{c.remaining-=dt;if(c.remaining<=0){finishCapture(c);return false;}return true;});
        acc+=dt;ui+=dt;
        if(acc>=5){const step=acc;acc=0;tick(step);}
        if(ui>=1){ui=0;if(uiGate(1000))renderIfVisible();}
    }
    function tick(sec){
        const k=sec/60,x=X();
        lifeWorlds().forEach(p=>{
            const b=bio(p);
            // Repelir nativos (Desastres) reduz a população total: distribui a perda entre as espécies.
            const sum=b.species.reduce((a,s)=>a+s.pop,0);
            if(Number(p.organicLifePopulation)>0&&b.sum&&p.organicLifePopulation<b.sum*.98){const f=p.organicLifePopulation/b.sum;b.species.forEach(s=>s.pop=Math.round(s.pop*f));}
            // Reconhecimento do Olho Vermelho revela a primeira espécie; colônias catalogam com o tempo.
            if(p.travelUnlocked&&!b.species.some(s=>s.discovered)){const s=b.species.find(z=>z.pop>0);if(s)discover(p,s,'Relatório do Olho Vermelho');}
            if(p.colonized){b.catalogTimer-=sec*(1+((Number(censusOf(p).peridot)||0)>0?.5:0)+((Number(censusOf(p).sapphire)||0)>0?.3:0));if(b.catalogTimer<=0){b.catalogTimer=300;const s=b.species.find(z=>!z.discovered&&z.pop>0);if(s)discover(p,s,'Peridotos da colônia');}}
            const dep=p.colonized?depletion(p):0;
            b.species.forEach(s=>{
                if(s.pop<=0)return;
                const target=s.base*Math.max(0,1-dep*s.vuln*(s.reserve?.2:1.15));
                s.pop=Math.max(0,s.pop+(target-s.pop)*.04*k);
                if(s.pop<s.base*.01&&!s.reserve){s.pop=0;s.extinctWild=true;
                    log((s.discovered?'Os '+s.name:'Uma espécie ainda não catalogada')+' de '+p.shortName+' foi extinta na natureza.',inZoo(s.id)?'Sobrevive no Zoológico':'Perda permanente','#64748b');
                    if(s.discovered){chronicle('Extinção em '+p.shortName,'Os '+s.name+' desapareceram com a destruição dos habitats.',inZoo(s.id)?'Sobrevivem no Zoológico':'Extinção');byTone({gentle:-5,cerebral:-2});}}
            });
            b.sum=b.species.reduce((a,s)=>a+s.pop,0);p.organicLifePopulation=Math.round(b.sum);
            if(b.sum<=0&&p.organicLifePopulation<=0)p.organicLifeExtinct=true;
            if(!p.colonized)return;
            // Efeitos vivos na colônia.
            alive(p).forEach(s=>{
                if(!thriving(s))return;
                if(s.trait==='biolum'){const e=econ(p);e.energy=(Number(e.energy)||0)+.4*k;}
                if(s.trait==='song')p.dissent=Math.max(0,(Number(p.dissent)||0)-.4*k);
                if(s.trait==='venom'&&!s.reserve&&Math.random()<.05*k){const q=censusOf(p),caste=(Number(q.peridot)||0)>0&&Math.random()<.4?'peridot':'quartz';const n=window.GempireGemFate?GempireGemFate.poof(p,caste,Math.min(Number(q[caste])||0,1+Math.floor(Math.random()*3)),{reason:'Ataque dos '+s.name}):0;if(n){log('Os '+s.name+' atacaram em '+p.shortName+': '+n+' Gem(s) poofada(s).','Peçonha','#fb7185');}}
            });
            // Gems e rebeldes acompanham o destino das espécies pensantes.
            if(window.GempireResistance&&alive(p).some(s=>s.intel===3&&s.reserve)){const r=GempireResistance._res(p);if(r&&r.strength>0)r.strength=clamp(r.strength-.2*k);}
            // Hostilidade dos nativos segue o perfil das espécies (somada à dos Desastres).
            if(window.GempireDisasters&&p.hazards){const N=GempireDisasters._hz(p).natives;if(N&&!(N.truceUntil>now())){const extra=(hostilityFactor(p)-1)*dep*1.2*k;if(extra>0)N.hostility=clamp(N.hostility+extra);}}
        });
        // Zoológico: estudo contínuo e prestígio.
        if(x.enclosures.length){state.tech=(Number(state.tech)||0)+x.enclosures.length*.8*k;if(state.aristocracy)state.aristocracy.prestige=clamp((Number(state.aristocracy.prestige)||0)+x.enclosures.length*.05*k);}
        x.timers.request-=sec;if(x.timers.request<=0){x.timers.request=420+Math.random()*300;makeRequest();}
        checkRequests();
    }
    function refresh(){try{updateHUD();}catch(e){}const el=document.getElementById('governance-content');if(el&&state.currentScreen==='governance'&&state.governanceSection==='xeno')render(el);}
    function renderIfVisible(){if(state.currentScreen!=='governance'||state.governanceSection!=='xeno')return;const el=document.getElementById('governance-content');if(el&&(!el.contains(document.activeElement)||document.activeElement===document.body))render(el);}

    // ------------------------------------------------------------ retratos procedurais
    function paintCreature(c,s,w,h){
        const col=(l,a)=>'hsla('+s.hue+',70%,'+l+'%,'+(a??1)+')',alt=(l)=>'hsl('+((s.hue+150)%360)+',75%,'+l+'%)';
        c.save();c.translate(w/2,h*.58);const k=Math.min(w,h)/60;c.scale(k,k);c.lineJoin='round';c.lineCap='round';c.lineWidth=1.3;const ink='#1b0f30';
        const eyes=(x,y,n,r)=>{for(let i=0;i<n;i++){const ex=x+(i-(n-1)/2)*r*2.3,ey=y-Math.abs(i-(n-1)/2)*r*.6;c.beginPath();c.arc(ex,ey,r,0,TAU);c.fillStyle='#fff';c.fill();c.strokeStyle=ink;c.lineWidth=.8;c.stroke();c.beginPath();c.arc(ex+r*.2,ey,r*.5,0,TAU);c.fillStyle=ink;c.fill();}};
        const spots=(x,y,rx,ry)=>{if(s.pattern===0)return;c.fillStyle=alt(70);for(let i=0;i<5;i++){const a=i*1.7,px=x+Math.cos(a)*rx*.55,py=y+Math.sin(a)*ry*.5;if(s.pattern===1){c.beginPath();c.arc(px,py,rx*.12,0,TAU);c.fill();}else{c.fillRect(px-rx*.05,py-ry*.4,rx*.1,ry*.8);}}};
        const glow=s.trait==='biolum'||s.trait==='psychic';if(glow){c.shadowColor=alt(65);c.shadowBlur=8;}
        c.strokeStyle=ink;c.lineWidth=1.3;
        if(s.kind==='beast'){
            c.fillStyle=col(38);[-12,-4,6,14].forEach(x=>{c.beginPath();c.rect(x-2,2,4,12);c.fill();c.stroke();});
            c.beginPath();c.ellipse(0,0,19,11,0,0,TAU);c.fillStyle=col(50);c.fill();c.stroke();spots(0,0,19,11);
            c.beginPath();c.ellipse(19,-7,8,7,0,0,TAU);c.fillStyle=col(56);c.fill();c.stroke();
            if(s.limbs){c.beginPath();c.moveTo(20,-13);c.quadraticCurveTo(24,-24,30,-20);c.moveTo(16,-13);c.quadraticCurveTo(12,-24,8,-22);c.strokeStyle=alt(80);c.lineWidth=2.2;c.stroke();c.strokeStyle=ink;c.lineWidth=1.3;}
            eyes(21,-8,Math.min(3,s.eyes),1.6);
        }else if(s.kind==='insect'){
            c.strokeStyle=ink;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-6+i*7,2);c.lineTo(-10+i*7,13);c.moveTo(-6+i*7,-2);c.lineTo(-10+i*7,-12);c.stroke();}
            [[-14,0,9,7],[-2,0,7,6],[9,0,6,5]].forEach(([x,y,rx,ry],i)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=col(45+i*6);c.fill();c.stroke();});spots(-14,0,9,7);
            c.beginPath();c.moveTo(13,-3);c.quadraticCurveTo(20,-14,26,-12);c.moveTo(13,-1);c.quadraticCurveTo(22,-8,27,-4);c.stroke();eyes(11,-1,Math.min(2,s.eyes),1.4);
        }else if(s.kind==='flyer'){
            c.beginPath();c.moveTo(-2,-2);c.quadraticCurveTo(-24,-26,-30,-4);c.quadraticCurveTo(-16,-8,-2,4);c.closePath();c.fillStyle=col(62,.85);c.fill();c.stroke();
            c.beginPath();c.moveTo(2,-2);c.quadraticCurveTo(24,-26,30,-4);c.quadraticCurveTo(16,-8,2,4);c.closePath();c.fill();c.stroke();
            c.beginPath();c.ellipse(0,2,5,11,0,0,TAU);c.fillStyle=col(42);c.fill();c.stroke();eyes(0,-5,Math.min(3,s.eyes),1.3);
            c.beginPath();c.moveTo(0,13);c.lineTo(-3,20);c.lineTo(3,20);c.closePath();c.fillStyle=alt(65);c.fill();c.stroke();
        }else if(s.kind==='aquatic'){
            c.beginPath();c.arc(0,-6,15,Math.PI,0);c.quadraticCurveTo(10,2,0,2);c.quadraticCurveTo(-10,2,-15,-6);c.closePath();c.fillStyle=col(60,.85);c.fill();c.stroke();spots(0,-10,15,8);
            c.strokeStyle=col(45);c.lineWidth=2;for(let i=0;i<5;i++){const x=-10+i*5;c.beginPath();c.moveTo(x,1);c.quadraticCurveTo(x+4,10,x-1,19);c.stroke();}c.strokeStyle=ink;c.lineWidth=1.3;
            eyes(0,-8,Math.min(5,s.eyes),1.3);
        }else if(s.kind==='flora'){
            c.beginPath();c.moveTo(0,14);c.quadraticCurveTo(-4,0,0,-10);c.strokeStyle=col(30);c.lineWidth=3;c.stroke();c.lineWidth=1.3;c.strokeStyle=ink;
            [[-10,4,-.6],[10,0,.6]].forEach(([x,y,a])=>{c.beginPath();c.ellipse(x,y,9,4,a,0,TAU);c.fillStyle=col(40);c.fill();c.stroke();});
            for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.ellipse(Math.cos(a)*7,-14+Math.sin(a)*7,6,3.4,a,0,TAU);c.fillStyle=alt(68);c.fill();c.stroke();}
            c.beginPath();c.arc(0,-14,4.5,0,TAU);c.fillStyle=col(70);c.fill();c.stroke();if(s.eyes>2)eyes(0,-14,1,2);
            c.beginPath();c.ellipse(0,15,12,3,0,0,TAU);c.fillStyle='rgba(60,30,40,.6)';c.fill();
        }else if(s.kind==='serpent'){
            c.beginPath();c.moveTo(-26,8);c.bezierCurveTo(-14,-14,-4,22,8,0);c.bezierCurveTo(14,-10,20,-10,24,-6);c.lineWidth=9;c.strokeStyle=ink;c.stroke();c.lineWidth=7;c.strokeStyle=col(48);c.stroke();c.lineWidth=1.3;
            c.beginPath();c.ellipse(25,-6,6,4.5,-.3,0,TAU);c.fillStyle=col(55);c.fill();c.strokeStyle=ink;c.stroke();eyes(26,-7,Math.min(2,s.eyes),1.2);
            if(s.trait==='venom'){c.beginPath();c.moveTo(30,-4);c.lineTo(33,0);c.strokeStyle='#bef264';c.stroke();}
        }else{
            c.beginPath();for(let i=0;i<=12;i++){const a=i/12*TAU,r=15+Math.sin(i*2.3+s.hue)*4;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r*.8):c.moveTo(Math.cos(a)*r,Math.sin(a)*r*.8);}c.closePath();c.fillStyle=col(52,.9);c.fill();c.stroke();
            for(let i=0;i<4;i++){c.beginPath();c.arc(-18+i*12,12+(i%2)*3,4,0,TAU);c.fillStyle=col(60,.8);c.fill();c.stroke();}
            const n=Math.max(3,s.eyes+2);for(let i=0;i<n;i++){const a=i/n*TAU;eyes(Math.cos(a)*7,Math.sin(a)*5,1,1.6);}
        }
        if(s.intel===3){c.shadowBlur=0;c.fillStyle='#f2cf86';c.beginPath();c.moveTo(-6,-24);c.lineTo(0,-30);c.lineTo(6,-24);c.lineTo(0,-21);c.closePath();c.fill();c.strokeStyle=ink;c.stroke();}
        c.restore();
    }
    function paintPortraits(root){
        (root||document).querySelectorAll('canvas.xeno-portrait:not([data-painted])').forEach(cv=>{
            const f=speciesById(cv.dataset.species);if(!f)return;const c=cv.getContext('2d'),w=cv.width,h=cv.height;
            const g=c.createRadialGradient(w/2,h*.6,2,w/2,h*.6,w*.7);g.addColorStop(0,'hsla('+f.s.hue+',60%,40%,.35)');g.addColorStop(1,'rgba(20,10,40,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
            if(f.s.discovered)paintCreature(c,f.s,w,h);else{c.fillStyle='rgba(233,221,255,.5)';c.font='bold 26px sans-serif';c.textAlign='center';c.fillText('?',w/2,h*.65);}
            if(f.s.pop<=0&&!inZoo(f.s.id)){c.fillStyle='rgba(20,10,40,.55)';c.fillRect(0,0,w,h);}
            cv.setAttribute('data-painted','1');
        });
    }

    // ------------------------------------------------------------ interface
    function statusBadge(s){const i=statusOf(s),[,lbl,col]=STATUS[i];const zoo=inZoo(s.id);return '<span class="badge" style="color:'+col+';border-color:'+col+'">'+(i===0&&zoo?'Extinta na natureza':lbl)+'</span>'+(zoo?' <span class="badge" style="color:#c4b5fd">No Zoológico</span>':'')+(s.reserve?' <span class="badge" style="color:#6ee7b7">Reserva</span>':'');}
    function speciesCard(s,p){
        const zoo=inZoo(s.id),cap=X().captures.find(c=>c.speciesId===s.id);
        if(!s.discovered)return '<div class="xeno-card xeno-unknown"><canvas class="xeno-portrait" data-species="'+s.id+'" width="120" height="84"></canvas><div><b>Espécie não catalogada</b><small class="governance-muted">Peridotos e Safiras da colônia catalogam com o tempo; ou mande uma expedição.</small></div></div>';
        const t=TRAITS[s.trait],cc=captureCost(s),ratio=s.pop/s.base;
        let h='<div class="xeno-card" style="--hue:'+s.hue+'"><canvas class="xeno-portrait" data-species="'+s.id+'" width="120" height="84"></canvas><div class="xeno-info">'+
            '<b class="xeno-name">'+esc(s.name)+'</b><div class="xeno-badges">'+statusBadge(s)+'</div><small class="governance-muted"><i>'+esc(s.sci)+'</i> · '+KINDS[s.kind].label+' · '+TEMPER[s.temper].label+' · '+INTEL[s.intel]+'</small>'+
            (s.trait!=='none'?'<small style="display:block;color:#f2cf86">'+t.label+': '+t.desc+'</small>':'')+
            '<div class="court-bar xeno-bar"><span>População</span><div><i style="width:'+Math.round(Math.min(1,ratio)*100)+'%;background:'+STATUS[statusOf(s)][2]+'"></i></div><b>'+fmt(s.pop)+'</b></div>';
        if(s.pop>0||zoo){
            h+='<div class="court-actions">';
            if(s.pop>0)h+='<button class="btn'+(s.reserve?' active':'')+'" onclick="GempireXeno.reserve(\''+s.id+'\')" title="Protege a espécie; −6% de extração no planeta">'+(s.reserve?'Desfazer reserva':'Criar reserva')+'</button>';
            if(s.pop>0&&!s.studied)h+='<button class="btn" onclick="GempireXeno.study(\''+s.id+'\')">Estudar · 25 tec</button>';
            if(s.pop>0&&!zoo&&!cap)h+='<button class="btn" '+(hasZooHere()&&freeEnclosures()>0?'':'disabled')+' onclick="GempireXeno.capture(\''+s.id+'\')" title="'+cc.minerals+' minerais · '+cc.essence+' essência · '+dur(cc.time)+'">Capturar para o Zoológico</button>';
            if(cap)h+='<span class="badge">Captura em andamento · '+dur(cap.remaining)+'</span>';
            if(zoo&&s.pop<=0)h+='<button class="btn btn-emerald" onclick="GempireXeno.release(\''+s.id+'\')">Reintroduzir em '+esc(p.shortName)+'</button>';
            if(s.pop>0)h+='<button class="btn btn-pink" onclick="GempireXeno.eradicate(\''+s.id+'\')" title="150 minerais e ao menos 10 soldados">'+(s.intel===3?'Exterminar a civilização':'Erradicar')+'</button>';
            h+='</div>';
        }
        return h+'</div></div>';
    }
    function render(container){
        const x=X(),worlds=lifeWorlds().filter(p=>p.travelUnlocked||p.colonized);
        const known=candidates(),cap=zooCapacity();
        let h='<section class="card card-cyan"><div class="card-header"><span class="card-title title-font">🧬 Xenobiologia</span><span class="badge">'+known.length+' espécie(s) catalogada(s)</span></div>'+
            '<p class="governance-muted">Mundos com vida orgânica abrigam espécies alienígenas. A extração destrói os habitats e as espécies declinam até a extinção. Reservas protegem uma espécie ao custo de parte da extração; o Zoológico Orbital guarda casais a salvo para sempre. As Diamantes têm opiniões fortes sobre isso.</p>'+
            '<small class="governance-muted">Gentis querem preservar; Grandiosas querem espécimes no Zoológico; Racionais querem estudos; Duras querem erradicar pragas e predadores. Exterminar uma civilização nativa revolta todas as colônias.</small></section>';
        if(x.requests.length)h+='<section class="card card-amber"><div class="card-header"><span class="card-title">Pedidos das Diamantes</span><span class="badge">'+x.requests.length+'</span></div>'+x.requests.map(r=>{const m=matriarchs().find(o=>o.id===r.ownerId);const lbl={preserve:'Preservar',zoo:'Trazer ao Zoológico',study:'Estudar',eradicate:'Erradicar'}[r.type];
            return '<div class="ar-event"><b style="color:'+(m?.colorHex||'#fff')+'">'+esc(m?.name||'Diamante')+' · '+lbl+'</b><span>"'+esc(r.text)+'"</span><small class="governance-muted">Prazo: '+dur((r.deadline-now())/1000)+' · atender +8 lealdade, recusar −5, deixar expirar −6.</small><div class="court-actions"><button class="btn" onclick="GempireXeno.refuse(\''+r.id+'\')">Recusar</button></div></div>';}).join('')+'</section>';
        h+='<section class="card"><div class="card-header"><span class="card-title">Zoológico Orbital</span><span class="badge">'+x.enclosures.length+' / '+cap+' recintos</span></div>'+
            (cap?'':'<p class="governance-muted">Construa um Zoológico Orbital (Estruturas · Corte e Residências) para guardar espécimes. Cada um tem '+ENCLOSURES_PER_ZOO+' recintos.</p>')+
            (x.enclosures.length?'<div class="xeno-zoo">'+x.enclosures.map(e=>{const f=speciesById(e.speciesId);if(!f)return '';return '<div class="xeno-pen"><canvas class="xeno-portrait" data-species="'+f.s.id+'" width="120" height="84"></canvas><b>'+esc(f.s.name)+'</b><small class="governance-muted">de '+esc(f.p.shortName)+(f.s.pop<=0?' · extinta na natureza':'')+'</small>'+(f.s.pop<=0?'<button class="btn btn-emerald" onclick="GempireXeno.release(\''+f.s.id+'\')">Reintroduzir</button>':'<button class="btn" onclick="GempireXeno.release(\''+f.s.id+'\')">Devolver à natureza</button>')+'</div>';}).join('')+'</div><small class="governance-muted">Cada recinto rende tecnologia de estudo contínuo e prestígio imperial.</small>':'')+'</section>';
        if(!worlds.length)h+='<section class="card"><p class="governance-muted">Nenhum mundo com vida orgânica foi reconhecido ainda. O Olho Vermelho revela a primeira espécie de cada mundo vivo.</p></section>';
        worlds.forEach(p=>{const b=bio(p);const N=window.GempireDisasters&&p.hazards?GempireDisasters._hz(p).natives:null;const left=b.species.filter(s=>!s.discovered&&s.pop>0).length;
            h+='<section class="card xeno-world"><div class="card-header"><span class="card-title">'+esc(p.shortName)+'</span><span class="badge">'+(p.colonized?'Colônia · extração '+Math.round(depletion(p)*100)+'%':'Não colonizado')+'</span></div>'+
                '<small class="governance-muted">Vida orgânica: '+fmt(p.organicLifePopulation)+(N?' · hostilidade nativa '+Math.round(N.hostility)+'%':'')+(yieldFactor(p)<1?' · extração ×'+yieldFactor(p).toFixed(2):'')+'</small>'+
                '<div class="xeno-list">'+b.species.filter(s=>s.discovered||s.pop>0).map(s=>speciesCard(s,p)).join('')+'</div>'+
                (left?'<div class="court-actions"><button class="btn" onclick="GempireXeno.catalog(\''+p.id+'\')">Expedição de catalogação · 40 tec ('+left+' por descobrir)</button></div>':'')+'</section>';});
        if(x.log.length)h+='<section class="card"><div class="card-header"><span class="card-title">Registro xenobiológico</span></div>'+x.log.slice(0,12).map(e=>'<div class="court-log"'+(e.color?' style="border-left-color:'+e.color+'"':'')+'><span>'+esc(e.text)+'</span>'+(e.impact?'<small>'+esc(e.impact)+'</small>':'')+'</div>').join('')+'</section>';
        const scroll=container.scrollTop;container.innerHTML=h;container.scrollTop=scroll;paintPortraits(container);
    }
    window.GempireXeno={update,render,yieldFactor,essenceFactor,offColorBonus,hostilityFactor,catalog,study,reserve:toggleReserve,eradicate,capture,release,refuse,paintPortraits,
        summary:()=>({known:candidates().length,requests:X().requests.length,zoo:X().enclosures.length}),
        _debug:{X,bio,speciesById,makeRequest,tick,finishCapture}};
    window.renderXenoTab=render;
})();
