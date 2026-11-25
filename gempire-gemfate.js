/* =========================================================================
 * GEMPIRE · Poof, bolhas e estilhaçamento
 *
 * Gems são luz sólida projetada ao redor da gema. Um ferimento não as mata:
 * a forma se desfaz (poof), a gema cai e leva um tempo para se reformar.
 * Enquanto está caída, a gema fica vulnerável e quem controla o campo decide:
 *   · deixar reformar · embolhar (guardada, não reforma) · estilhaçar (perda permanente)
 *
 *  - Tempo de reforma varia por casta: soldados voltam rápido, aristocratas devagar;
 *    off-colors demoram mais.
 *  - Bolhas ficam na Sala das Bolhas da colônia (40 por sala). Sem espaço, não há bolha.
 *  - Gems imperiais poofadas voltam ao censo ao reformar (a não ser que os rebeldes
 *    controlem o campo e estilhacem parte delas).
 *  - Rebeldes poofados após uma vitória imperial ficam à espera da decisão da jogadora;
 *    sem decisão, reformam e voltam aos rebeldes.
 *  - Prisioneiras embolhadas: anistia (voltam ao censo), troca em negociação
 *    (voltam aos rebeldes) ou estilhaçamento. As Diamantes reagem.
 * Estado por planeta em planet.gemFate = {poofed:[], bubbles:{}}; totais em state.gemFateStats.
 * ========================================================================= */
(function(){
    'use strict';
    const SOLDIERS=['quartz','ruby','topaz','agate','nephrite'],TECH=['peridot','bismuth','lapis','obsidian','snowflake_obsidian','demantoid','pearl'];
    const ORIGIN_LABEL={rebel:'Prisioneira rebelde',leader:'Líder rebelde',offcolor:'Off-color',empire:'Gem imperial'};
    const BUBBLE_CAPACITY=40;
    const TONE={militarist:'harsh',isolationist:'harsh',manipulator:'harsh',melancholic:'gentle',empathic:'gentle',naturalist:'gentle',technocrat:'cerebral',scholar:'cerebral',reformer:'cerebral',visionary:'grand',artist:'grand',hedonist:'grand'};
    const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
    const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
    const esc=s=>typeof escapeHTML==='function'?escapeHTML(String(s??'')):String(s??'');
    const dur=s=>typeof formatDuration==='function'?formatDuration(s):Math.ceil(s)+'s';
    const label=c=>c==='diamond'?'Diamante':(FOUNDING_GEM_DATA?.[c]?.label||c);
    const activeId=()=>state.activeColonyPlanetId||'homeworld';
    function notify(t,e){if(typeof setStatusTicker==='function')setStatusTicker(t,!!e);}
    function chronicle(t,d,i){if(typeof addChronicle==='function')addChronicle(t,d,i);}
    function censusOf(p){return p.id===activeId()?(state.census||(state.census={})):(ensurePlanetEconomy(p,false).census||{});}
    function setCensus(p,c){if(p.id===activeId())state.census=c;else ensurePlanetEconomy(p,false).census=c;}
    function structuresOf(p){return p.id===activeId()?(state.structures||{}):(ensurePlanetEconomy(p,false).structures||{});}
    function fate(p){const f=p.gemFate=p.gemFate&&typeof p.gemFate==='object'?p.gemFate:{};f.poofed=Array.isArray(f.poofed)?f.poofed:[];f.bubbles=f.bubbles&&typeof f.bubbles==='object'?f.bubbles:{};f.nextId=Number(f.nextId)||1;return f;}
    function stats(){const s=state.gemFateStats=state.gemFateStats&&typeof state.gemFateStats==='object'?state.gemFateStats:{};['poofed','reformed','bubbled','shattered','released'].forEach(k=>s[k]=Math.max(0,Number(s[k])||0));return s;}
    function reformTime(caste,off){const base=SOLDIERS.includes(caste)?60+Math.random()*60:TECH.includes(caste)?150+Math.random()*90:240+Math.random()*120;return Math.round(base*(off?1.4:1));}
    function capacity(p){return Math.max(0,Math.floor(Number(structuresOf(p).bubble_room)||0))*BUBBLE_CAPACITY;}
    function bubbledCount(p){return Object.values(fate(p).bubbles).reduce((a,b)=>a+(Number(b)||0),0);}
    function freeSpace(p){return Math.max(0,capacity(p)-bubbledCount(p));}
    const bkey=(caste,origin,off,defect)=>[caste,origin,off?1:0,defect||''].join('|');
    const parseKey=k=>{const [caste,origin,off,defect]=k.split('|');return {caste,origin,off:off==='1',defect:defect||null};};
    function courtReact(perGemGentle,perGemHarsh,n){(state.matriarchs||[]).forEach(m=>{const t=TONE[m.personalityId]||'grand';const d=t==='gentle'?Math.max(-6,perGemGentle*n):t==='harsh'?Math.min(3,perGemHarsh*n):0;if(d)m.loyalty=clamp((Number(m.loyalty)||0)+d);});}
    function offApi(){return window.GempireOffColors;}
    function resApi(){return window.GempireResistance;}

    // Gems imperiais poofadas: saem do censo até se reformarem.
    function poof(p,caste,n,opts={}){
        n=Math.max(0,Math.floor(n));if(!p||!n)return 0;
        const f=fate(p),census=Object.assign({},censusOf(p));
        n=Math.min(n,Math.max(0,Math.floor(Number(census[caste])||0)));if(!n)return 0;
        census[caste]=Math.max(0,(Number(census[caste])||0)-n);setCensus(p,census);
        for(let i=(p.walkingGems||[]).length-1,k=n;i>=0&&k>0;i--){const g=p.walkingGems[i];if(g&&(g.caste||g.type)===caste&&(!!opts.off)===(g.grade==='D')){p.walkingGems.splice(i,1);k--;}}
        const t=reformTime(caste,opts.off);
        f.poofed.push({id:f.nextId++,caste,n,off:!!opts.off,owner:'empire',remaining:t,total:t,reason:opts.reason||'',enemyField:!!opts.enemyField});
        stats().poofed+=n;
        if(offApi())offApi().sync(p);
        return n;
    }
    // Rebeldes poofados numa vitória imperial: aguardam decisão.
    function poofRebels(p,byKey,reason){
        const f=fate(p);let total=0;
        Object.entries(byKey).forEach(([k,n])=>{if(!n)return;const [caste,off]=k.split('|');const t=reformTime(caste,!!off);f.poofed.push({id:f.nextId++,caste,n,off:!!off,owner:'rebels',pending:true,remaining:t,total:t,reason:reason||'',leader:k.endsWith('|leader')});total+=n;});
        stats().poofed+=total;return total;
    }
    // Quando os rebeldes vencem, estilhaçam parte das gems imperiais caídas.
    function enemyShatter(p,fraction,reason){
        const f=fate(p);let lost=0;
        f.poofed.filter(g=>g.owner==='empire'&&g.enemyField).forEach(g=>{const k=Math.round(g.n*fraction);if(k>0){g.n-=k;lost+=k;}g.enemyField=false;});
        f.poofed=f.poofed.filter(g=>g.n>0);
        if(lost){stats().shattered+=lost;courtReact(-.3,0,lost);chronicle('Gems estilhaçadas em '+p.shortName,lost+' Gem(s) imperiais caídas foram estilhaçadas pelos rebeldes.',reason||'Perda permanente');}
        return lost;
    }
    function bubble(p,caste,n,origin,off,defect){
        n=Math.min(n,freeSpace(p));if(n<=0)return 0;const f=fate(p),k=bkey(caste,origin,off,defect);f.bubbles[k]=(f.bubbles[k]||0)+n;stats().bubbled+=n;return n;
    }
    // Decisão sobre rebeldes caídos.
    function decide(planetId,groupId,action){
        const p=PLANETS[planetId];if(!p)return;const f=fate(p),g=f.poofed.find(x=>x.id===groupId);if(!g||g.owner!=='rebels')return;
        if(action==='bubble'){const n=bubble(p,g.caste,g.n,g.leader?'leader':'rebel',g.off,null);if(!n){notify('A Sala das Bolhas de '+p.shortName+' está cheia ou não existe.',true);return;}g.n-=n;notify(n+' gema(s) rebelde(s) embolhada(s) como prisioneiras.');courtReact(.1,.1,0);}
        else if(action==='shatter'){stats().shattered+=g.n;courtReact(-.5,.2,g.n);chronicle('Rebeldes estilhaçadas em '+p.shortName,g.n+' gema(s) rebelde(s) foram estilhaçadas.','Perda permanente');
            const r=p.resistance;if(r){p.dissent=Math.min(100,(Number(p.dissent)||0)+g.n*1.5);}g.n=0;notify('Gemas rebeldes estilhaçadas. A colônia reage.',true);}
        else if(action==='reform'){g.pending=false;}
        f.poofed=f.poofed.filter(x=>x.n>0);refresh();
    }
    // Bolhas: soltar (anistia), trocar com os rebeldes ou estilhaçar.
    function releaseBubble(planetId,key,mode){
        const p=PLANETS[planetId];if(!p)return;const f=fate(p),n=Number(f.bubbles[key])||0;if(!n)return;const b=parseKey(key);
        delete f.bubbles[key];
        if(mode==='shatter'){stats().shattered+=n;courtReact(-.5,.2,n);p.dissent=Math.min(100,(Number(p.dissent)||0)+n*(b.origin==='offcolor'?.8:1.2));chronicle('Bolhas estilhaçadas em '+p.shortName,n+' '+label(b.caste)+' ('+ORIGIN_LABEL[b.origin]+') estilhaçada(s).','Perda permanente');notify(n+' gema(s) embolhada(s) estilhaçada(s).',true);}
        else if(mode==='rebels'){const r=resApi()&&resApi()._res(p);if(r){const k=b.caste+(b.off?'|off':'');r.memberCastes[k]=(r.memberCastes[k]||0)+n;r.members+=n;}stats().released+=n;}
        else{
            // Anistia: a gema é solta da bolha, se reforma e volta ao censo.
            const census=Object.assign({},censusOf(p));census[b.caste]=(Number(census[b.caste])||0)+n;setCensus(p,census);
            if(b.off&&offApi())offApi().addVisible(p,b.caste,b.defect||'color',n);
            stats().released+=n;courtReact(.3,-.2,n);p.dissent=Math.max(0,(Number(p.dissent)||0)-n*.8);
            if(b.origin==='rebel'||b.origin==='leader'){const r=resApi()&&resApi()._res(p);if(r){r.strength=clamp(r.strength-n*.5);r.lastAmnestyAt=Date.now();}}
            chronicle('Bolhas libertadas em '+p.shortName,n+' '+label(b.caste)+' foram libertadas e voltaram ao censo.','Anistia');notify(n+' gema(s) libertada(s) das bolhas.');
        }
        refresh();
    }
    function prisoners(p){return Object.entries(fate(p).bubbles).filter(([k])=>{const o=parseKey(k).origin;return o==='rebel'||o==='leader';}).reduce((a,[,n])=>a+n,0);}
    function releasePrisonersToRebels(p){Object.keys(fate(p).bubbles).forEach(k=>{const o=parseKey(k).origin;if(o==='rebel'||o==='leader')releaseBubble(p.id,k,'rebels');});}

    // Reformas.
    let acc=0;
    function update(dt){
        if(!state||!state.firstGameStarted)return;acc+=Math.max(0,Math.min(5,Number(dt)||0));if(acc<2)return;const step=acc;acc=0;
        Object.values(PLANETS).forEach(p=>{
            if(!p||!p.gemFate||!p.gemFate.poofed.length)return;const f=fate(p);
            f.poofed.forEach(g=>{g.remaining-=step;if(g.remaining>0)return;
                if(g.owner==='empire'){const census=Object.assign({},censusOf(p));census[g.caste]=(Number(census[g.caste])||0)+g.n;setCensus(p,census);if(g.off&&offApi())offApi().addVisible(p,g.caste,'color',g.n);stats().reformed+=g.n;}
                else{const r=resApi()&&resApi()._res(p);if(r){const k=g.caste+(g.off?'|off':'');r.memberCastes[k]=(r.memberCastes[k]||0)+g.n;r.members+=g.n;}stats().reformed+=g.n;if(g.pending)notify(g.n+' rebelde(s) caída(s) em '+p.shortName+' se reformaram e voltaram à resistência.',true);}
                g.n=0;});
            f.poofed=f.poofed.filter(g=>g.n>0);
        });
    }
    function refresh(){try{updateHUD();}catch(e){}try{renderDrawerContent();}catch(e){}if(state.currentScreen==='governance'&&state.governanceSection==='order'){const el=document.getElementById('governance-content');if(el&&window.renderOrderTab)window.renderOrderTab(el);}}

    // Interface (bloco por colônia na Ordem Pública).
    function render(p){
        const f=fate(p),cap=capacity(p),used=bubbledCount(p);
        if(!f.poofed.length&&!used&&!cap)return '<small style="display:block;color:var(--text-muted);margin-top:6px">Sem Sala das Bolhas: gems caídas não podem ser embolhadas nesta colônia.</small>';
        let h='<div class="gemfate"><div class="court-subtitle">Gemas caídas e bolhas</div>';
        h+='<small style="display:block;color:var(--text-muted)">Sala das Bolhas: '+fmt(used)+' / '+fmt(cap)+' bolhas'+(cap?'':' (construa uma para embolhar)')+'</small>';
        f.poofed.forEach(g=>{
            const pct=Math.max(0,100-g.remaining/g.total*100);
            h+='<div class="stat-box"><div class="court-row"><b>'+fmt(g.n)+' '+esc(label(g.caste))+(g.off?' off-color':'')+(g.owner==='rebels'?(g.leader?' · líder rebelde':' · rebelde(s)'):' · imperial(is)')+'</b><small>reforma em '+dur(g.remaining)+'</small></div><div class="founding-progress"><div style="width:'+pct+'%"></div></div>';
            if(g.owner==='rebels'&&g.pending)h+='<small style="display:block;color:var(--text-muted)">Gemas caídas e vulneráveis. Sem decisão, se reformam e voltam aos rebeldes.</small><div class="court-actions"><button class="btn btn-emerald" '+(freeSpace(p)?'':'disabled')+' onclick="GempireGemFate.decide(\''+p.id+'\','+g.id+',\'bubble\')">Embolhar como prisioneiras</button><button class="btn btn-pink" onclick="GempireGemFate.decide(\''+p.id+'\','+g.id+',\'shatter\')">Estilhaçar</button><button class="btn" onclick="GempireGemFate.decide(\''+p.id+'\','+g.id+',\'reform\')">Deixar reformar</button></div>';
            else if(g.owner==='empire')h+='<small style="display:block;color:var(--text-muted)">'+(g.reason?esc(g.reason)+' · ':'')+'fora de ação até se reformar.</small>';
            h+='</div>';
        });
        Object.entries(f.bubbles).forEach(([k,n])=>{const b=parseKey(k);const isPrisoner=b.origin==='rebel'||b.origin==='leader';
            h+='<div class="stat-box gemfate-bubble"><div class="court-row"><b>'+fmt(n)+' '+esc(label(b.caste))+(b.off?' off-color':'')+'</b><small>'+esc(ORIGIN_LABEL[b.origin]||b.origin)+' · em bolha</small></div><div class="court-actions">'+
                '<button class="btn btn-emerald" onclick="GempireGemFate.release(\''+p.id+'\',\''+k+'\',\'free\')">'+(isPrisoner?'Anistia (libertar no censo)':'Libertar')+'</button>'+
                '<button class="btn btn-pink" onclick="GempireGemFate.release(\''+p.id+'\',\''+k+'\',\'shatter\')">Estilhaçar</button></div></div>';});
        return h+'</div>';
    }
    window.GempireGemFate={poof,poofRebels,enemyShatter,bubble,decide,release:releaseBubble,prisoners,releasePrisonersToRebels,capacity,freeSpace,update,render,reformTime,stats,_fate:fate};
})();
