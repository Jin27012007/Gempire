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
    function containStats(p){
        const r=res(p),g=garrison(p);
        const chance=clamp(.3+(g/(r.strength*3+r.members*2+10))*.35,.1,.95);
        return {cost:Math.round(20+r.strength*1.2),duration:Math.round(45+r.strength*1.5),chance,garrison:g};
    }

    // ------------------------------------------------------------ crescimento
    function growthPerMinute(p){
        const r=res(p),dissent=Number(p.dissent)||0,order=Number(state.order)||100,pol=policyKey();
        let g=(dissent-30)/40;
        g+=Math.min(1.5,hiddenOffColors(p)*.03);
        g+=({recycle:.15,purge:.5,tolerate:0,sanctuary:-.2,citizen:-.25})[pol]||0;
        if(order<50)g+=(50-order)/50*.5;
        g+=depletion(p)*.3;
        if(p.organicLifePresent&&depletion(p)>.3)g+=.2;
        if(rebelGovernor(p))g+=2;
        if(r.phase>=3)g+=.2; // insurreição se alimenta
        if(g>0)g*=mult();else g*=1/Math.max(.5,mult());
        if(dissent<15&&!rebelGovernor(p))g-=.6;
        return g;
    }
    // ------------------------------------------------------------ sabotagens
    function sabotage(p){
        const r=res(p);r.detected=true;
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
    function spread(p){
        const others=Object.values(PLANETS).filter(o=>o.colonized&&o!==p);if(!others.length)return;
        const same=others.filter(o=>o.systemId===p.systemId),pool=same.length?same:others;
        const target=pool[Math.floor(Math.random()*pool.length)],tr=res(target),add=Math.round(6*mult());
        tr.strength=clamp(tr.strength+add);target.dissent=Math.min(100,(Number(target.dissent)||0)+8);
        rlog(target,'Agitadores vindos de '+p.shortName+' chegaram (+'+add+' de força rebelde).');rlog(p,'A revolta se espalhou para '+target.shortName+'.');
        notify('A revolta de '+p.shortName+' se espalhou para '+target.shortName+'.',true);
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
        else{r.strength=clamp(r.strength-5);const census=Object.assign({},censusOf(p)),lost=Math.min(Number(census.quartz)||0,Math.max(1,Math.round((Number(census.quartz)||0)*.03)));census.quartz=Math.max(0,(Number(census.quartz)||0)-lost);setCensus(p,census);p.dissent=Math.min(100,(Number(p.dissent)||0)+5);
            rlog(p,'Contenção fracassou: '+lost+' Quartzo(s) perdidos.');notify('A contenção em '+p.shortName+' fracassou.',true);chronicle('Contenção fracassada em '+p.shortName,'A guarnição foi repelida e perdeu '+lost+' Quartzo(s).','+5 dissidência');}
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

    // ------------------------------------------------------------ ciclo
    let acc=0,uiAcc=0;
    function update(dt){
        if(!state||!state.firstGameStarted)return;
        dt=Math.max(0,Math.min(5,Number(dt)||0));acc+=dt;uiAcc+=dt;
        if(acc>=5){const step=acc;acc=0;
            Object.values(PLANETS).filter(p=>p&&p.colonized).forEach(p=>{
                const r=res(p);
                if(r.operation){r.operation.progress+=step*100/Math.max(1,r.operation.duration);if(r.operation.progress>=100)finishOperation(p,r);}
                r.strength=clamp(r.strength+growthPerMinute(p)*step/60);
                if(rebelGovernor(p))r.strength=Math.max(r.strength,60);
                const to=phaseFor(r);if(to!==r.phase)enterPhase(p,r,r.phase,to);
                if(r.phase>=1)p.dissent=Math.min(100,(Number(p.dissent)||0)+.5*step/60*mult());
                if(r.phase>=2){r.sabotageTimer-=step*mult();if(r.sabotageTimer<=0){r.sabotageTimer=Math.max(60,240-r.strength*1.5)+Math.random()*60;sabotage(p);}}
                if(r.phase>=3)state.order=Math.max(0,(Number(state.order)||0)-.5*step/60);
                if(r.phase>=4){r.spreadTimer-=step;if(r.spreadTimer<=0){r.spreadTimer=240+Math.random()*120;spread(p);}}
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
        if(r.phase>=3)return {exact:true,label:PHASES[r.phase].label};
        if(r.phase===2&&!r.detected&&!seers)return {exact:false,label:'Descontentamento',range:[10,55]};
        if(seers)return {exact:true,label:PHASES[r.phase].label};
        const lo=Math.max(0,Math.floor(r.strength/10)*10-10),hi=Math.min(100,lo+30);return {exact:false,label:PHASES[r.phase].label,range:[lo,hi]};
    }
    function renderPlanet(p){
        const r=res(p),k=knowledge(p),ph=PHASES.find(x=>x.label===k.label)||PHASES[0],st=containStats(p),g=growthPerMinute(p);
        const barStyle=k.exact?'width:'+r.strength+'%':'left:'+k.range[0]+'%;width:'+(k.range[1]-k.range[0])+'%;opacity:.6';
        let html='<div class="resist"><div class="court-row"><b style="color:'+ph.color+'">Resistência · '+esc(k.label)+'</b><small>'+(k.exact?Math.round(r.strength)+'/100':'estimativa')+'</small></div>';
        html+='<div class="resist-bar">'+[10,30,55,80].map(v=>'<i class="tick" style="left:'+v+'%"></i>').join('')+'<span style="'+barStyle+';background:'+ph.color+'"></span></div>';
        html+='<small style="display:block;color:var(--text-muted)">'+esc(ph.desc)+(k.exact?' · tendência '+(g>0.05?'subindo':g<-0.05?'caindo':'estável'):'')+(r.members?' · '+fmt(r.members)+' desertora(s)':'')+(r.sabotageUntil>Date.now()?' · produção sabotada':'')+(k.exact?'':' · Safiras na colônia revelariam a força exata')+'</small>';
        if(r.operation)html+='<div class="stat-box">Operação de contenção<div class="founding-progress"><div style="width:'+r.operation.progress+'%"></div></div><small>Chance '+Math.round(r.operation.chance*100)+'% · faltam '+dur(r.operation.duration*(100-r.operation.progress)/100)+'</small></div>';
        else if(r.strength>=10||p.rebellionActive)html+='<button class="btn btn-pink btn-block" onclick="GempireResistance.contain(\''+p.id+'\')">Operação de contenção · '+st.cost+' essência · '+dur(st.duration)+' · '+Math.round(st.chance*100)+'%</button><small style="display:block;color:var(--text-muted)">Guarnição: '+fmt(st.garrison)+' (Quartzos, Rubis, Topázios e Ágatas; generais reforçam). A missão "Pacificar" da Corte também enfraquece a resistência.</small>';
        if(r.log.length)html+='<div class="resist-log">'+r.log.slice(0,4).map(e=>'<small>'+esc(e.text)+'</small>').join('')+'</div>';
        return html+'</div>';
    }
    window.GempireResistance={update,contain,reduce,yieldFactor,renderPlanet,phase:p=>res(p).phase,_res:res,_sabotage:sabotage,PHASES};
})();
