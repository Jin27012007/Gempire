/* =========================================================================
 * GEMPIRE · Cutscene de abertura (nova partida)
 *
 *  1. No vazio, um planetoide racha e explode; o núcleo brilha na cor da fundadora.
 *  2. Uma luz escapa dos destroços e dispara como um cometa pelo sistema.
 *  3. O cometa desce sobre o planeta natal e o atinge: clarão, onda de choque
 *     e uma coluna de luz.
 *  4. A luz se condensa na forma da Primeira Diamante (o modelo escolhido na
 *     criação) e a partida começa.
 * Pode ser pulada (botão, Esc, Enter ou Espaço). Enquanto toca, o jogo fica parado.
 * ========================================================================= */
(function(){
    'use strict';
    const TAU=Math.PI*2;
    const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
    const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const easeIn=t=>t*t*t;
    const easeOut=t=>1-Math.pow(1-t,3);
    const seg=(t,a,b)=>clamp((t-a)/(b-a));
    function rgb(hex){const s=String(hex||'#fff').replace('#','');const n=parseInt(s.length===3?s.split('').map(c=>c+c).join(''):s,16);return [(n>>16)&255,(n>>8)&255,n&255];}
    const rgba=(c,a)=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
    const lighten=(c,k)=>c.map(v=>Math.round(v+(255-v)*k));
    const END=15.6;

    function play(o){
        if(document.getElementById('intro-cutscene'))return;
        o=o||{};
        const col=rgb(o.color||'#f8fafc'),hot=lighten(col,.6);
        const root=document.createElement('div');root.id='intro-cutscene';
        root.innerHTML='<canvas></canvas><div class="intro-caption"><span></span><small></small></div><button type="button" class="intro-skip">Pular ▸</button>';
        document.body.appendChild(root);
        window.GEMPIRE_CUTSCENE=true;
        const cv=root.querySelector('canvas'),ctx=cv.getContext('2d'),cap=root.querySelector('.intro-caption'),capMain=cap.querySelector('span'),capSub=cap.querySelector('small');
        let W=0,H=0,dpr=1;
        function resize(){dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));W=window.innerWidth;H=window.innerHeight;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
        resize();window.addEventListener('resize',resize);
        const R=(()=>{let v=(Date.now()^0x9e3779b9)>>>0;return ()=>{v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();
        const stars=Array.from({length:320},()=>({x:R(),y:R(),z:.2+R()*.8,a:.3+R()*.7,tw:R()*TAU}));
        const seed=Math.floor(R()*1e9);
        const rock={id:'intro_planetoid_'+seed,seed,topology:'fragmented',biome:'rocky',landCoverage:.95,waterKind:'water',features:[]};
        const home=o.surface||{id:'intro_home_'+seed,seed:seed+7,topology:'continental',biome:'rocky',landCoverage:.6,waterKind:'water',features:[]};
        const P=window.GempirePlanetArt;
        const coreHex='#'+col.map(v=>v.toString(16).padStart(2,'0')).join('');
        // Pré-aquece as texturas para não engasgar no meio da cena.
        function prewarm(){
            if(!P||!P.drawPlanet)return;
            const c=document.createElement('canvas').getContext('2d');
            try{for(const st of [0,1,2,3,4])P.drawPlanet(c,{cx:40,cy:40,radius:36,surface:rock,rotation:0,time:0,damage:{stage:st,coreColor:coreHex}});
                P.drawPlanet(c,{cx:40,cy:40,radius:36,surface:rock,rotation:0,time:0,damage:{stage:4,shattered:true,shatterProgress:1,coreColor:coreHex}});
                P.drawPlanet(c,{cx:40,cy:40,radius:36,surface:home,rotation:0,time:0});}catch(e){console.warn('Cutscene: pré-aquecimento',e);}
        }
        // Silhueta da Diamante escolhida (cores e modelo da criação).
        let diamond=null;
        function buildDiamond(){
            const h=Math.round(Math.min(H*.56,W*.9)),scale=h/358,w=Math.round(h*.72);
            const a=document.createElement('canvas');a.width=w;a.height=h;const ac=a.getContext('2d');
            let ok=false;
            try{if(typeof drawDiamondVitral==='function'){drawDiamondVitral(ac,w/2,h*.474,scale,o.style||'regal',o.colors||[coreHex],o.gemPos||'chest',o.gemCut||'lozenge');ok=ac.getImageData(0,0,w,h).data.some((v,i)=>i%4===3&&v>0);}}catch(e){ok=false;}
            if(!ok){ac.clearRect(0,0,w,h);ac.translate(w/2,h*.5);const s=h*.32;ac.beginPath();ac.moveTo(0,-s);ac.lineTo(s*.62,0);ac.lineTo(0,s);ac.lineTo(-s*.62,0);ac.closePath();const g=ac.createLinearGradient(-s,-s,s,s);g.addColorStop(0,'#fff');g.addColorStop(.4,coreHex);g.addColorStop(1,rgba(col.map(v=>v*.4|0),1));ac.fillStyle=g;ac.fill();ac.lineWidth=4;ac.strokeStyle='rgba(255,255,255,.8)';ac.stroke();ac.setTransform(1,0,0,1,0,0);}
            const b=document.createElement('canvas');b.width=w;b.height=h;const bc=b.getContext('2d');bc.drawImage(a,0,0);bc.globalCompositeOperation='source-in';bc.fillStyle='#fff';bc.fillRect(0,0,w,h);
            diamond={img:a,white:b,w,h};
        }

        // Partículas
        const sparks=[];
        function burst(x,y,n,speed,colA,life){for(let i=0;i<n;i++){const a=R()*TAU,v=speed*(.3+R()*.9);sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:life*(.5+R()*.8),age:0,c:R()<.6?colA:[255,255,255],s:1+R()*2.5,rock:R()<.25});}}
        function stepSparks(dt){for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;if(p.age>p.life)sparks.splice(i,1);}}
        function drawSparks(){sparks.forEach(p=>{const a=1-p.age/p.life;ctx.globalAlpha=a;if(p.rock){ctx.fillStyle='#5b4a7a';ctx.fillRect(p.x-p.s,p.y-p.s,p.s*2,p.s*2);}else{ctx.fillStyle=rgba(p.c,1);ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,TAU);ctx.fill();}});ctx.globalAlpha=1;}

        function background(t,warp){
            const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#150a2c');g.addColorStop(.6,'#0b0519');g.addColorStop(1,'#05020d');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
            const n=ctx.createRadialGradient(W*.7,H*.3,10,W*.7,H*.3,Math.max(W,H)*.7);n.addColorStop(0,'rgba(120,60,200,.22)');n.addColorStop(1,'rgba(120,60,200,0)');ctx.fillStyle=n;ctx.fillRect(0,0,W,H);
            const cx=W/2,cy=H/2;
            stars.forEach(s=>{
                let x=s.x*W,y=s.y*H;
                if(warp>0){const dx=x-cx,dy=y-cy,k=1+warp*s.z*1.6;const x2=cx+dx*k,y2=cy+dy*k;ctx.strokeStyle='rgba(230,220,255,'+(s.a*.8)+')';ctx.lineWidth=s.z*1.4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();return;}
                ctx.globalAlpha=s.a*(.6+.4*Math.sin(t*2+s.tw));ctx.fillStyle='#f3ecff';ctx.fillRect(x,y,s.z*1.6,s.z*1.6);
            });
            ctx.globalAlpha=1;
        }
        function glow(x,y,r,c,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba([255,255,255],a));g.addColorStop(.25,rgba(c,a*.85));g.addColorStop(1,rgba(c,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
        function flare(x,y,r,a,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);ctx.globalAlpha=a;ctx.fillStyle='#fff';for(let k=0;k<2;k++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(0,-r*.06);ctx.lineTo(r,0);ctx.lineTo(0,r*.06);ctx.closePath();ctx.fill();}ctx.restore();ctx.globalAlpha=1;}
        // Trajetória do cometa até o planeta natal.
        function cometPath(u,impact){const p0=[W*1.1,-H*.12],p1=[W*.9,H*.02],p2=[impact[0]+W*.16,impact[1]-H*.32];const v=1-u;
            return [v*v*v*p0[0]+3*v*v*u*p1[0]+3*v*u*u*p2[0]+u*u*u*impact[0],v*v*v*p0[1]+3*v*v*u*p1[1]+3*v*u*u*p2[1]+u*u*u*impact[1]];}
        function drawComet(points,headR){
            for(let i=points.length-1;i>0;i--){const a=points[i],b=points[i-1],k=1-i/points.length;ctx.strokeStyle=rgba(i<4?hot:col,k*.9);ctx.lineWidth=headR*1.6*k+1;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}
            const h=points[0];glow(h[0],h[1],headR*5,col,.9);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(h[0],h[1],headR,0,TAU);ctx.fill();
        }
        function setCaption(main,sub,vis){if(capMain.textContent!==main)capMain.textContent=main;if(capSub.textContent!==(sub||''))capSub.textContent=sub||'';cap.style.opacity=vis;}

        let start=0,last=0,raf=0,flags={};
        const name=o.name||'A Primeira Diamante',world=o.homeworld||'Homeworld';
        function frame(ts){
            if(!start){start=ts;last=ts;}
            const t=(ts-start)/1000,dt=Math.min(.05,(ts-last)/1000);last=ts;
            stepSparks(dt);
            let shake=0;
            ctx.save();
            const cx=W/2,cy=H*.48,R1=Math.min(W,H)*.2;
            if(t<6.4){
                // Cena 1: o planetoide.
                const crack=t<1.6?0:Math.min(4,Math.floor((t-1.6)/.45)+1);
                if(t>2&&t<3.7)shake=2+6*seg(t,2,3.6);
                if(t>=3.6&&t<4.3)shake=10*(1-seg(t,3.6,4.3));
                ctx.translate((R()-.5)*shake,(R()-.5)*shake);
                background(t,0);
                const shat=t>=3.6,amt=shat?Math.max(.05,easeOut(seg(t,3.6,6))):0;
                if(P&&P.drawPlanet)P.drawPlanet(ctx,{cx,cy,radius:R1,surface:rock,rotation:t*.12,time:t*1000,atmosphere:'#7c5cc4',damage:{stage:crack,shattered:shat,shatterProgress:amt,coreColor:coreHex}});
                if(crack&&!shat)glow(cx,cy,R1*(1.1+crack*.12),col,.12*crack);
                if(shat&&!flags.boom){flags.boom=true;burst(cx,cy,220,R1*3.2,col,2.4);}
                if(shat){const k=seg(t,3.6,5.2);ctx.strokeStyle=rgba(hot,.7*(1-k));ctx.lineWidth=6*(1-k)+1;ctx.beginPath();ctx.ellipse(cx,cy,R1*(1+k*4),R1*(1+k*4)*.85,0,0,TAU);ctx.stroke();}
                // A luz se forma no núcleo exposto e dispara.
                if(t>4.3){const g=seg(t,4.3,5.5),go=seg(t,5.6,6.4);
                    const hx=cx+(W*.75)*easeIn(go),hy=cy-(H*.7)*easeIn(go);
                    if(go>0){const pts=[];for(let i=0;i<18;i++){const u=Math.max(0,go-i*.02);pts.push([cx+(W*.75)*easeIn(u),cy-(H*.7)*easeIn(u)]);}drawComet(pts,4+6*g);}
                    else{glow(hx,hy,R1*(.3+.9*g),col,.9);flare(hx,hy,R1*(.6+1.4*g),.85*g,t*.6);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,hy,3+5*g,0,TAU);ctx.fill();}}
                drawSparks();
                if(t>=3.6&&t<4.4){ctx.fillStyle='rgba(255,255,255,'+(1-seg(t,3.6,4.4))+')';ctx.fillRect(-20,-20,W+40,H+40);}
                if(t<3.5)setCaption('No vazio, um planetoide guarda uma luz que ainda não tem forma.','',clamp(seg(t,.6,1.4)*(1-seg(t,3,3.4))));
                else setCaption('Ele se parte. A luz escapa.','',clamp(seg(t,4.2,4.8)*(1-seg(t,5.9,6.3))));
            }else if(t<10.0){
                // Cena 2: travessia e descida sobre o planeta natal.
                const warp=t<7.6?Math.sin(seg(t,6.4,7.6)*Math.PI)*1.2:0;
                const rise=easeOut(seg(t,7.0,8.6)),PR=Math.max(W*.62,H*.95),pcx=W*.5,pcy=H*.66+PR+H*.5*(1-rise);
                const ia=-Math.PI/2+.05,impact=[pcx+Math.cos(ia)*PR,pcy+Math.sin(ia)*PR];
                if(t>9.75)shake=14*(1-seg(t,9.75,10));
                ctx.translate((R()-.5)*shake,(R()-.5)*shake);
                background(t,warp);
                if(rise>0&&P&&P.drawPlanet)P.drawPlanet(ctx,{cx:pcx,cy:pcy,radius:PR,surface:home,rotation:.4+t*.015,time:t*1000,atmosphere:'#c9a6ff',maxResolution:512});
                if(t<7.6){const pts=[];for(let i=0;i<14;i++)pts.push([W/2-i*9,H/2+i*7]);drawComet(pts,7);}
                else{const u=easeIn(seg(t,7.6,9.8)),pts=[];for(let i=0;i<26;i++)pts.push(cometPath(Math.max(0,u-i*.012),impact));drawComet(pts,5+5*u);
                    if(u>.6){const h=pts[0];ctx.strokeStyle=rgba(hot,.25*(u-.6)/.4);ctx.lineWidth=2;ctx.beginPath();ctx.arc(h[0],h[1],18+(1-u)*40,0,TAU);ctx.stroke();}}
                if(!flags.impact&&t>=9.8){flags.impact=true;burst(impact[0],impact[1],160,PR*.9,col,1.8);}
                drawSparks();
                setCaption('Um cometa de luz cruza o sistema em direção a '+world+'.','',clamp(seg(t,7.2,7.8)*(1-seg(t,9.3,9.7))));
                o._impact=impact;o._PR=PR;o._pc=[pcx,pcy];
            }else{
                // Cena 3: impacto, coluna de luz e a forma da Diamante.
                const impact=o._impact||[W*.5,H*.66],PR=o._PR||W*.62,pc=o._pc||[W*.5,H*.66+W*.62];
                if(t<10.7)shake=12*(1-seg(t,10,10.7));
                ctx.translate((R()-.5)*shake,(R()-.5)*shake);
                background(t,0);
                if(P&&P.drawPlanet)P.drawPlanet(ctx,{cx:pc[0],cy:pc[1],radius:PR,surface:home,rotation:.4+t*.015,time:t*1000,atmosphere:'#c9a6ff',maxResolution:512});
                // Onda de choque achatada na superfície.
                const k=seg(t,10,12);ctx.strokeStyle=rgba(hot,.8*(1-k));ctx.lineWidth=5*(1-k)+1;ctx.beginPath();ctx.ellipse(impact[0],impact[1],PR*.05+k*PR*.7,(PR*.05+k*PR*.7)*.18,0,0,TAU);ctx.stroke();
                glow(impact[0],impact[1],PR*.25*(1-k*.6),col,.8*(1-k*.5));
                // Coluna de luz que se estreita.
                const pill=1-seg(t,11.6,13.2),pw=(60+80*(1-seg(t,10,11.6)))*Math.max(.15,pill);
                if(pill>0){const g=ctx.createLinearGradient(impact[0]-pw,0,impact[0]+pw,0);g.addColorStop(0,rgba(col,0));g.addColorStop(.5,rgba([255,255,255],.9*pill));g.addColorStop(1,rgba(col,0));ctx.fillStyle=g;ctx.fillRect(impact[0]-pw,-10,pw*2,impact[1]+10);}
                // A Diamante se condensa a partir da luz.
                if(!diamond)buildDiamond();
                const f=seg(t,11.2,13.4),colorIn=seg(t,12.6,14.2);
                if(f>0&&diamond){
                    const sc=.35+.65*easeOut(f),dw=diamond.w*sc,dh=diamond.h*sc,dx=impact[0]-dw/2,dy=impact[1]-dh*.98-(1-easeOut(f))*H*.05;
                    glow(impact[0],dy+dh*.45,dh*.7,col,.45*f);
                    ctx.globalAlpha=f*colorIn;ctx.drawImage(diamond.img,dx,dy,dw,dh);
                    ctx.globalAlpha=f*(1-colorIn);ctx.drawImage(diamond.white,dx,dy,dw,dh);ctx.globalAlpha=1;
                    if(t<13.4)for(let i=0;i<10;i++){const a=t*3+i*TAU/10,r=(1-f)*dh*.8+20;ctx.fillStyle=rgba(i%2?hot:col,.9);ctx.beginPath();ctx.arc(impact[0]+Math.cos(a)*r,dy+dh*.45+Math.sin(a)*r*.5,2.2,0,TAU);ctx.fill();}
                }
                drawSparks();
                if(t<10.5){ctx.fillStyle='rgba(255,255,255,'+(1-seg(t,10,10.5))+')';ctx.fillRect(-20,-20,W+40,H+40);}
                setCaption(name+' desperta.','A Primeira Diamante de '+world+'.',clamp(seg(t,12.8,13.5)*(1-seg(t,15,15.4))));
            }
            ctx.restore();
            // Fades de entrada e saída.
            const fadeIn=1-seg(t,0,.8),fadeOut=seg(t,14.8,END);
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
        // Primeiro quadro preto enquanto as texturas são preparadas.
        ctx.fillStyle='#05020d';ctx.fillRect(0,0,W,H);
        setTimeout(()=>{prewarm();raf=requestAnimationFrame(frame);},40);
        api.skip=finish;
    }
    const api={play,skip(){}};
    window.GempireIntro=api;
})();
