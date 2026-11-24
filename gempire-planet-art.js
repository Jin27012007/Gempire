/* =========================================================================
 * GEMPIRE · Arte procedural de planetas, espaço e naves
 *
 * Planetas: cada mundo recebe uma textura equirretangular estilizada
 * (continentes com contorno, falésias, terraços de relevo, águas rasas,
 * espuma, cristais, vegetação, lava ou gelo) gerada a partir da mesma
 * semente/topologia já salva no jogo. A cada quadro a textura é projetada em
 * uma esfera com sombreamento cel-shading, nuvens e atmosfera.
 *
 * O módulo não depende do estado do jogo: recebe o contexto 2D e os dados do
 * planeta como parâmetros, por isso pode ser carregado antes do script principal.
 * ========================================================================= */
(function(){
    'use strict';
    const TAU=Math.PI*2;
    const TEX_W=512,TEX_H=256;

    // ------------------------------------------------------------------
    // Ruído determinístico
    // ------------------------------------------------------------------
    function hash3(x,y,z,seed){
        let h=(seed|0)^Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1440662683);
        h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
        return (h>>>0)/4294967295;
    }
    function fade(t){return t*t*(3-2*t);}
    function noise3(x,y,z,seed){
        const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
        const xf=fade(x-xi),yf=fade(y-yi),zf=fade(z-zi);
        const c000=hash3(xi,yi,zi,seed),c100=hash3(xi+1,yi,zi,seed),c010=hash3(xi,yi+1,zi,seed),c110=hash3(xi+1,yi+1,zi,seed);
        const c001=hash3(xi,yi,zi+1,seed),c101=hash3(xi+1,yi,zi+1,seed),c011=hash3(xi,yi+1,zi+1,seed),c111=hash3(xi+1,yi+1,zi+1,seed);
        const x00=c000+(c100-c000)*xf,x10=c010+(c110-c010)*xf,x01=c001+(c101-c001)*xf,x11=c011+(c111-c011)*xf;
        const y0=x00+(x10-x00)*yf,y1=x01+(x11-x01)*yf;
        return y0+(y1-y0)*zf;
    }
    function fbm(x,y,z,seed,oct){
        let amp=.5,freq=1,sum=0,norm=0;
        for(let i=0;i<oct;i++){sum+=amp*noise3(x*freq,y*freq,z*freq,seed+i*1013);norm+=amp;amp*=.5;freq*=2.07;}
        return sum/norm;
    }
    // Voronoi 3D na superfície da esfera: devolve distância até a borda da placa e id da célula.
    function plates(x,y,z,scale,seed){
        x*=scale;y*=scale;z*=scale;
        const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
        let f1=9,f2=9,id=0;
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
            const cx=xi+dx,cy=yi+dy,cz=zi+dz;
            const px=cx+hash3(cx,cy,cz,seed),py=cy+hash3(cx,cy,cz,seed+1),pz=cz+hash3(cx,cy,cz,seed+2);
            const d=(px-x)*(px-x)+(py-y)*(py-y)+(pz-z)*(pz-z);
            if(d<f1){f2=f1;f1=d;id=hash3(cx,cy,cz,seed+3);}else if(d<f2)f2=d;
        }
        return {edge:Math.sqrt(f2)-Math.sqrt(f1),id};
    }
    function rng(seed){
        let v=seed>>>0;
        return function(){v+=0x6D2B79F5;let t=v;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
    }
    function hex(c){
        const s=String(c||'#000').replace('#','');
        const n=s.length===3?s.split('').map(ch=>ch+ch).join(''):s.padEnd(6,'0');
        return [parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16)];
    }
    function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
    const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

    // ------------------------------------------------------------------
    // Paletas de bioma (direção de arte: tons saturados, contorno escuro)
    // ------------------------------------------------------------------
    const BIOMES={
        rocky:{deep:'#3e2a5c',shallow:'#5e4580',foam:null,land:['#8466a3','#a481bb','#c39dcb'],cliff:'#5a3d7a',cliffDark:'#3b2756',ink:'#24143a',plates:{scale:4.2,crack:'#4a3168',width:.06,emissive:false},
            beach:null,cap:null,detail:'crystal',crystal:['#fbe8ff','#d3a8ff','#9d6cf0'],shadow:'#24124a',cloud:'#f6ecff',cloudAmount:.18,fluid:false},
        oceanic:{deep:'#1d4d9e',shallow:'#36a3dc',foam:'#dafcff',land:['#6cc06a','#8fd36f','#c1e38c'],cliff:'#8b6a8f',cliffDark:'#5d4569',ink:'#1b2d58',
            beach:'#f2e1a8',cap:'#f4fbff',detail:'reef',crystal:['#ffe0f6','#bfe9ff','#f4a8e4'],shadow:'#1a1f5a',cloud:'#ffffff',cloudAmount:.42,fluid:true},
        icy:{deep:'#2c5db0',shallow:'#5d9de2',foam:'#f2fbff',land:['#cfe5f8','#e6f3ff','#ffffff'],plates:{scale:4.4,crack:'#8fbbe8',width:.045,emissive:false},cliff:'#8bb3e2',cliffDark:'#5c83bf',ink:'#24396b',
            beach:null,cap:'#ffffff',detail:'ice',crystal:['#ffffff','#a8dcff','#6fb7f0'],shadow:'#24306a',cloud:'#ffffff',cloudAmount:.34,fluid:true},
        volcanic:{deep:'#b8341c',shallow:'#f2672a',foam:'#ffd24a',land:['#4b2e58','#603b68','#7a4b74'],plates:{scale:4.8,crack:'#ff7a2f',core:'#ffd86a',width:.065,emissive:true},cliff:'#2c1a3a',cliffDark:'#1c1028',ink:'#170c22',
            beach:null,cap:null,detail:'lava',crystal:['#ffd38a','#ff8a3d','#ff5a3d'],shadow:'#1a0b2a',cloud:'#c9a2c4',cloudAmount:.2,fluid:true,emissive:true},
        organic:{deep:'#1f63b4',shallow:'#43b2db',foam:'#e2fbff',land:['#64bb57','#88d062','#b3e07a'],cliff:'#9a7091',cliffDark:'#6b4b6d',ink:'#1d3548',
            beach:'#f3e3a9',cap:'#f6fbff',detail:'trees',crystal:['#ffd2ef','#f4a8e4','#d9a6ff'],shadow:'#1d1f55',cloud:'#ffffff',cloudAmount:.4,fluid:true}
    };

    // ------------------------------------------------------------------
    // Textura equirretangular do planeta
    // ------------------------------------------------------------------
    const TEXTURE_CACHE=new Map();
    function buildTexture(key,opts){
        const W=TEX_W,H=TEX_H,seed=(opts.seed>>>0)||1;
        const biome=BIOMES[opts.biome]||BIOMES.rocky;
        const features=Array.isArray(opts.features)?opts.features:[];
        const coverage=Math.max(.03,Math.min(.985,Number(opts.landCoverage)||.45));
        const hasFluid=opts.waterKind&&opts.waterKind!=='none';
        const heights=new Float32Array(W*H),rowArea=new Float32Array(H);
        const plateCfg=biome.plates,plateEdge=plateCfg?new Float32Array(W*H):null,plateId=plateCfg?new Float32Array(W*H):null;
        let minH=Infinity,maxH=-Infinity;
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
            rowArea[y]=cl;
            for(let x=0;x<W;x++){
                const lon=-Math.PI+(x+.5)/W*TAU;
                const px=cl*Math.sin(lon),py=sl,pz=cl*Math.cos(lon);
                let score=features.length?-3:0;
                for(const f of features){
                    const dot=sl*Math.sin(f.lat)+cl*Math.cos(f.lat)*Math.cos(lon-f.lon);
                    score=Math.max(score,f.radius-Math.acos(Math.max(-1,Math.min(1,dot))));
                }
                // Distorção de domínio cria litorais orgânicos sem perder a topologia salva.
                const wx=fbm(px*1.6+3.1,py*1.6,pz*1.6,seed+11,2)-.5,wy=fbm(px*1.6,py*1.6+7.7,pz*1.6,seed+23,2)-.5;
                const n=fbm(px*2.3+wx*1.4,py*2.3+wy*1.4,pz*2.3,seed,5)-.5;
                const h=(features.length?Math.min(score,1.1)*.85:0)+n*1.05;
                heights[y*W+x]=h;
                if(plateCfg){const pl=plates(px+wx*.25,py+wy*.25,pz,plateCfg.scale,seed+404);plateEdge[y*W+x]=pl.edge;plateId[y*W+x]=pl.id;}
                if(h<minH)minH=h;if(h>maxH)maxH=h;
            }
        }
        // Limiar escolhido por área para respeitar a porcentagem de terra do save.
        const order=Array.from(heights.keys()).sort((a,b)=>heights[b]-heights[a]);
        let total=0;for(let y=0;y<H;y++)total+=rowArea[y]*W;
        let acc=0,thr=maxH;
        for(const i of order){acc+=rowArea[(i/W)|0];if(acc>=total*coverage){thr=heights[i];break;}}
        const land=new Uint8Array(W*H);
        for(let i=0;i<W*H;i++)land[i]=heights[i]>=thr?1:0;
        const landAt=(x,y)=>{if(y<0||y>=H)return 1;return land[y*W+((x%W)+W)%W];};
        const band=(i)=>{const e=(heights[i]-thr)/Math.max(.001,maxH-thr);return e<.22?0:e<.55?1:2;};

        const rgba=new Uint8ClampedArray(W*H*4),flags=new Uint8Array(W*H); // flag 1 = fluido, 2 = emissivo
        const deep=hex(biome.deep),shallow=hex(biome.shallow),foam=biome.foam?hex(biome.foam):null;
        const lands=biome.land.map(hex),cliff=hex(biome.cliff),cliffDark=hex(biome.cliffDark),ink=hex(biome.ink);
        const beach=biome.beach?hex(biome.beach):null,cap=biome.cap?hex(biome.cap):null;
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,absLat=Math.abs(lat);
            for(let x=0;x<W;x++){
                const i=y*W+x,h=heights[i];let c;
                if(!land[i]){
                    const depth=(thr-h)/Math.max(.001,thr-minH);
                    if(hasFluid){
                        c=mix(shallow,deep,smooth(.02,.38,depth));
                        if(foam&&depth<.035)c=foam;
                        flags[i]=biome.emissive?2:1;
                        if(biome.emissive){const glow=fbm(x*.045,y*.06,seed*.001,seed+5,3);c=mix(c,hex('#ffb347'),smooth(.6,.72,glow)*.55);}
                    }else{
                        // Mundos sem oceano: bacias baixas e cânions.
                        c=mix(hex(biome.shallow),hex(biome.deep),smooth(0,.5,depth));
                    }
                    // Contorno de tinta logo abaixo da costa.
                    if(landAt(x,y-1)&&!foam)c=mix(c,ink,.55);
                }else{
                    const b=band(i);c=lands[b].slice();
                    // Variação suave de cor dentro do mesmo patamar.
                    const tint=fbm(x*.06,y*.06,1.7,seed+77,2)-.5;c=mix(c,tint>0?[255,255,255]:hex(biome.shadow),Math.abs(tint)*.22);
                    if(beach&&h-thr<.025&&fbm(x*.15,y*.15,.3,seed+31,2)>.45)c=beach;
                    if(plateCfg){
                        // Placas com leve variação de tom e rachaduras entre elas.
                        const pid=plateId[i];c=mix(c,pid>.5?[255,255,255]:hex(biome.shadow),Math.abs(pid-.5)*.28);
                        const e=plateEdge[i];
                        if(e<plateCfg.width){
                            const k=smooth(0,1,1-e/plateCfg.width);
                            if(plateCfg.emissive){c=mix(hex(plateCfg.crack),hex(plateCfg.core),smooth(.55,1,k));flags[i]=2;}
                            else c=mix(c,hex(plateCfg.crack),.55+.4*k);
                        }else if(e<plateCfg.width*1.8&&!plateCfg.emissive){c=mix(c,[255,255,255],.1);}
                    }
                    // Terraços: borda inferior de cada patamar vira uma pequena falésia.
                    const below=y+1<H?y*W+W+x:i;
                    if(y+1<H&&land[below]&&band(below)<b)c=mix(c,cliff,.75);
                    // Falésia principal sobre a água (efeito de placas flutuantes).
                    let dropRow=0;
                    for(let k=1;k<=4;k++){if(!landAt(x,y+k)){dropRow=k;break;}}
                    if(dropRow){c=dropRow===1?mix(cliffDark,ink,.25):dropRow<=2?cliffDark:cliff;}
                    // Contorno: terra encostada na água ao norte ou nas laterais.
                    if(!landAt(x,y-1)||!landAt(x-1,y)||!landAt(x+1,y))c=mix(c,ink,.7);
                }
                if(cap&&absLat>1.18+fbm(x*.05,0,1,seed+3,2)*.22){c=cap;if(absLat<1.26)c=mix(cap,hex(biome.cliff),.25);}
                const o=i*4;rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];rgba[o+3]=255;
            }
        }

        // Camada de detalhes desenhada com Canvas 2D (cristais, árvores, lava, gelo).
        const tex=document.createElement('canvas');tex.width=W;tex.height=H;
        const t=tex.getContext('2d',{willReadFrequently:true});
        t.putImageData(new ImageData(rgba,W,H),0,0);
        const R=rng(seed^0x9e3779b9);
        const pickLand=(minE=0)=>{for(let n=0;n<40;n++){const x=(R()*W)|0,y=(H*.16+R()*H*.68)|0,i=y*W+x;if(land[i]&&landAt(x,y+3)&&landAt(x,y-2)&&(heights[i]-thr)/(maxH-thr)>=minE)return{x,y};}return null;};
        const drawWrapped=(x,fn)=>{fn(x);if(x<12)fn(x+W);if(x>W-12)fn(x-W);};
        const crystal=(x,y,s,cols)=>drawWrapped(x,xx=>{
            const parts=[[0,0,1],[-.55*s,.25*s,.62],[.5*s,.3*s,.55]];
            parts.forEach(([dx,dy,k])=>{
                const cx=xx+dx,cy=y+dy,w=s*.38*k,hgt=s*1.25*k;
                t.beginPath();t.moveTo(cx,cy-hgt);t.lineTo(cx+w,cy-hgt*.35);t.lineTo(cx+w*.8,cy);t.lineTo(cx-w*.8,cy);t.lineTo(cx-w,cy-hgt*.35);t.closePath();
                t.fillStyle=cols[1];t.fill();t.lineWidth=.7;t.strokeStyle=biome.ink;t.stroke();
                t.beginPath();t.moveTo(cx,cy-hgt);t.lineTo(cx-w,cy-hgt*.35);t.lineTo(cx-w*.8,cy);t.lineTo(cx,cy);t.closePath();t.fillStyle=cols[0];t.fill();
            });
        });
        const tree=(x,y,s)=>drawWrapped(x,xx=>{
            t.fillStyle=biome.ink;t.beginPath();t.ellipse(xx,y+s*.35,s*.95,s*.55,0,0,TAU);t.fill();
            t.fillStyle='#3f9a4e';t.beginPath();t.arc(xx,y,s*.8,0,TAU);t.fill();
            t.fillStyle='#7fcf63';t.beginPath();t.arc(xx-s*.2,y-s*.25,s*.45,0,TAU);t.fill();
        });
        const crack=(x,y,s,outer,inner)=>drawWrapped(x,xx=>{
            t.lineCap='round';t.lineJoin='round';
            const pts=[[xx-s,y-s*.2],[xx-s*.35,y+s*.15],[xx+s*.1,y-s*.25],[xx+s*.55,y+s*.2],[xx+s,y]];
            [[outer,2.2],[inner,.9]].forEach(([col,w])=>{t.strokeStyle=col;t.lineWidth=w;t.beginPath();t.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<pts.length;k++)t.lineTo(pts[k][0],pts[k][1]);t.stroke();});
        });
        const flower=(x,y)=>{t.fillStyle=R()>.5?'#ffb3e6':'#fff1fb';t.beginPath();t.arc(x,y,1.1,0,TAU);t.fill();};
        const detailCount=biome.detail==='trees'?150:biome.detail==='crystal'?34:biome.detail==='lava'?44:biome.detail==='ice'?36:22;
        for(let n=0;n<detailCount;n++){
            const p=pickLand(biome.detail==='trees'?0:.08);if(!p)continue;
            if(biome.detail==='trees'){if(R()>.12)tree(p.x,p.y,1.6+R()*1.6);else crystal(p.x,p.y,3+R()*2,biome.crystal);if(R()>.6)flower(p.x+3,p.y+2);}
            else if(biome.detail==='crystal'){if(R()>.45)crystal(p.x,p.y,3+R()*3.5,biome.crystal);else crack(p.x,p.y,4+R()*4,biome.cliffDark,biome.cliff);}
            else if(biome.detail==='lava'){if(R()>.25)crack(p.x,p.y,5+R()*6,'#ff6a2c','#ffd86a');else crystal(p.x,p.y,2.5+R()*2,biome.crystal);}
            else if(biome.detail==='ice'){if(R()>.5)crystal(p.x,p.y,3+R()*3.5,biome.crystal);else crack(p.x,p.y,4+R()*4,'#7fa8dc','#ffffff');}
            else{crystal(p.x,p.y,2.5+R()*2,biome.crystal);}
        }
        const finalData=t.getImageData(0,0,W,H).data;
        // Lava desenhada sobre a terra também brilha no lado noturno.
        if(biome.emissive){for(let i=0;i<W*H;i++){const o=i*4;if(finalData[o]>220&&finalData[o+1]>90&&finalData[o+2]<120)flags[i]=2;}}

        // Nuvens estilizadas: blobs com borda macia e sombra própria.
        const clouds=new Uint8Array(W*H);
        const amount=hasFluid?biome.cloudAmount:biome.cloudAmount*.6;
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
            for(let x=0;x<W;x++){
                const lon=-Math.PI+(x+.5)/W*TAU;
                const n=fbm(cl*Math.sin(lon)*2.6,sl*5.2,cl*Math.cos(lon)*2.6,seed+901,4);
                const cut=1-amount*.62;
                clouds[y*W+x]=Math.round(smooth(cut,cut+.05,n)*255);
            }
        }
        const result={key,W,H,seed,rgba:finalData,flags,clouds,biome,land,cloudColor:hex(biome.cloud),shadow:hex(biome.shadow)};
        TEXTURE_CACHE.set(key,result);
        return result;
    }
    const PENDING=new Map();let pendingTimer=null;
    function textureKey(p){return [p.id,p.seed,p.topology,p.biome,p.landCoverage,p.waterKind].join(':');}
    function getTexture(planetLike,deferred){
        const key=textureKey(planetLike);
        if(TEXTURE_CACHE.has(key))return TEXTURE_CACHE.get(key);
        if(!deferred)return buildTexture(key,planetLike);
        // Miniaturas: gera uma textura por vez fora do quadro atual.
        if(!PENDING.has(key))PENDING.set(key,planetLike);
        if(!pendingTimer)pendingTimer=setTimeout(function step(){
            const [k,p]=PENDING.entries().next().value||[];
            if(k){PENDING.delete(k);if(!TEXTURE_CACHE.has(k))buildTexture(k,p);}
            pendingTimer=PENDING.size?setTimeout(step,30):null;
        },16);
        return null;
    }

    // ------------------------------------------------------------------
    // Camada de dano: fraturas por estágio, estilhaçamento e buracos de exaustão
    // ------------------------------------------------------------------
    // Grandes placas da crosta (cerca de 15–20 fragmentos por mundo), calculadas
    // uma vez por planeta e reaproveitadas por todos os estados de dano.
    function ensureMegaPlates(base){
        if(base.megaEdge)return;
        const W=base.W,H=base.H,edge=new Float32Array(W*H),id=new Float32Array(W*H);
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
            for(let x=0;x<W;x++){
                const lon=-Math.PI+(x+.5)/W*TAU,px=cl*Math.sin(lon),py=sl,pz=cl*Math.cos(lon);
                const w=(fbm(px*3,py*3,pz*3,base.seed+71,2)-.5)*.35;
                const pl=plates(px+w,py-w,pz+w*.5,1.45,base.seed+999);
                edge[y*W+x]=pl.edge;id[y*W+x]=pl.id;
            }
        }
        base.megaEdge=edge;base.megaId=id;
    }
    const DAMAGE_CACHE=new Map();
    const CRACK_WIDTH=[0,.022,.045,.075,.1];
    function getDamagedTexture(base,damage){
        const stage=Math.max(0,Math.min(4,damage.stage|0));
        const shatter=damage.shattered?Math.max(.05,Math.min(1,damage.shatterProgress??1)):0;
        const shatterStep=Math.round(shatter*8)/8,depleted=!!damage.depleted;
        if(!stage&&!shatterStep&&!depleted)return base;
        const core=damage.coreColor||'#ffe9c2';
        const key=base.key+'|'+stage+'|'+shatterStep+'|'+(depleted?1:0)+'|'+core;
        if(DAMAGE_CACHE.has(key))return DAMAGE_CACHE.get(key);
        ensureMegaPlates(base);
        const W=base.W,H=base.H,b=base.biome,edge=base.megaEdge,id=base.megaId;
        const rgba=new Uint8ClampedArray(base.rgba),flags=new Uint8Array(base.flags);
        const ink=hex(b.ink),wall=hex(b.cliffDark),wallLit=hex(b.cliff),mantle=hex('#5a2160'),glow=hex(core),hot=mix(glow,[255,255,255],.55);
        const crack=Math.max(CRACK_WIDTH[stage],shatterStep?.11:0);
        const missingShare=shatterStep*.3;
        for(let i=0;i<W*H;i++){
            const e=edge[i],o=i*4;let c=null,f=-1;
            if(missingShare&&id[i]<missingShare){
                // Placa arrancada: parede da casca na borda, interior visto pelo rombo.
                if(e<.045){const t=e/.045;c=mix(wallLit,wall,t);if(t<.15)c=mix(c,ink,.6);f=0;}
                else{f=3;c=[0,0,0];}
            }else if(crack&&e<crack){
                // Fissura: borda escura, manto e luz do núcleo no fundo.
                const t=e/crack;
                if(t<.2){c=mix(hot,glow,t/.2);f=2;}
                else if(t<.55){c=mix(mix(glow,mantle,.55),mantle,smooth(.2,.55,t));f=t<.3?2:0;}
                else{c=mix(mantle,ink,smooth(.55,.95,t));f=0;}
            }else if(crack&&e<crack*1.35){
                c=mix([rgba[o],rgba[o+1],rgba[o+2]],ink,.55);
            }
            if(c){rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];if(f>=0)flags[i]=f;}
        }
        if(depleted)carveKindergartenHoles(base,rgba,flags,glow,hot,mantle,wall,wallLit,ink);
        const result=Object.assign({},base,{rgba,flags,damaged:true,coreRGB:glow,hotRGB:hot});
        if(DAMAGE_CACHE.size>24)DAMAGE_CACHE.delete(DAMAGE_CACHE.keys().next().value);
        DAMAGE_CACHE.set(key,result);
        return result;
    }
    // Buracos geométricos do Jardim de Infância, em camadas até o núcleo.
    function carveKindergartenHoles(base,rgba,flags,glow,hot,mantle,wall,wallLit,ink){
        const W=base.W,H=base.H,c=document.createElement('canvas');c.width=W;c.height=H;
        const g=c.getContext('2d',{willReadFrequently:true});
        g.putImageData(new ImageData(rgba,W,H),0,0);
        const mask=document.createElement('canvas');mask.width=W;mask.height=H;const m=mask.getContext('2d',{willReadFrequently:true});
        const R=rng(base.seed^0x51ed27);
        const css=a=>'rgb('+a.map(Math.round).join(',')+')';
        const holes=[];
        for(let n=0;n<220&&holes.length<26;n++){
            const lat=(R()-.5)*Math.PI*.66,x=R()*W,y=(lat+Math.PI/2)/Math.PI*H,size=H*(.035+R()*.055);
            if(holes.some(h=>Math.hypot(((h.x-x+W*1.5)%W)-W/2,h.y-y)<(h.size+size)*1.25))continue;
            holes.push({x,y,size,lat,sides:R()<.5?4:R()<.6?6:5,rot:R()*Math.PI});
        }
        const shape=(ctx2,h,k,dy)=>{
            const sx=1/Math.max(.35,Math.cos(h.lat));ctx2.beginPath();
            for(let j=0;j<h.sides;j++){
                const a=h.rot+j/h.sides*TAU,jit=1+((j*7919+h.sides)%5)*.04;
                const px=h.x+Math.cos(a)*h.size*k*sx*jit,py=h.y+dy*h.size+Math.sin(a)*h.size*k*jit;
                j?ctx2.lineTo(px,py):ctx2.moveTo(px,py);
            }
            ctx2.closePath();
        };
        const layers=[[1,0,wallLit],[.86,.1,wall],[.72,.17,mix(wall,ink,.35)],[.56,.23,mantle],[.4,.28,mix(mantle,ink,.45)],[.22,.32,glow],[.1,.33,hot]];
        holes.forEach(h=>{
            [h.x,h.x-W,h.x+W].forEach(xx=>{
                const hh=Object.assign({},h,{x:xx});
                layers.forEach(([k,dy,col],li)=>{shape(g,hh,k,dy);g.fillStyle=css(col);g.fill();if(li===0){g.lineWidth=1.2;g.strokeStyle=css(ink);g.stroke();}});
                shape(m,hh,.22,.32);m.fillStyle='#fff';m.fill();
            });
        });
        const d=g.getImageData(0,0,W,H).data,md=m.getImageData(0,0,W,H).data;
        rgba.set(d);
        for(let i=0;i<W*H;i++)if(md[i*4+3]>100)flags[i]=2;
    }

    // ------------------------------------------------------------------
    // Projeção esférica (tabelas pré-calculadas por tamanho)
    // ------------------------------------------------------------------
    const SPHERE_CACHE=new Map();
    const LIGHT=(()=>{const l=[-.5,-.55,.67],m=Math.hypot(...l);return l.map(v=>v/m);})();
    function getSphere(S){
        if(SPHERE_CACHE.has(S)){const hit=SPHERE_CACHE.get(S);SPHERE_CACHE.delete(S);SPHERE_CACHE.set(S,hit);return hit;}
        // Mantém apenas os tamanhos usados recentemente (zoom contínuo gera vários).
        while(SPHERE_CACHE.size>=10)SPHERE_CACHE.delete(SPHERE_CACHE.keys().next().value);
        const idx=[],u0=[],row=[],rowF=[],shade=[],rim=[],spec=[],zs=[],ds=[];
        const half=S/2;
        for(let py=0;py<S;py++){
            for(let px=0;px<S;px++){
                const x=(px+.5-half)/half,y=(py+.5-half)/half,d2=x*x+y*y;
                if(d2>1)continue;
                const z=Math.sqrt(1-d2),lat=Math.asin(Math.max(-1,Math.min(1,y))),rel=Math.atan2(x,z);
                idx.push(py*S+px);zs.push(z);ds.push(Math.sqrt(d2));
                u0.push((rel+Math.PI)/TAU*TEX_W);
                const fy=Math.max(0,Math.min(TEX_H-1.001,(lat+Math.PI/2)/Math.PI*TEX_H-.5));
                row.push(Math.floor(fy));rowF.push(fy-Math.floor(fy));
                const ndl=x*LIGHT[0]+y*LIGHT[1]+z*LIGHT[2];
                // Cel-shading em três patamares com transições suaves.
                const s=.3+.32*smooth(-.4,-.1,ndl)+.26*smooth(.15,.45,ndl)+.06*smooth(.6,.9,ndl);
                shade.push(s);
                rim.push(Math.pow(1-z,3.2)*Math.max(0,.25+ndl)*.55);
                const hx=LIGHT[0],hy=LIGHT[1],hz=LIGHT[2]+1,hm=Math.hypot(hx,hy,hz);
                const ndh=Math.max(0,(x*hx+y*hy+z*hz)/hm);
                spec.push(Math.pow(ndh,220));
            }
        }
        const canvas=document.createElement('canvas');canvas.width=S;canvas.height=S;
        const c=canvas.getContext('2d');
        const sphere={S,canvas,ctx:c,image:c.createImageData(S,S),
            idx:Int32Array.from(idx),u0:Float32Array.from(u0),row:Int16Array.from(row),rowF:Float32Array.from(rowF),
            shade:Float32Array.from(shade),rim:Float32Array.from(rim),spec:Float32Array.from(spec),z:Float32Array.from(zs),d:Float32Array.from(ds)};
        SPHERE_CACHE.set(S,sphere);
        return sphere;
    }

    function renderSphere(tex,S,rotation,time,rimColor){
        const sp=getSphere(S),out=sp.image.data,W=tex.W,src=tex.rgba,flags=tex.flags,clouds=tex.clouds;
        const rotT=((rotation/TAU)*W)%W,cloudRot=(((rotation*1.18+time*.000012)/TAU)*W)%W;
        const sh=tex.shadow,cc=tex.cloudColor,rc=rimColor,coreR=.52;
        out.fill(0);
        const n=sp.idx.length;
        const H=tex.H;
        for(let k=0;k<n;k++){
            const p=sp.idx[k]*4,row=sp.row[k],rowBase=row*W;
            let u=(sp.u0[k]+rotT)%W;if(u<0)u+=W;
            // Amostragem bilinear: litorais e contornos ficam suaves mesmo com zoom.
            const fu=u-.5,ui=Math.floor(fu),tx=fu-ui,u0i=(ui+W)%W,u1i=(ui+1)%W;
            const fv=sp.rowF[k],r1=Math.min(H-1,row+1),ty=fv;
            const a0=(rowBase+u0i)*4,a1=(rowBase+u1i)*4,b0=(r1*W+u0i)*4,b1=(r1*W+u1i)*4;
            const w00=(1-tx)*(1-ty),w10=tx*(1-ty),w01=(1-tx)*ty,w11=tx*ty;
            const ti=rowBase+(u|0),flag=flags[ti];
            if(flag===3){
                // Interior exposto: casca rompida, cavidade escura com cristais e núcleo brilhante.
                const dist=sp.d[k];
                if(dist<coreR){
                    // Núcleo cristalino: brilho radial com borda suavizada para dentro da cavidade.
                    const t=dist/coreR,cr=tex.coreRGB,hr=tex.hotRGB,lit=Math.max(0,1-t*t),edgeT=smooth(.86,1,t);
                    const r0=cr[0]+(hr[0]-cr[0])*lit,g0=cr[1]+(hr[1]-cr[1])*lit,b0=cr[2]+(hr[2]-cr[2])*lit;
                    out[p]=r0+(60-r0)*edgeT*.7;out[p+1]=g0+(30-g0)*edgeT*.7;out[p+2]=b0+(80-b0)*edgeT*.7;out[p+3]=255;
                }else if(sp.z[k]<.28){out[p+3]=0;}
                else{
                    const t=(dist-coreR)/(1-coreR),spark=((ti*2654435761)>>>0)%97===0;
                    const bl=Math.max(0,1-t*1.6),cr=tex.coreRGB;
                    out[p]=spark?120:34+cr[0]*.35*bl;out[p+1]=spark?235:18+cr[1]*.3*bl;out[p+2]=spark?230:52+cr[2]*.4*bl;out[p+3]=255;
                }
                continue;
            }
            let s=sp.shade[k];
            let r=src[a0]*w00+src[a1]*w10+src[b0]*w01+src[b1]*w11;
            let g=src[a0+1]*w00+src[a1+1]*w10+src[b0+1]*w01+src[b1+1]*w11;
            let b=src[a0+2]*w00+src[a1+2]*w10+src[b0+2]*w01+src[b1+2]*w11;
            // Sombra das nuvens deslocada sobre o terreno.
            let cu=(sp.u0[k]+cloudRot)%W;if(cu<0)cu+=W;
            const cloudA=clouds[rowBase+(cu|0)]/255;
            let su=(cu+4)%W;const cloudShadow=clouds[rowBase+(su|0)]/255;
            if(cloudShadow>0&&cloudA<.5)s*=1-cloudShadow*.22;
            if(flag===2)s=Math.max(s,.92);
            // Sombras violetas em vez de preto puro.
            const inv=1-s;
            r=r*s+sh[0]*inv*.55;g=g*s+sh[1]*inv*.55;b=b*s+sh[2]*inv*.55;
            if(flag===1){const sp2=sp.spec[k]*150;r+=sp2;g+=sp2;b+=sp2;}
            if(cloudA>0){
                const cs=Math.max(.55,sp.shade[k]),a=cloudA*.95;
                r=r*(1-a)+(cc[0]*cs+sh[0]*(1-cs)*.4)*a;
                g=g*(1-a)+(cc[1]*cs+sh[1]*(1-cs)*.4)*a;
                b=b*(1-a)+(cc[2]*cs+sh[2]*(1-cs)*.4)*a;
            }
            const rm=sp.rim[k];
            r+=rc[0]*rm;g+=rc[1]*rm;b+=rc[2]*rm;
            out[p]=r;out[p+1]=g;out[p+2]=b;out[p+3]=255;
        }
        sp.ctx.putImageData(sp.image,0,0);
        return sp.canvas;
    }

    function parseColor(c,fallback){
        if(!c)return fallback;
        if(c[0]==='#')return hex(c);
        const m=String(c).match(/rgba?\(([^)]+)\)/);
        if(m){const p=m[1].split(',').map(Number);return [p[0],p[1],p[2]];}
        return fallback;
    }

    // Anéis de entulho e fragmentos colossais que se afastam após o nascimento de uma Diamante.
    function drawShatterField(ctx,cx,cy,radius,opts,amount,front){
        const time=Number(opts.time)||0,b=BIOMES[opts.surface.biome]||BIOMES.rocky,seed=(opts.surface.seed>>>0)||1;
        const hr=(i,j,k)=>hash3(i,j,k,seed^0xa5a5);
        const rings=[[1.62,.3,-.32,.000018],[1.95,.42,.22,-.000012]];
        rings.forEach(([rx,ry,tilt,spd],ri)=>{
            ctx.save();ctx.translate(cx,cy);ctx.rotate(tilt);
            ctx.lineWidth=radius*(.07-ri*.02);ctx.strokeStyle='rgba(196,182,224,'+(.28*amount)+')';
            ctx.beginPath();ctx.ellipse(0,0,radius*rx,radius*ry,0,front?0:Math.PI,front?Math.PI:TAU);ctx.stroke();
            ctx.lineWidth=Math.max(1,radius*.008);ctx.strokeStyle='rgba(27,15,48,'+(.5*amount)+')';ctx.stroke();
            const count=26+ri*10;
            for(let i=0;i<count;i++){
                const a=(i/count)*TAU+time*spd+hr(i,ri,0)*.2,isFront=Math.sin(a)>0;
                if(isFront!==front)continue;
                const x=Math.cos(a)*radius*rx*(1+(hr(i,ri,1)-.5)*.08),y=Math.sin(a)*radius*ry*(1+(hr(i,ri,2)-.5)*.25),sz=radius*(.012+hr(i,ri,3)*.022)*amount;
                ctx.save();ctx.translate(x,y);ctx.rotate(a*3+i);
                poly(ctx,[[-sz,-sz*.3],[-sz*.2,-sz],[sz,-sz*.4],[sz*.6,sz*.8],[-sz*.7,sz*.6]]);
                ctx.fillStyle=i%3?b.cliffDark:b.land[1];ctx.fill();ctx.lineWidth=Math.max(.8,sz*.18);ctx.strokeStyle=b.ink;ctx.stroke();ctx.restore();
            }
            ctx.restore();
        });
        // Fragmentos colossais da casca.
        for(let i=0;i<6;i++){
            const base=i/6*TAU+hr(i,9,0)*.6,a=base+time*.000006*(i%2?1:-1),isFront=Math.sin(a+.4)>-.1;
            const dist=radius*(1.02+.12*(i%3)+.38*amount),sz=radius*(.16+hr(i,9,1)*.13);
            if(isFront!==front)continue;
            const x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist*.72+Math.sin(time*.0006+i)*radius*.015;
            ctx.save();ctx.translate(x,y);ctx.rotate(a+Math.PI/2+Math.sin(time*.0002+i)*.08);
            const pts=[],nv=7+(i%3);for(let j=0;j<nv;j++){const t=j/nv*TAU+hr(i,j,5)*.45,rr=sz*(j%2?.48+hr(i,j,6)*.3:.8+hr(i,j,6)*.4);pts.push([Math.cos(t)*rr,Math.sin(t)*rr*.6-Math.cos(t)*Math.cos(t)*sz*.12]);}
            const depth=sz*(.3+hr(i,3,7)*.25);
            poly(ctx,pts.map(([px,py])=>[px,py+depth]));ctx.fillStyle=b.cliffDark;ctx.fill();ctx.lineWidth=Math.max(1,radius*.01);ctx.strokeStyle=b.ink;ctx.stroke();
            // Face interna do fragmento: manto e veios brilhantes.
            ctx.beginPath();pts.forEach(([px,py],j)=>{if(py>-sz*.1){ctx.moveTo(px,py);ctx.lineTo(px,py+depth);}});ctx.strokeStyle='rgba(27,15,48,.45)';ctx.stroke();
            poly(ctx,pts);const tg=ctx.createLinearGradient(0,-sz,0,sz);tg.addColorStop(0,b.land[2]);tg.addColorStop(1,b.land[0]);ctx.fillStyle=tg;ctx.fill();ctx.stroke();
            ctx.beginPath();ctx.moveTo(pts[0][0]*.5,pts[0][1]*.5+depth*.6);ctx.lineTo(pts[3][0]*.4,pts[3][1]*.4+depth*.7);ctx.strokeStyle='rgba(255,236,190,.8)';ctx.lineWidth=Math.max(1,radius*.008);ctx.stroke();
            ctx.fillStyle=b.crystal[1];const cs=sz*.18;poly(ctx,[[0,-cs*1.4],[cs*.5,-cs*.2],[0,cs*.3],[-cs*.5,-cs*.2]]);ctx.fill();ctx.strokeStyle=b.ink;ctx.lineWidth=Math.max(.8,radius*.006);ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * Desenha um planeta completo.
     * opts: {cx,cy,radius,surface:{id,seed,topology,biome,landCoverage,waterKind,features},
     *        rotation,time,atmosphere,selected,maxResolution,outline}
     */
    function drawPlanet(ctx,opts){
        const {cx,cy,radius}=opts;
        if(!ctx||!(radius>1))return;
        const base=getTexture(opts.surface,!!opts.deferred);
        const damage=opts.damage||{};
        const tex=base&&(damage.stage||damage.shattered||damage.depleted)?getDamagedTexture(base,damage):base;
        const shatter=damage.shattered?Math.max(.05,Math.min(1,damage.shatterProgress??1)):0;
        const coreRGB=parseColor(damage.coreColor,[255,233,194]);
        const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
        const S=Math.max(32,Math.min(opts.maxResolution||352,Math.round(radius*2*dpr/16)*16));
        const atm=parseColor(opts.atmosphere,[201,166,255]);
        const rimCol=[atm[0]*.75,atm[1]*.75,atm[2]*.9];
        // Halo atmosférico externo.
        const glow=ctx.createRadialGradient(cx,cy,radius*.92,cx,cy,radius*(opts.selected?1.34:1.24));
        glow.addColorStop(0,'rgba('+atm.join(',')+',.55)');
        glow.addColorStop(.35,'rgba('+atm.join(',')+',.18)');
        glow.addColorStop(1,'rgba('+atm.join(',')+',0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius*1.36,0,TAU);ctx.fill();
        // Luz do núcleo vazando pelas fissuras (mais intensa quando estilhaçado).
        const leak=shatter?1:Math.min(.6,(damage.stage||0)*.14+(damage.depleted?.2:0));
        if(leak>0){
            const cg=ctx.createRadialGradient(cx,cy,radius*.5,cx,cy,radius*(1.25+leak*.55));
            cg.addColorStop(0,'rgba('+coreRGB.join(',')+','+(.55*leak)+')');cg.addColorStop(1,'rgba('+coreRGB.join(',')+',0)');
            ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx,cy,radius*(1.25+leak*.55),0,TAU);ctx.fill();
        }
        if(shatter)drawShatterField(ctx,cx,cy,radius,opts,shatter,false);
        if(!tex){
            const b=BIOMES[opts.surface.biome]||BIOMES.rocky,g=ctx.createRadialGradient(cx-radius*.35,cy-radius*.4,radius*.1,cx,cy,radius);
            g.addColorStop(0,b.land[2]);g.addColorStop(.55,b.shallow);g.addColorStop(1,b.shadow);
            ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.fill();
            ctx.lineWidth=Math.max(1.2,radius*.018);ctx.strokeStyle='rgba(26,12,46,.9)';ctx.stroke();
            return;
        }
        const rot=Number(opts.rotation)||0,time=Number(opts.time)||0,sp=getSphere(S);
        // Reaproveita o último quadro quando a rotação mudou menos que meio texel.
        const last=sp.last,fresh=last&&last.tex===tex&&Math.abs(last.rot-rot)<.006&&Math.abs(last.time-time)<120;
        if(!fresh){renderSphere(tex,S,rot,time,rimCol);sp.last={tex,rot,time};}
        const img=sp.canvas;
        ctx.save();
        ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.clip();
        ctx.imageSmoothingEnabled=true;
        ctx.drawImage(img,cx-radius,cy-radius,radius*2,radius*2);
        ctx.restore();
        if(shatter)drawShatterField(ctx,cx,cy,radius,opts,shatter,true);
        // Contorno de tinta + filete de luz atmosférica (a casca rompida dispensa o contorno contínuo).
        if(opts.outline!==false&&!shatter){
            ctx.lineWidth=Math.max(1.2,radius*.018);ctx.strokeStyle='rgba(26,12,46,.9)';
            ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.stroke();
            ctx.lineWidth=Math.max(1,radius*.012);ctx.strokeStyle='rgba('+atm.join(',')+',.75)';
            ctx.beginPath();ctx.arc(cx,cy,radius*1.012,Math.PI*.95,Math.PI*1.75);ctx.stroke();
        }
    }

    // ------------------------------------------------------------------
    // Fundo espacial violeta (nebulosa pré-renderizada)
    // ------------------------------------------------------------------
    let nebula=null;
    function buildNebula(w,h){
        const c=document.createElement('canvas'),scale=.25;
        c.width=Math.max(64,Math.round(w*scale));c.height=Math.max(64,Math.round(h*scale));
        const g=c.getContext('2d');
        const base=g.createLinearGradient(0,0,0,c.height);
        base.addColorStop(0,'#21123f');base.addColorStop(.55,'#160b2e');base.addColorStop(1,'#0d0620');
        g.fillStyle=base;g.fillRect(0,0,c.width,c.height);
        const img=g.getImageData(0,0,c.width,c.height),d=img.data;
        for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
            const n=fbm(x/c.width*3.2,y/c.height*2.2,.5,4242,4),m=fbm(x/c.width*5+9,y/c.height*4,.2,777,3);
            const a=smooth(.48,.8,n)*.55,b=smooth(.55,.85,m)*.35,o=(y*c.width+x)*4;
            d[o]+=120*a+150*b;d[o+1]+=60*a+70*b;d[o+2]+=170*a+140*b;
        }
        g.putImageData(img,0,0);
        nebula={canvas:c,w,h};
    }
    function drawSpaceBackground(ctx,w,h,time,stars){
        if(!nebula||nebula.w!==Math.round(w)||nebula.h!==Math.round(h))buildNebula(Math.round(w),Math.round(h));
        ctx.imageSmoothingEnabled=true;
        ctx.drawImage(nebula.canvas,0,0,w,h);
        (stars||[]).forEach((star,i)=>{
            const pulse=.6+Math.sin(time*.001+i)*.3,x=star.x*w,y=star.y*h;
            ctx.globalAlpha=star.a*pulse;
            ctx.fillStyle=i%7===0?'#f4c6ff':i%11===0?'#ffe7b0':'#f3ecff';
            if(star.r>1.25&&i%5===0){
                const s=star.r*2.6;
                ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.22,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*.22,y);ctx.closePath();ctx.fill();
                ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x,y+s*.22);ctx.lineTo(x+s,y);ctx.lineTo(x,y-s*.22);ctx.closePath();ctx.fill();
            }else{ctx.beginPath();ctx.arc(x,y,star.r,0,TAU);ctx.fill();}
        });
        ctx.globalAlpha=1;
    }

    // Estrela estilizada (mapa galáctico e centro do sistema).
    function drawStar(ctx,x,y,r,color,time,highlight){
        const c=parseColor(color,[255,200,140]);
        const halo=ctx.createRadialGradient(x,y,r*.3,x,y,r*3.4);
        halo.addColorStop(0,'rgba('+c.join(',')+',.75)');halo.addColorStop(.35,'rgba('+c.join(',')+',.2)');halo.addColorStop(1,'rgba('+c.join(',')+',0)');
        ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,r*3.4,0,TAU);ctx.fill();
        const spin=(time||0)*.00012,len=r*(highlight?2.8:2.1);
        ctx.save();ctx.translate(x,y);ctx.rotate(spin);
        ctx.fillStyle='rgba(255,247,235,.85)';
        for(let k=0;k<4;k++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,-len);ctx.lineTo(r*.18,-r*.2);ctx.lineTo(-r*.18,-r*.2);ctx.closePath();ctx.fill();}
        ctx.restore();
        const core=ctx.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);
        core.addColorStop(0,'#fffaf0');core.addColorStop(.45,'rgb('+mix(c,[255,255,255],.35).map(Math.round).join(',')+')');core.addColorStop(1,'rgb('+c.map(Math.round).join(',')+')');
        ctx.fillStyle=core;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
        ctx.lineWidth=Math.max(1,r*.08);ctx.strokeStyle='rgba(40,18,60,.55)';ctx.stroke();
    }

    // ------------------------------------------------------------------
    // Naves (vetoriais, nariz apontando para cima / -y)
    // ------------------------------------------------------------------
    const INK='#1b0f30';
    function poly(c,pts){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();}
    function shade(c,pts,fill,stroke=true){poly(c,pts);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=INK;c.stroke();}}
    function engine(c,x,y,w,len,color,time){
        const flick=.8+Math.sin((time||0)*.02+x)*.2;
        const g=c.createLinearGradient(x,y,x,y+len*flick);
        g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.3,color);g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.beginPath();c.moveTo(x-w,y);c.lineTo(x+w,y);c.lineTo(x,y+len*flick);c.closePath();c.fill();
    }
    function gemCore(c,x,y,s,color){
        const g=c.createRadialGradient(x-s*.3,y-s*.3,s*.1,x,y,s*1.6);
        g.addColorStop(0,'#ffffff');g.addColorStop(.4,color);g.addColorStop(1,'rgba(0,0,0,0)');
        c.fillStyle=g;c.beginPath();c.arc(x,y,s*1.6,0,TAU);c.fill();
        shade(c,[[x,y-s],[x+s*.7,y],[x,y+s],[x-s*.7,y]],color);
        shade(c,[[x,y-s],[x-s*.7,y],[x,y]],'rgba(255,255,255,.55)',false);
    }
    const SHIP_ART={
        // Nau capitânia lapidada; o núcleo assume a cor da Diamante proprietária.
        diamond(c,col,t){
            const hull=col||'#e7d4ff';
            engine(c,-6,15,3.2,12,hull,t);engine(c,6,15,3.2,12,hull,t);engine(c,0,17,4,16,hull,t);
            shade(c,[[-7,-6],[-20,6],[-17,13],[-6,9]],'#7d5bb8');
            shade(c,[[7,-6],[20,6],[17,13],[6,9]],'#6a4aa3');
            shade(c,[[0,-24],[9,-8],[8,14],[0,18],[-8,14],[-9,-8]],'#efe3ff');
            shade(c,[[0,-24],[-9,-8],[-8,14],[0,18]],'#cbb2f2',false);
            c.strokeStyle=INK;poly(c,[[0,-24],[9,-8],[8,14],[0,18],[-8,14],[-9,-8]]);c.stroke();
            c.beginPath();c.moveTo(-9,-8);c.lineTo(0,-2);c.lineTo(9,-8);c.moveTo(0,-2);c.lineTo(0,18);c.strokeStyle='rgba(27,15,48,.55)';c.stroke();
            gemCore(c,0,4,4.2,hull);
        },
        // Losango da Elite Berílio com canhões laterais.
        elite(c,col,t){
            engine(c,0,13,3,11,'#9fe8ff',t);
            shade(c,[[-11,-2],[-15,-2],[-15,4],[-11,4]],'#4a2f7a');shade(c,[[11,-2],[15,-2],[15,4],[11,4]],'#4a2f7a');
            shade(c,[[0,-16],[12,0],[0,14],[-12,0]],'#8fd8c8');
            shade(c,[[0,-16],[-12,0],[0,14]],'#c7f3e7',false);
            c.strokeStyle=INK;poly(c,[[0,-16],[12,0],[0,14],[-12,0]]);c.stroke();
            c.beginPath();c.moveTo(-12,0);c.lineTo(12,0);c.moveTo(0,-16);c.lineTo(0,14);c.strokeStyle='rgba(27,15,48,.45)';c.stroke();
            gemCore(c,0,0,3,'#5eead4');
        },
        // Disco blindado de guerra (Nefritas).
        war(c,col,t){
            shade(c,[[-21,0],[-15,-1.5],[-15,3.5],[-21,2]],'#3d2a5e');shade(c,[[21,0],[15,-1.5],[15,3.5],[21,2]],'#3d2a5e');
            c.beginPath();c.ellipse(0,2,18,9,0,0,TAU);c.fillStyle='#5b8a52';c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.ellipse(0,0,18,7.5,0,Math.PI,TAU);c.fillStyle='#86b86a';c.fill();
            c.beginPath();c.ellipse(0,-3,8,7,0,Math.PI,TAU);c.closePath();c.fillStyle='#c9f2ff';c.fill();c.stroke();
            c.beginPath();c.ellipse(-2,-6,3,2,-.4,0,TAU);c.fillStyle='rgba(255,255,255,.8)';c.fill();
            for(let i=-3;i<=3;i++){c.beginPath();c.arc(i*4.6,4+Math.abs(i)*-.4,1.2,0,TAU);c.fillStyle=(Math.floor((t||0)/250)+i)%3===0?'#fff3a6':'#ffd24a';c.fill();}
        },
        // Excursão: casco em forma de mão em repouso.
        excursion(c,col,t){
            engine(c,0,13,4,10,'#f4a8e4',t);
            [[-8,-6,-8],[-3,-9,-11],[2,-9,-11.5],[7,-6,-9]].forEach(([x,y,top])=>{
                c.beginPath();c.moveTo(x-2.2,y+2);c.lineTo(x-2.2,y+top*.4);c.quadraticCurveTo(x,y+top*.95,x+2.2,y+top*.4);c.lineTo(x+2.2,y+2);c.closePath();
                c.fillStyle='#e8c99a';c.fill();c.strokeStyle=INK;c.stroke();
            });
            c.beginPath();c.moveTo(-11,-4);c.quadraticCurveTo(-13,10,0,13);c.quadraticCurveTo(13,10,11,-4);c.closePath();
            c.fillStyle='#d8b07a';c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.moveTo(-11,-4);c.quadraticCurveTo(-12,6,-4,10);c.lineTo(-6,-4);c.closePath();c.fillStyle='rgba(255,255,255,.25)';c.fill();
            c.beginPath();c.moveTo(-10,2);c.quadraticCurveTo(-16,0,-14,-6);c.lineTo(-10,-3);c.fillStyle='#c79b66';c.fill();c.strokeStyle=INK;c.stroke();
            gemCore(c,0,3,2.6,'#86efac');
        },
        // Nave Rubi: gota vermelha compacta.
        ruby(c,col,t){
            engine(c,0,11,3,9,'#ff8a8a',t);
            shade(c,[[-5,4],[-11,9],[-6,10]],'#7f1d1d');shade(c,[[5,4],[11,9],[6,10]],'#7f1d1d');
            c.beginPath();c.moveTo(0,-13);c.quadraticCurveTo(9,0,6,9);c.lineTo(-6,9);c.quadraticCurveTo(-9,0,0,-13);c.closePath();
            c.fillStyle='#ef4444';c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.moveTo(0,-13);c.quadraticCurveTo(-9,0,-6,9);c.lineTo(0,9);c.closePath();c.fillStyle='rgba(255,210,210,.45)';c.fill();
            c.beginPath();c.ellipse(0,-2,2.6,3.6,0,0,TAU);c.fillStyle='#ffe4e6';c.fill();c.strokeStyle=INK;c.stroke();
        },
        // Cargueiro modular com contêineres.
        cargo(c,col,t){
            engine(c,-5,15,2.6,9,'#ffd27a',t);engine(c,5,15,2.6,9,'#ffd27a',t);
            shade(c,[[-4,-17],[4,-17],[6,-11],[-6,-11]],'#c9b6e8');
            shade(c,[[-7,-11],[7,-11],[7,15],[-7,15]],'#8f7ab3');
            [[-12,-8,'#f2cf86'],[-12,1,'#c9a6ff'],[7,-8,'#c9a6ff'],[7,1,'#f2cf86']].forEach(([x,y,f])=>{shade(c,[[x,y],[x+5,y],[x+5,y+8],[x,y+8]],f);c.beginPath();c.moveTo(x+.5,y+4);c.lineTo(x+4.5,y+4);c.strokeStyle='rgba(27,15,48,.45)';c.stroke();});
            c.beginPath();c.rect(-3,-9,6,4);c.fillStyle='#c9f2ff';c.fill();c.strokeStyle=INK;c.stroke();
        },
        default(c,col,t){engine(c,0,8,3,8,'#c9a6ff',t);shade(c,[[0,-10],[8,8],[0,5],[-8,8]],col||'#d6c4f5');}
    };
    function drawShip(ctx,type,opts={}){
        const art=SHIP_ART[type]||SHIP_ART.default;
        ctx.save();
        ctx.translate(opts.x||0,opts.y||0);
        if(opts.angle)ctx.rotate(opts.angle);
        const s=opts.scale||1;ctx.scale(s,s);
        ctx.lineWidth=(opts.lineWidth||1.3)/Math.sqrt(s);ctx.lineJoin='round';ctx.lineCap='round';
        if(opts.glow!==false){ctx.shadowColor='rgba(201,166,255,.5)';ctx.shadowBlur=6;}
        art(ctx,opts.color,opts.time||0);
        ctx.restore();
    }

    // Pré-visualizações de nave em <canvas class="ship-preview" data-ship="tipo">.
    function paintShipPreviews(root){
        (root||document).querySelectorAll('canvas.ship-preview:not([data-painted])').forEach(cv=>{
            const w=cv.width,h=cv.height,c=cv.getContext('2d');
            const bg=c.createRadialGradient(w/2,h/2,2,w/2,h/2,w*.6);bg.addColorStop(0,'rgba(140,92,220,.35)');bg.addColorStop(1,'rgba(20,10,40,0)');
            c.fillStyle=bg;c.fillRect(0,0,w,h);
            drawShip(c,cv.dataset.ship,{x:w/2,y:h/2,scale:Math.min(w,h)/46,angle:Math.PI/2,time:0,color:cv.dataset.color||null,lineWidth:1.6});
            cv.setAttribute('data-painted','1');
        });
    }
    function watchShipPreviews(){
        paintShipPreviews(document);
        new MutationObserver(()=>paintShipPreviews(document)).observe(document.body,{childList:true,subtree:true});
    }
    if(document.body)watchShipPreviews();else document.addEventListener('DOMContentLoaded',watchShipPreviews);

    window.GempirePlanetArt={drawPlanet,drawSpaceBackground,drawStar,drawShip,paintShipPreviews,BIOMES,_cache:{TEXTURE_CACHE,SPHERE_CACHE}};
})();
