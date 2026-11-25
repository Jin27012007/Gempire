/* =========================================================================
 * GEMPIRE · Cutscene de abertura (nova partida)
 *
 *  1. No vazio, um planetoide racha e explode; o núcleo brilha na cor da fundadora.
 *  2. Uma luz escapa dos destroços e dispara como um cometa; a câmera acompanha
 *     o voo pelo sistema (estrelas passando) até o planeta natal surgir por baixo.
 *  3. O cometa desce e atinge o planeta: clarão, onda de choque e coluna de luz.
 *  4. A luz se condensa na forma da Primeira Diamante e a partida começa.
 *
 * As texturas do planetoide são preparadas aos poucos enquanto o editor da
 * fundadora está aberto (prepare); a do planeta natal é gerada sob o clarão da
 * explosão, quando um engasgo não aparece. A cena começa sem tela preta.
 * Pode ser pulada (botão, Esc, Enter ou Espaço). Enquanto toca, o jogo fica parado.
 * ========================================================================= */
(function(){
    'use strict';
    const TAU=Math.PI*2;
    const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const easeIn=t=>t*t*t;
    const easeOut=t=>1-Math.pow(1-t,3);
    const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const seg=(t,a,b)=>clamp((t-a)/(b-a));
    function rgb(hex){const s=String(hex||'#fff').replace('#','');const n=parseInt(s.length===3?s.split('').map(c=>c+c).join(''):s,16);return [(n>>16)&255,(n>>8)&255,n&255];}
    const rgba=(c,a)=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
    const lighten=(c,k)=>c.map(v=>Math.round(v+(255-v)*k));
    const END=15.4;
    const CORE='#fff1d2'; // cor fixa das fissuras: permite preparar as texturas antes de saber a cor da fundadora

    // Planetoide desta sessão e preparo antecipado das texturas.
    const ROCK_SEED=(Date.now()^0x5bd1e995)>>>0;
    const ROCK={id:'intro_planetoid_'+ROCK_SEED,seed:ROCK_SEED,topology:'fragmented',biome:'rocky',landCoverage:.95,waterKind:'water',features:[]};
    // Planeta natal da cena: mesmo estilo de Homeworld (rochoso, sem oceanos), preparado antes da partida existir.
    const HOME={id:'intro_home_'+ROCK_SEED,seed:(ROCK_SEED+7919)>>>0,topology:'superterrestrial',biome:'rocky',landCoverage:.96,waterKind:'none',features:[]};
    // Tamanhos usados na tela atual (o renderizador guarda um buffer por tamanho).
    const sizes=()=>{const W=window.innerWidth,H=window.innerHeight;return {R1:Math.min(W,H)*.2,PR:Math.max(W*.62,H*.95)};};
    const STEPS=[{stage:0},{stage:1},{stage:2},{stage:3},{stage:4},{stage:4,shattered:true,shatterProgress:1,big:'R1'},{home:true}];
    const DAMAGES=STEPS;
    let prepared=0,preparing=false;
    function warmOne(i){const P=window.GempirePlanetArt;if(!P||!P.drawPlanet)return;const st=STEPS[i];if(!st)return;const c=document.createElement('canvas').getContext('2d'),z=sizes();
        try{
            if(st.home)P.drawPlanet(c,{cx:0,cy:0,radius:z.PR,surface:HOME,rotation:.4,time:0,maxResolution:512});
            else{const d=Object.assign({coreColor:CORE},st);delete d.big;P.drawPlanet(c,{cx:0,cy:0,radius:st.big?z.R1:z.R1,surface:ROCK,rotation:0,time:0,damage:d});}
        }catch(e){}}
    function prepare(){
        if(preparing||prepared>=DAMAGES.length)return;preparing=true;
        const step=()=>{if(prepared>=STEPS.length){preparing=false;return;}warmOne(prepared++);setTimeout(step,150);};
        setTimeout(step,250);
    }
    function warmAllNow(){while(prepared<DAMAGES.length)warmOne(prepared++);}
    // Para a tela de carregamento: prepara um passo e devolve quantos faltam.
    function warmStep(){if(prepared<STEPS.length)warmOne(prepared++);return STEPS.length-prepared;}
    // Mudou a qualidade: as texturas antigas foram descartadas.
    window.addEventListener('gempire-quality',()=>{prepared=0;preparing=false;});

    let api=null;
    function play(o){
        if(document.getElementById('intro-cutscene'))return;
        o=o||{};
        const col=rgb(o.color||'#f8fafc'),hot=lighten(col,.6),coreHex='#'+col.map(v=>v.toString(16).padStart(2,'0')).join('');
        const root=document.createElement('div');root.id='intro-cutscene';
        root.innerHTML='<canvas></canvas><div class="intro-caption"><span></span><small></small></div><button type="button" class="intro-skip">Pular ▸</button>';
        document.body.appendChild(root);
        window.GEMPIRE_CUTSCENE=true;
        const cv=root.querySelector('canvas'),ctx=cv.getContext('2d'),cap=root.querySelector('.intro-caption'),capMain=cap.querySelector('span'),capSub=cap.querySelector('small');
        let W=0,H=0;
        function resize(){const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));W=window.innerWidth;H=window.innerHeight;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);diamond=null;}
        let diamond=null;
        resize();window.addEventListener('resize',resize);
        const R=(()=>{let v=ROCK_SEED;return ()=>{v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();
        const stars=Array.from({length:340},()=>({x:R(),y:R(),z:.2+R()*.8,a:.3+R()*.7,tw:R()*TAU}));
        const home=HOME;
        const P=window.GempirePlanetArt;
        let homeReady=prepared>=STEPS.length;
        function warmHome(){if(homeReady)return;homeReady=true;warmAllNow();}

        // Silhueta da Diamante escolhida (cores e modelo da criação), com versão branca para a condensação.
        function buildDiamond(){
            const h=Math.round(Math.min(H*.52,W*.9)),scale=h/358,w=Math.round(h*.72);
            const a=document.createElement('canvas');a.width=w;a.height=h;const ac=a.getContext('2d');
            let ok=false;
            try{if(typeof drawDiamondVitral==='function'){drawDiamondVitral(ac,w/2,h*.474,scale,o.style||'regal',o.colors||[coreHex],o.gemPos||'chest',o.gemCut||'lozenge',o.gemSize||'medium');ok=ac.getImageData(0,0,w,h).data.some((v,i)=>i%4===3&&v>0);}}catch(e){ok=false;}
            if(!ok){ac.clearRect(0,0,w,h);ac.translate(w/2,h*.5);const s=h*.32;ac.beginPath();ac.moveTo(0,-s);ac.lineTo(s*.62,0);ac.lineTo(0,s);ac.lineTo(-s*.62,0);ac.closePath();const g=ac.createLinearGradient(-s,-s,s,s);g.addColorStop(0,'#fff');g.addColorStop(.4,coreHex);g.addColorStop(1,rgba(col.map(v=>v*.4|0),1));ac.fillStyle=g;ac.fill();ac.lineWidth=4;ac.strokeStyle='rgba(255,255,255,.8)';ac.stroke();ac.setTransform(1,0,0,1,0,0);}
            const b=document.createElement('canvas');b.width=w;b.height=h;const bc=b.getContext('2d');bc.drawImage(a,0,0);bc.globalCompositeOperation='source-in';bc.fillStyle='#fff';bc.fillRect(0,0,w,h);
            diamond={img:a,white:b,w,h};
        }

        // Partículas
        const sparks=[];
        function burst(x,y,n,speed,colA,life){for(let i=0;i<n;i++){const a=R()*TAU,v=speed*(.3+R()*.9);sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:life*(.5+R()*.8),age:0,c:R()<.6?colA:[255,255,255],s:1+R()*2.5,rock:R()<.25});}}
        function stepSparks(dt){for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;if(p.age>p.life)sparks.splice(i,1);}}
        function drawSparks(){sparks.forEach(p=>{const a=1-p.age/p.life;ctx.globalAlpha=a;if(p.rock){ctx.fillStyle='#5b4a7a';ctx.fillRect(p.x-p.s,p.y-p.s,p.s*2,p.s*2);}else{ctx.fillStyle=rgba(p.c,1);ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,TAU);ctx.fill();}});ctx.globalAlpha=1;}

        // Fundo: estrelas com deslocamento horizontal (câmera acompanhando o cometa).
        let scroll=0;
        function background(t,streak){
            const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#150a2c');g.addColorStop(.6,'#0b0519');g.addColorStop(1,'#05020d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
            const n=ctx.createRadialGradient(W*.7,H*.3,10,W*.7,H*.3,Math.max(W,H)*.7);n.addColorStop(0,'rgba(120,60,200,.22)');n.addColorStop(1,'rgba(120,60,200,0)');ctx.fillStyle=n;ctx.fillRect(0,0,W,H);
            stars.forEach(s=>{
                const x=((s.x*W-scroll*s.z)%W+W)%W,y=s.y*H;
                if(streak>.02){ctx.strokeStyle='rgba(230,220,255,'+(s.a*.75)+')';ctx.lineWidth=s.z*1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+streak*s.z*W*.08,y);ctx.stroke();return;}
                ctx.globalAlpha=s.a*(.6+.4*Math.sin(t*2+s.tw));ctx.fillStyle='#f3ecff';ctx.fillRect(x,y,s.z*1.6,s.z*1.6);
            });
            ctx.globalAlpha=1;
        }
        function glow(x,y,r,c,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba([255,255,255],a));g.addColorStop(.25,rgba(c,a*.85));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
        function flare(x,y,r,a,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);ctx.globalAlpha=a;ctx.fillStyle='#fff';for(let k=0;k<2;k++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(0,-r*.06);ctx.lineTo(r,0);ctx.lineTo(0,r*.06);ctx.closePath();ctx.fill();}ctx.restore();ctx.globalAlpha=1;}
        // Rastro do cometa a partir das posições realmente percorridas.
        const trail=[];
        function pushTrail(x,y){trail.unshift([x,y]);if(trail.length>34)trail.length=34;}
        function drawComet(headR,offset){
            if(!trail.length)return;const ox=offset?offset[0]:0,oy=offset?offset[1]:0;
            for(let i=trail.length-1;i>0;i--){const a=trail[i],b=trail[i-1],k=1-i/trail.length;ctx.strokeStyle=rgba(i<4?hot:col,k*.9);ctx.lineWidth=headR*1.7*k+1;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a[0]+ox*i,a[1]+oy*i);ctx.lineTo(b[0]+ox*(i-1),b[1]+oy*(i-1));ctx.stroke();}
            const h=trail[0];glow(h[0],h[1],headR*5,col,.9);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h[0],h[1],headR,0,TAU);ctx.fill();
        }
        function setCaption(main,sub,vis){if(capMain.textContent!==main)capMain.textContent=main;if(capSub.textContent!==(sub||''))capSub.textContent=sub||'';cap.style.opacity=vis;}
        // Tremor suave (sem saltos aleatórios por quadro).
        function shakeAt(t,amp){return [amp*(Math.sin(t*41)+Math.sin(t*67+1.3))*.5,amp*(Math.sin(t*53+.7)+Math.sin(t*29+2.1))*.5];}

        let start=0,last=0,raf=0;const flags={};
        const name=o.name||'A Primeira Diamante',world=o.homeworld||'Homeworld';
        function frame(ts){
            if(!start){start=ts;last=ts;}
            const t=(ts-start)/1000,dt=Math.min(.05,(ts-last)/1000);last=ts;
            stepSparks(dt);
            const cx=W/2,cy=H*.46,R1=Math.min(W,H)*.2;
            // Planeta natal: posição final comum às cenas 2 e 3.
            const PR=Math.max(W*.62,H*.95),pcx=W*.5,pyFinal=H*.68+PR,ia=-Math.PI/2+.04,impact=[pcx+Math.cos(ia)*PR,pyFinal+Math.sin(ia)*PR];
            let amp=0;
            ctx.save();
            if(t<6.2){
                // ---------- Cena 1: o planetoide
                if(t>2.0&&t<3.5)amp=1.5+5*seg(t,2,3.4);
                if(t>=3.5&&t<4.4)amp=9*(1-seg(t,3.5,4.4));
                const [sx,sy]=shakeAt(t,amp);ctx.translate(sx,sy);
                background(t,0);
                const zoom=1+.06*easeInOut(seg(t,0,3.5));
                const crack=t<1.5?0:Math.min(4,Math.floor((t-1.5)/.45)+1),shat=t>=3.5,amt=shat?Math.max(.05,easeOut(seg(t,3.5,6))):0;
                if(!shat&&prepared<STEPS.length-1&&t>1.2)while(prepared<STEPS.length-1)warmOne(prepared++);
                if(P&&P.drawPlanet)P.drawPlanet(ctx,{cx,cy,radius:R1*zoom,surface:ROCK,rotation:t*.12,time:t*1000,atmosphere:'#7c5cc4',damage:{stage:crack,shattered:shat,shatterProgress:amt,coreColor:CORE}});
                if(crack&&!shat)glow(cx,cy,R1*(1.1+crack*.12),col,.12*crack);
                if(shat&&!flags.boom){flags.boom=true;burst(cx,cy,220,R1*3.2,col,2.4);}
                if(shat){const k=seg(t,3.5,5.1);ctx.strokeStyle=rgba(hot,.7*(1-k));ctx.lineWidth=6*(1-k)+1;ctx.beginPath();ctx.ellipse(cx,cy,R1*(1+k*4),R1*(1+k*4)*.85,0,0,TAU);ctx.stroke();}
                // Sob o clarão: gera a textura do planeta natal sem engasgo visível.
                if(t>3.55&&!homeReady)warmHome();
                // A luz se forma no núcleo e dispara para a direita.
                if(t>4.2){const g=seg(t,4.2,5.1),go=easeIn(seg(t,5.1,6.2));
                    const hx=cx+(W*.62)*go,hy=cy-(H*.18)*go*go;
                    if(go>0){pushTrail(hx,hy);drawComet(4+6*g);}
                    else{glow(hx,hy,R1*(.3+.9*g),col,.9);flare(hx,hy,R1*(.6+1.4*g),.85*g,t*.6);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,hy,3+5*g,0,TAU);ctx.fill();}}
                drawSparks();
                if(t>=3.5&&t<4.2){ctx.fillStyle='rgba(255,255,255,'+(1-seg(t,3.5,4.2))+')';ctx.fillRect(-30,-30,W+60,H+60);}
                if(t<3.4)setCaption('No vazio, um planetoide guarda uma luz que ainda não tem forma.','',clamp(seg(t,.4,1.1)*(1-seg(t,3,3.35))));
                else setCaption('Ele se parte. A luz escapa.','',clamp(seg(t,4.1,4.6)*(1-seg(t,5.7,6.1))));
            }else if(t<9.7){
                // ---------- Cena 2: a câmera acompanha o cometa até o planeta natal
                if(!flags.s2){flags.s2=true;trail.length=0;}
                const travel=seg(t,6.2,8.0),slow=seg(t,7.6,9.0);
                const streak=Math.sin(Math.min(1,travel*1.15)*Math.PI*.5)*(1-slow);
                scroll+=dt*W*(.2+2.6*streak);
                if(t>9.45)amp=8*seg(t,9.45,9.7);
                const [sx,sy]=shakeAt(t,amp);ctx.translate(sx,sy);
                background(t,streak);
                const rise=easeOut(seg(t,7.2,8.8)),pcy=pyFinal+H*.65*(1-rise);
                if(rise>0&&P&&P.drawPlanet)P.drawPlanet(ctx,{cx:pcx,cy:pcy,radius:PR,surface:home,rotation:.4+t*.015,time:t*1000,atmosphere:'#c9a6ff',maxResolution:512});
                // Cometa: entra pela esquerda, cruza devagar e mergulha até o ponto de impacto.
                const cruise=[W*(.18+.16*easeOut(seg(t,6.2,8.2))),H*(.36+Math.sin(t*1.7)*.012)];
                const dive=easeIn(seg(t,8.3,9.7));
                const ctrl=[W*.62,H*.2];
                const u=dive,v=1-u,hx=v*v*cruise[0]+2*v*u*ctrl[0]+u*u*impact[0],hy=v*v*cruise[1]+2*v*u*ctrl[1]+u*u*impact[1];
                pushTrail(hx,hy);
                // Durante o cruzeiro, o rastro se estende para trás (as estrelas correm, o cometa fica).
                drawComet(5+5*dive,dive<.05?[-W*.006*(.3+streak),0]:null);
                if(dive>.6){ctx.strokeStyle=rgba(hot,.25*(dive-.6)/.4);ctx.lineWidth=2;ctx.beginPath();ctx.arc(hx,hy,18+(1-dive)*40,0,TAU);ctx.stroke();}
                drawSparks();
                if(t<6.55){ctx.fillStyle='rgba(5,2,13,'+(1-seg(t,6.2,6.55))+')';ctx.fillRect(-30,-30,W+60,H+60);}
                setCaption('Um cometa de luz cruza o sistema em direção a '+world+'.','',clamp(seg(t,6.8,7.4)*(1-seg(t,9.1,9.5))));
            }else{
                // ---------- Cena 3: impacto, coluna de luz e a forma da Diamante
                if(!flags.impact){flags.impact=true;burst(impact[0],impact[1],160,PR*.9,col,1.8);}
                if(t<10.6)amp=12*(1-seg(t,9.7,10.6));
                const [sx,sy]=shakeAt(t,amp);ctx.translate(sx,sy);
                scroll+=dt*W*.05;background(t,0);
                if(P&&P.drawPlanet)P.drawPlanet(ctx,{cx:pcx,cy:pyFinal,radius:PR,surface:home,rotation:.4+t*.015,time:t*1000,atmosphere:'#c9a6ff',maxResolution:512});
                const k=seg(t,9.7,11.7);ctx.strokeStyle=rgba(hot,.8*(1-k));ctx.lineWidth=5*(1-k)+1;ctx.beginPath();ctx.ellipse(impact[0],impact[1],PR*.05+k*PR*.7,(PR*.05+k*PR*.7)*.18,0,0,TAU);ctx.stroke();
                glow(impact[0],impact[1],PR*.25*(1-k*.6),col,.8*(1-k*.5));
                const pill=1-seg(t,11.5,13.1),pw=(60+80*(1-seg(t,9.7,11.5)))*Math.max(.15,pill);
                if(pill>0){const g=ctx.createLinearGradient(impact[0]-pw,0,impact[0]+pw,0);g.addColorStop(0,rgba(col,0));g.addColorStop(.5,rgba([255,255,255],.9*pill));g.addColorStop(1,rgba(col,0));ctx.fillStyle=g;ctx.fillRect(impact[0]-pw,-30,pw*2,impact[1]+30);}
                if(!diamond)buildDiamond();
                const f=seg(t,11.1,13.3),colorIn=seg(t,12.5,14.1);
                if(f>0&&diamond){
                    const sc=.35+.65*easeOut(f),dw=diamond.w*sc,dh=diamond.h*sc,dx=impact[0]-dw/2,dy=impact[1]-dh*.98-(1-easeOut(f))*H*.05;
                    glow(impact[0],dy+dh*.45,dh*.7,col,.45*f);
                    ctx.globalAlpha=f*colorIn;ctx.drawImage(diamond.img,dx,dy,dw,dh);
                    ctx.globalAlpha=f*(1-colorIn);ctx.drawImage(diamond.white,dx,dy,dw,dh);ctx.globalAlpha=1;
                    if(t<13.3)for(let i=0;i<10;i++){const a=t*3+i*TAU/10,r=(1-f)*dh*.8+20;ctx.fillStyle=rgba(i%2?hot:col,.9);ctx.beginPath();ctx.arc(impact[0]+Math.cos(a)*r,dy+dh*.45+Math.sin(a)*r*.5,2.2,0,TAU);ctx.fill();}
                }
                drawSparks();
                if(t<10.2){ctx.fillStyle='rgba(255,255,255,'+(1-seg(t,9.7,10.2))+')';ctx.fillRect(-30,-30,W+60,H+60);}
                setCaption(name+' desperta.','A Primeira Diamante de '+world+'.',clamp(seg(t,12.7,13.4)*(1-seg(t,14.8,15.2))));
            }
            ctx.restore();
            // Entrada curta (sem tela preta longa) e saída.
            const fadeIn=1-seg(t,0,.35),fadeOut=seg(t,14.6,END);
            if(fadeIn>0||fadeOut>0){ctx.fillStyle='rgba(5,2,13,'+Math.max(fadeIn,fadeOut)+')';ctx.fillRect(0,0,W,H);}
            if(t>=END){finish();return;}
            raf=requestAnimationFrame(frame);
        }
        let done=false;
        function finish(){
            if(done)return;done=true;cancelAnimationFrame(raf);
            window.removeEventListener('resize',resize);window.removeEventListener('keydown',onKey,true);
            root.classList.add('intro-out');window.GEMPIRE_CUTSCENE=false;
            setTimeout(()=>root.remove(),600);
            try{if(typeof o.onEnd==='function')o.onEnd();}catch(e){console.error(e);}
        }
        function onKey(e){if(['Escape','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();finish();}}
        window.addEventListener('keydown',onKey,true);
        root.querySelector('.intro-skip').addEventListener('click',e=>{e.stopPropagation();finish();});
        // Primeiro quadro imediato com estrelas; a textura base do planetoide já está pronta se o editor ficou aberto.
        // Se o preparo não terminou no editor, conclui agora com um quadro parado de estrelas
        // (uma pausa curta antes do movimento é menos perceptível que um travamento no meio da cena).
        ctx.fillStyle='#0b0519';ctx.fillRect(0,0,W,H);background(0,0);
        if(prepared<STEPS.length){setTimeout(()=>{warmAllNow();homeReady=true;raf=requestAnimationFrame(frame);},30);}
        else raf=requestAnimationFrame(frame);
        api.skip=finish;
    }
    api={play,prepare,warmStep,remaining:()=>STEPS.length-prepared,skip(){}};
    window.GempireIntro=api;
})();
