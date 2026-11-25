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
    // Qualidade visual: resolução das texturas e limite de detalhe da esfera desenhada.
    const QUALITY={low:{w:256,h:128,max:224},medium:{w:512,h:256,max:352},high:{w:1024,h:512,max:640}};
    let QUALITY_KEY='medium',TEX_W=512,TEX_H=256,MAX_RES=352;

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
        rocky:{deep:'#3e2a5c',shallow:'#5e4580',foam:null,land:['#8466a3','#a481bb','#c39dcb'],cliff:'#5a3d7a',cliffDark:'#3b2756',ink:'#24143a',plates:{scale:4.2,crack:'#5a3f7a',width:.04,emissive:false,soft:true},
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
                            else c=mix(c,hex(plateCfg.crack),plateCfg.soft?.25+.3*k:.55+.4*k);
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
    function textureKey(p){return [p.id,p.seed,p.topology,p.biome,p.landCoverage,p.waterKind,TEX_W].join(':');}
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
    // Cobertura de gems: manchas da cor de cada casta que vivem no planeta
    // ------------------------------------------------------------------
    // cover: {key, coverage (0–1 da superfície), parts:[{id, color, share}]}
    // Cada casta cresce a partir de um ponto próprio do globo; quanto maior a
    // fatia da população, mais território ela toma das vizinhas. Com poucas
    // gems surge só uma mancha pequena; com muitas, a cor domina o planeta.
    const GEM_COVER_CACHE=new Map();
    function ensureGemCoverField(root){
        if(root.gcPos)return;
        const W=root.W,H=root.H,N=W*H,pos=new Float32Array(N*3),warp=new Float32Array(N),area=new Float32Array(H);
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);area[y]=cl;
            for(let x=0;x<W;x++){
                const lon=-Math.PI+(x+.5)/W*TAU,i=y*W+x,px=cl*Math.sin(lon),pz=cl*Math.cos(lon);
                // Posição distorcida por ruído: bordas orgânicas mesmo para manchas pequenas.
                const qx=px+(fbm(px*2.2+1.7,sl*2.2,pz*2.2,root.seed+4451,3)-.5)*.9+(fbm(px*7,sl*7,pz*7,root.seed+4454,2)-.5)*.22;
                const qy=sl+(fbm(px*2.2,sl*2.2+4.3,pz*2.2,root.seed+4452,3)-.5)*.9+(fbm(px*7+3,sl*7,pz*7,root.seed+4455,2)-.5)*.22;
                const qz=pz+(fbm(px*2.2,sl*2.2,pz*2.2+8.9,root.seed+4453,3)-.5)*.9+(fbm(px*7,sl*7+5,pz*7,root.seed+4456,2)-.5)*.22;
                const qm=Math.hypot(qx,qy,qz)||1;
                pos[i*3]=qx/qm;pos[i*3+1]=qy/qm;pos[i*3+2]=qz/qm;
                warp[i]=fbm(px*2.8+9.1,sl*2.8,pz*2.8,root.seed+4441,4)-.5+(fbm(px*9,sl*9,pz*9,root.seed+4442,2)-.5)*.35;
            }
        }
        root.gcPos=pos;root.gcWarp=warp;root.gcArea=area;
    }
    function strHash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
    function getGemCoverTexture(base,cover){
        const parts=(cover&&cover.parts||[]).filter(p=>p&&p.share>0);
        if(!parts.length||!(cover.coverage>0))return base;
        const key=base.key+'|gc|'+(cover.key||JSON.stringify(cover));
        if(GEM_COVER_CACHE.has(key))return GEM_COVER_CACHE.get(key);
        const root=base.root||base;ensureGemCoverField(root);
        const W=base.W,H=base.H,N=W*H,pos=root.gcPos,warp=root.gcWarp,area=root.gcArea;
        // Ponto de origem de cada casta (estável por planeta + casta).
        const anchors=parts.map((p,k)=>{
            const h=strHash(String(p.id)+':'+root.seed);
            // Origem fixa por casta: quando uma casta sai, as outras não mudam de lugar.
            const lon=(h%3600)/3600*TAU-Math.PI,lat=(((h>>>12)%1000)/1000-.5)*1.4;
            const cl=Math.cos(lat);
            return [cl*Math.sin(lon),Math.sin(lat),cl*Math.cos(lon),1/(Math.sqrt(p.share)+.08)];
        });
        const score=new Float32Array(N),owner=new Uint8Array(N),margin=new Float32Array(N);
        const BINS=2048;const hist=new Float32Array(BINS);let maxS=0;
        for(let i=0;i<N;i++){
            const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2];let b1=1e9,b2=1e9,o=0;
            for(let k=0;k<anchors.length;k++){
                const a=anchors[k],dot=Math.max(-1,Math.min(1,x*a[0]+y*a[1]+z*a[2]));
                const d=Math.sqrt(2*(1-dot))*a[3];
                if(d<b1){b2=b1;b1=d;o=k;}else if(d<b2)b2=d;
            }
            const sc=b1+warp[i]*.3;score[i]=sc;owner[i]=o;margin[i]=b2-b1;if(sc>maxS)maxS=sc;
        }
        const minS=-.4,span=maxS-minS+1e-6;let total=0;
        for(let i=0;i<N;i++){const w=area[(i/W)|0];total+=w;hist[Math.min(BINS-1,Math.max(0,((score[i]-minS)/span*BINS)|0))]+=w;}
        let acc=0,T=maxS;const goal=total*Math.min(.97,cover.coverage);
        for(let bI=0;bI<BINS;bI++){acc+=hist[bI];if(acc>=goal){T=minS+(bI+1)/BINS*span;break;}}
        const rgba=new Uint8ClampedArray(base.rgba),flags=base.flags,ink=hex(base.biome.ink);
        const cols=parts.map(p=>hex(p.color)),lights=cols.map(c=>mix(c,[255,255,255],.45)),darks=cols.map(c=>mix(c,ink,.45));
        const edgeW=.035;
        for(let i=0;i<N;i++){
            const sc=score[i];if(sc>T)continue;
            const o=i*4,k=owner[i],inside=T-sc;
            let c=[rgba[o],rgba[o+1],rgba[o+2]];
            const lum=(c[0]*.3+c[1]*.55+c[2]*.15)/255;
            // Mantém o relevo: tons claros do terreno viram o tom claro da gem, sombras viram o tom escuro.
            const tone=lum>.6?mix(cols[k],lights[k],(lum-.6)*1.2):mix(darks[k],cols[k],Math.min(1,lum/.6));
            c=mix(c,tone,flags[i]===1?.6:.92);
            // Facetas cristalinas: a mancha brilha como gem, não como tinta chapada.
            const f=warp[i]*7.3;const facet=f-Math.floor(f);
            if(facet<.12)c=mix(c,lights[k],.35);else if(facet>.9)c=mix(c,darks[k],.25);
            if(inside<edgeW*.45||margin[i]<.012)c=mix(c,ink,.7);           // contorno de tinta da mancha
            else if(inside<edgeW)c=mix(c,lights[k],.35);                       // brilho cristalino na borda
            rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];
        }
        const result=Object.assign({},base,{root,rgba,key});
        if(GEM_COVER_CACHE.size>24)GEM_COVER_CACHE.delete(GEM_COVER_CACHE.keys().next().value);
        GEM_COVER_CACHE.set(key,result);
        return result;
    }

    // ------------------------------------------------------------------
    // Camada de dano: fraturas por estágio, estilhaçamento e buracos de exaustão
    // ------------------------------------------------------------------
    // Rede de fraturas em três níveis, calculada uma vez por planeta:
    //  · falhas primárias entre 15–20 grandes placas da crosta;
    //  · ramificações secundárias que nascem nas falhas primárias e afinam;
    //  · trincas finas que se espalham a partir das secundárias.
    // Um ruído de alta frequência quebra as bordas para que nada pareça desenhado à régua.
    function ensureMegaPlates(base){
        if(base.megaEdge)return;
        const W=base.W,H=base.H,N=W*H,seed=base.seed;
        const edge=new Float32Array(N),id=new Float32Array(N),sec=new Float32Array(N),ter=new Float32Array(N),jag=new Float32Array(N),wmod=new Float32Array(N);
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
            for(let x=0;x<W;x++){
                const lon=-Math.PI+(x+.5)/W*TAU,px=cl*Math.sin(lon),py=sl,pz=cl*Math.cos(lon),i=y*W+x;
                const wx=(fbm(px*2.4+1.3,py*2.4,pz*2.4,seed+71,3)-.5)*.55,wy=(fbm(px*2.4,py*2.4+5.1,pz*2.4,seed+72,3)-.5)*.55;
                const pl=plates(px+wx,py+wy,pz-wx*.6,1.45,seed+999);
                edge[i]=pl.edge;id[i]=pl.id;
                // Normalizadas para a escala das falhas primárias (mesma largura física em texels).
                sec[i]=plates(px+wx*.7+wy*.3,py+wy*.7,pz+wx*.4,3.3,seed+1777).edge*(1.45/3.3);
                ter[i]=plates(px+wy*.5,py-wx*.5,pz+wy*.4,7.2,seed+2333).edge*(1.45/7.2);
                jag[i]=fbm(px*8,py*8,pz*8,seed+5,3)-.5;
                wmod[i]=fbm(px*4.5,py*4.5,pz*4.5,seed+9,2);
            }
        }
        // Índice inteiro e centro 3D de cada placa (usados para desmontar o planeta).
        const map=new Map(),idx=new Uint8Array(N),cent=[];
        for(let y=0;y<H;y++){
            const lat=-Math.PI/2+(y+.5)/H*Math.PI,cl=Math.cos(lat),sl=Math.sin(lat);
            for(let x=0;x<W;x++){
                const i=y*W+x;let p=map.get(id[i]);
                if(p===undefined){p=Math.min(254,cent.length);map.set(id[i],p);if(p===cent.length)cent.push([0,0,0,id[i]]);}
                idx[i]=p;const lon=-Math.PI+(x+.5)/W*TAU,c=cent[p];
                c[0]+=cl*Math.sin(lon)*cl;c[1]+=sl*cl;c[2]+=cl*Math.cos(lon)*cl;
            }
        }
        cent.forEach(c=>{const m=Math.hypot(c[0],c[1],c[2])||1;c[0]/=m;c[1]/=m;c[2]/=m;});
        Object.assign(base,{megaEdge:edge,megaId:id,megaSec:sec,megaTer:ter,megaJag:jag,megaWmod:wmod,megaIdx:idx,megaCent:cent});
    }
    const DAMAGE_CACHE=new Map();
    // Largura das fraturas por estágio: [primária, secundária, alcance da secundária, trinca, alcance da trinca, brilho do fundo]
    const CRACK_STAGES=[null,[.042,.03,.26,0,0,.2],[.066,.044,.38,.026,.16,.5],[.092,.056,.5,.032,.24,.8],[.12,.068,.64,.04,.32,1]];
    const LIGHT_UV=[-.67,-.74],ABYSS=[6,2,14];
    function getDamagedTexture(base,damage,deferred){
        const stage=Math.max(0,Math.min(4,damage.stage|0));
        const shatter=damage.shattered?Math.max(.05,Math.min(1,damage.shatterProgress??1)):0;
        const shatterStep=Math.round(shatter*8)/8,depleted=!!damage.depleted;
        if(!stage&&!shatterStep&&!depleted)return base;
        const core=damage.coreColor||'#ffe9c2';
        const key=base.key+'|'+stage+'|'+(shatterStep?1:0)+'|'+(depleted?1:0)+'|'+core;
        if(DAMAGE_CACHE.has(key))return DAMAGE_CACHE.get(key);
        // Dados das placas ficam na textura original, compartilhados por todas as variantes (cobertura de gems etc.).
        const root=base.root||base;
        if(deferred&&!root.megaEdge){
            // Miniaturas: calcula a rede de fraturas fora do quadro atual.
            if(!root.megaQueued){root.megaQueued=true;setTimeout(()=>ensureMegaPlates(root),40);}
            return base;
        }
        ensureMegaPlates(root);
        const W=base.W,H=base.H,N=W*H,b=base.biome;
        const edge=root.megaEdge,sec=root.megaSec,ter=root.megaTer,jag=root.megaJag,wmod=root.megaWmod,mid=root.megaId;
        const rgba=new Uint8ClampedArray(base.rgba),flags=new Uint8Array(base.flags);
        const ink=hex(b.ink),wall=hex(b.cliffDark),wallLit=hex(b.cliff),mantle=hex('#5a2160'),glow=hex(core),hot=mix(glow,[255,255,255],.55);
        const lit=mix(hex(b.land[2]),[255,255,255],.35);
        const cfg=(CRACK_STAGES[Math.max(stage,shatterStep?3:0)]||[0,0,0,0,0,0]).slice();
        if(shatterStep)cfg[0]=.055;
        const [pw,sw,sr,tw,tr]=cfg,depthK=Math.min(1,.5+.125*Math.max(stage,shatterStep?4:0));
        // 1) Campo de distância normalizado até a fratura mais próxima (0 = centro, 1 = borda).
        const D=new Float32Array(N).fill(9),L=new Uint8Array(N);
        for(let i=0;i<N;i++){
            const wm=.5+smooth(.25,.75,wmod[i])*.95,j=jag[i];
            if(pw){const w=pw*wm,d=(edge[i]+j*w*.9)/w;if(d<D[i]){D[i]=d;L[i]=1;}}
            if(sw){const r=1-edge[i]/sr;if(r>0){const w=sw*wm*(.4+.6*r),d=(sec[i]+j*w*.7)/w;if(d<D[i]){D[i]=d;L[i]=2;}}}
            if(tw){const r=1-edge[i]/tr;if(r>0){const w=tw*(.7+.3*wm)*(.55+.45*r),d=(ter[i]+j*w*.5)/w;if(d<D[i]){D[i]=d;L[i]=3;}}}
        }
        // Placas levemente inclinadas: cada laje da crosta recebe um tom próprio.
        const tilt=Math.min(1,stage/4+(shatterStep?.5:0))*.16;
        const gapD=shatterStep?new Float32Array(N).fill(9):null;
        for(let y=0;y<H;y++)for(let x=0;x<W;x++){
            const i=y*W+x,o=i*4,d=D[i],lv=L[i];
            let c=[rgba[o],rgba[o+1],rgba[o+2]];
            if(tilt){const t=(mid[i]-.5)*2;c=mix(c,t>0?lit:hex(b.shadow),Math.abs(t)*tilt);}
            if(shatterStep&&lv===1){
                // Falha primária vira vão aberto: o espaço aparece entre os fragmentos.
                gapD[i]=d;
                if(d<1){flags[i]=4;rgba[o+3]=0;continue;}
                if(d<1.35){c=mix(c,ink,.75*(1-(d-1)/.35));}
                rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];continue;
            }
            if(d<1.7){
                if(d>=1){
                    // Oclusão ao redor da fenda: a crosta afunda em direção à fratura.
                    c=mix(c,ink,.28*(1-(d-1)/.7)*(lv===3?.5:1));
                }else{
                    const xl=(x+W-1)%W,xr=(x+1)%W,yu=Math.max(0,y-1)*W,yd=Math.min(H-1,y+1)*W;
                    const gx=D[y*W+xr]-D[y*W+xl],gy=D[yd+x]-D[yu+x],gm=Math.hypot(gx,gy)||1;
                    const facing=-(gx*LIGHT_UV[0]+gy*LIGHT_UV[1])/gm; // >0: parede voltada para a luz
                    const k=1-d;
                    if(k<.14){
                        // Lábio da fenda: destaque no lado iluminado, tinta no lado em sombra.
                        c=facing>0?mix(c,lit,.55):mix(c,ink,.8);
                    }else{
                        // Quanto mais funda a fenda (nível da falha, estágio e centro do vão), mais escura a cor.
                        const t=(k-.14)/.86,deepK=(lv===1?1:lv===2?.78:.55)*depthK;
                        let wc=facing>0?mix(wallLit,wall,smooth(0,.6,t)):mix(wall,ink,.35+.4*t);
                        // Sombra projetada pela borda iluminada sobre o fundo da fenda.
                        if(facing<-.2)wc=mix(wc,ink,.3);
                        wc=mix(wc,ink,smooth(.05,.55,t)*Math.min(1,deepK*1.1));
                        wc=mix(wc,ABYSS,smooth(.35,1,t)*Math.min(1,deepK));
                        flags[i]=0;
                        c=wc;
                    }
                }
            }
            rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];
        }
        if(depleted)carveKindergartenHoles(base,rgba,flags,glow,hot,mantle,wall,wallLit,ink);
        if(shatterStep){
            // Placas arrancadas (viraram os fragmentos colossais em órbita).
            const missing=.1;
            for(let i=0;i<N;i++)if(mid[i]<missing){flags[i]=3;rgba[i*4+3]=0;}
        }
        const result=Object.assign({},base,{root,megaIdx:root.megaIdx,megaCent:root.megaCent,rgba,flags,damaged:true,shattered:!!shatterStep,gapD,crackD:D,coreRGB:glow,hotRGB:hot});
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
        // Camadas cada vez mais escuras até o fundo; o núcleo é só um ponto fraco de luz lá embaixo.
        const layers=[[1,0,wallLit],[.86,.1,wall],[.72,.17,mix(wall,ink,.4)],[.56,.23,ink],[.4,.28,mix(ink,ABYSS,.6)],[.24,.32,ABYSS],[.08,.33,mix(ABYSS,glow,.45)]];
        holes.forEach(h=>{
            [h.x,h.x-W,h.x+W].forEach(xx=>{
                const hh=Object.assign({},h,{x:xx});
                layers.forEach(([k,dy,col],li)=>{shape(g,hh,k,dy);g.fillStyle=css(col);g.fill();if(li===0){g.lineWidth=1.2;g.strokeStyle=css(ink);g.stroke();}});
                shape(m,hh,.08,.33);m.fillStyle='#fff';m.fill();
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
        let tiOut=null;
        if(tex.shattered){if(!sp.ti)sp.ti=new Int32Array(n);tiOut=sp.ti;}
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
            if(tiOut)tiOut[k]=ti;
            if(flag===4||(flag===3&&tex.shattered)){out[p+3]=0;continue;}
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

    // Desmonta a esfera: cada placa da crosta é deslocada para fora do centro,
    // deixando vãos por onde se vê o espaço e o núcleo. As bordas internas das
    // placas ganham espessura (paredes iluminadas pelo núcleo) com z-buffer.
    function renderShattered(tex,S,rotation,time,rimColor,amount){
        const sp=getSphere(S);
        renderSphere(tex,S,rotation,time,rimColor);sp.last=null;
        const pad=Math.round(S*.32),SO=S+pad*2;
        let buf=sp.shatterBuf;
        if(!buf||buf.SO!==SO){
            const canvas=document.createElement('canvas');canvas.width=SO;canvas.height=SO;
            const c=canvas.getContext('2d');buf=sp.shatterBuf={SO,pad,canvas,ctx:c,image:c.createImageData(SO,SO),zb:new Float32Array(SO*SO)};
        }
        const src=sp.image.data,out=buf.image.data,zb=buf.zb,cent=tex.megaCent,pidx=tex.megaIdx,gap=tex.gapD;
        out.fill(0);zb.fill(-9);
        const np=cent.length,ox=new Float32Array(np),oy=new Float32Array(np),oz=new Float32Array(np);
        const half=S/2;
        for(let q=0;q<np;q++){
            const c=cent[q],cl=Math.hypot(c[0],c[2]),lon=Math.atan2(c[0],c[2])-rotation;
            const X=cl*Math.sin(lon),Y=c[1],Z=cl*Math.cos(lon),h=hash3(q,7,3,tex.seed);
            const mag=amount*half*(.16+.16*h),wob=Math.sin(time*.00035+q*1.7)*half*.012*amount;
            ox[q]=X*mag+wob;oy[q]=Y*mag+Math.cos(time*.0003+q)*half*.01*amount;oz[q]=Z*.08*amount;
        }
        const wallDark=mix(hex(tex.biome.cliffDark),hex(tex.biome.ink),.45),wallTop=mix(hex(tex.biome.cliff),hex(tex.biome.land[1]),.35),core=tex.coreRGB;
        const n=sp.idx.length,ti=sp.ti,STEPS=[];
        const nSteps=Math.max(4,Math.ceil(half*.11));for(let s=1;s<=nSteps;s++)STEPS.push(s/nSteps*.11);
        const put=(x,y,z,r,g,b)=>{
            const xi=x|0,yi=y|0;if(xi<0||yi<0||xi>=SO||yi>=SO)return;
            const j=yi*SO+xi;if(z<=zb[j])return;zb[j]=z;const o=j*4;out[o]=r;out[o+1]=g;out[o+2]=b;out[o+3]=255;
        };
        for(let k=0;k<n;k++){
            const p=sp.idx[k]*4;if(src[p+3]===0)continue;
            const t=ti[k],q=pidx[t],id=sp.idx[k],ix=id%S,iy=(id/S)|0,z=sp.z[k]+oz[q];
            const bx=ix+pad+ox[q],by=iy+pad+oy[q];
            put(bx,by,z,src[p],src[p+1],src[p+2]);
            // Espessura da casca junto aos vãos: pontos da face interna projetados para o centro.
            if(gap[t]<2.4&&sp.z[k]>.3){
                const dx=ix+.5-half,dy=iy+.5-half;
                for(let s=0;s<STEPS.length;s++){
                    const f=STEPS[s],lt=Math.min(1,s/3);
                    const r=wallTop[0]+(wallDark[0]-wallTop[0])*lt,g=wallTop[1]+(wallDark[1]-wallTop[1])*lt,bb=wallTop[2]+(wallDark[2]-wallTop[2])*lt;
                    const cg=lt>.99?.16:.04,shadeW=1;
                    put(bx-dx*f,by-dy*f,z-f*1.5,(r+(core[0]-r)*cg)*shadeW,(g+(core[1]-g)*cg)*shadeW,(bb+(core[2]-bb)*cg)*shadeW);
                }
            }
        }
        buf.ctx.putImageData(buf.image,0,0);
        sp.shatterOff={ox,oy,oz};
        return buf;
    }

    // Núcleo cristalino exposto no centro do planeta desmontado.
    function drawExposedCore(ctx,cx,cy,radius,coreRGB,time,amount){
        const col='rgb('+coreRGB.join(',')+')',hot='rgb('+mix(coreRGB,[255,255,255],.6).map(Math.round).join(',')+')';
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*.7);
        g.addColorStop(0,'rgba('+coreRGB.join(',')+','+(.7*amount)+')');g.addColorStop(.3,'rgba('+coreRGB.join(',')+','+(.18*amount)+')');g.addColorStop(1,'rgba('+coreRGB.join(',')+',0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,radius*.7,0,TAU);ctx.fill();
        const r=radius*.22,rot=time*.00012,nv=8,pts=[];
        for(let i=0;i<nv;i++){const a=rot+i/nv*TAU;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r*.92]);}
        ctx.save();
        for(let i=0;i<nv;i++){
            const a=pts[i],b2=pts[(i+1)%nv],lt=.5+.5*Math.cos(rot+(i+.5)/nv*TAU+2.3);
            ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(a[0],a[1]);ctx.lineTo(b2[0],b2[1]);ctx.closePath();
            ctx.fillStyle='rgb('+mix(mix(coreRGB,[60,30,90],.35),[255,255,255],lt*.75).map(Math.round).join(',')+')';ctx.fill();
        }
        poly(ctx,pts);ctx.lineWidth=Math.max(1,radius*.012);ctx.strokeStyle='rgba(26,12,46,.85)';ctx.stroke();
        ctx.beginPath();ctx.arc(cx,cy,r*.35,0,TAU);ctx.fillStyle=hot;ctx.fill();
        ctx.restore();
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
    // Último globo desenhado: permite ancorar cidades e estruturas na superfície.
    let LAST_GLOBE=null;
    // lon: longitude da textura (0..2π); lat: -π/2 (topo) .. π/2. Devolve posição na tela e o estado do terreno.
    function surfaceQuery(lon,lat){
        const G=LAST_GLOBE;if(!G||!G.tex)return null;
        const tex=G.tex,W=tex.W,H=tex.H;
        let rel=lon-Math.PI-G.rot;rel=((rel+Math.PI)%TAU+TAU)%TAU-Math.PI;
        const cl=Math.cos(lat),x=cl*Math.sin(rel),z=cl*Math.cos(rel),y=Math.sin(lat);
        const u=Math.floor(((lon%TAU+TAU)%TAU)/TAU*W)%W,v=Math.max(0,Math.min(H-1,Math.floor((lat+Math.PI/2)/Math.PI*H)));
        const i=v*W+u;
        let sx=G.cx+x*G.radius,sy=G.cy+y*G.radius,plate=-1;
        if(G.shattered&&G.sp.shatterOff&&tex.megaIdx){plate=tex.megaIdx[i];const k=G.radius*2/G.S;sx+=G.sp.shatterOff.ox[plate]*k;sy+=G.sp.shatterOff.oy[plate]*k;}
        return {x:sx,y:sy,z,flag:tex.flags[i],crack:tex.crackD?tex.crackD[i]:9,plate,shattered:G.shattered};
    }
    function drawPlanet(ctx,opts){
        const {cx,cy,radius}=opts;
        LAST_GLOBE=null;
        if(!ctx||!(radius>1))return;
        const base=getTexture(opts.surface,!!opts.deferred);
        const damage=opts.damage||{};
        const gemCovered=base&&opts.gemCover?getGemCoverTexture(base,opts.gemCover):base;
        // Áreas tomadas pelos rebeldes: manchas escuras por cima das cores das gems.
        const covered=gemCovered&&opts.rebelCover?getGemCoverTexture(gemCovered,opts.rebelCover):gemCovered;
        const tex=covered&&(damage.stage||damage.shattered||damage.depleted)?getDamagedTexture(covered,damage,!!opts.deferred):covered;
        const shatter=damage.shattered?Math.max(.05,Math.min(1,damage.shatterProgress??1)):0;
        const coreRGB=parseColor(damage.coreColor,[255,233,194]);
        const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
        const S=Math.max(32,Math.min(opts.maxResolution?Math.min(opts.maxResolution,Math.round(MAX_RES*1.5/16)*16):MAX_RES,Math.round(radius*2*dpr/16)*16));
        const atm=parseColor(opts.atmosphere,[201,166,255]);
        const rimCol=[atm[0]*.75,atm[1]*.75,atm[2]*.9];
        // Halo atmosférico externo (um mundo desmontado perdeu a atmosfera: o vão mostra o espaço).
        if(!shatter){
        const glow=ctx.createRadialGradient(cx,cy,radius*.92,cx,cy,radius*(opts.selected?1.34:1.24));
        glow.addColorStop(0,'rgba('+atm.join(',')+',.55)');
        glow.addColorStop(.35,'rgba('+atm.join(',')+',.18)');
        glow.addColorStop(1,'rgba('+atm.join(',')+',0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius*1.36,0,TAU);ctx.fill();
        // Luz do núcleo vazando pelas fissuras (mais intensa quando estilhaçado).
        const leak=Math.min(.35,(damage.stage||0)*.06+(damage.depleted?.12:0));
        if(leak>0){
            const cg=ctx.createRadialGradient(cx,cy,radius*.5,cx,cy,radius*(1.25+leak*.55));
            cg.addColorStop(0,'rgba('+coreRGB.join(',')+','+(.55*leak)+')');cg.addColorStop(1,'rgba('+coreRGB.join(',')+',0)');
            ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx,cy,radius*(1.25+leak*.55),0,TAU);ctx.fill();
        }
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
        LAST_GLOBE={cx,cy,radius,rot,tex,S,sp,shattered:!!tex.shattered};
        if(tex.shattered){
            drawExposedCore(ctx,cx,cy,radius,coreRGB,time,shatter);
            const last=sp.lastShatter,fresh=last&&last.tex===tex&&Math.abs(last.rot-rot)<.006&&Math.abs(last.time-time)<90&&last.amount===shatter;
            if(!fresh){renderShattered(tex,S,rot,time,rimCol,shatter);sp.lastShatter={tex,rot,time,amount:shatter};}
            const buf=sp.shatterBuf,scale=radius*2/S;
            ctx.save();ctx.imageSmoothingEnabled=true;
            ctx.drawImage(buf.canvas,cx-radius-buf.pad*scale,cy-radius-buf.pad*scale,buf.SO*scale,buf.SO*scale);
            ctx.restore();
            drawShatterField(ctx,cx,cy,radius,opts,shatter,true);
            return;
        }
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
    // Olho Vermelho: disco creme, corpo laranja facetado e lente hexagonal com diafragma.
    function drawRedEye(c,x,y,r,t){
        c.save();c.translate(x,y);
        c.lineWidth=Math.max(.6,r*.05);c.lineJoin='round';
        c.beginPath();c.arc(0,0,r,0,TAU);c.fillStyle='#fbf1df';c.fill();c.strokeStyle='rgba(27,15,48,.55)';c.stroke();
        c.save();c.beginPath();c.arc(-r*.04,r*.02,r*.88,0,TAU);c.clip();
        const g=c.createRadialGradient(-r*.25,-r*.2,r*.1,0,0,r);g.addColorStop(0,'#fb9a5a');g.addColorStop(1,'#f1662d');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);
        c.globalAlpha=.16;for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){const px=i*r*.32+(j%2?r*.16:0),py=j*r*.28;c.beginPath();c.moveTo(px,py-r*.14);c.lineTo(px+r*.16,py+r*.14);c.lineTo(px-r*.16,py+r*.14);c.closePath();c.fillStyle=(i+j)%2?'#ffd2a0':'#c2410c';c.fill();}
        c.globalAlpha=1;
        c.beginPath();c.moveTo(r*.15,-r);c.lineTo(r*.62,-r*.62);c.lineTo(r*.62,r*.3);c.lineTo(r,r*.35);c.lineTo(r,-r);c.closePath();c.fillStyle='rgba(250,205,180,.85)';c.fill();
        c.strokeStyle='rgba(214,80,90,.8)';c.lineWidth=Math.max(.4,r*.03);
        for(let k=0;k<4;k++){c.beginPath();c.moveTo(r*.2+k*r*.07,-r*(.98-k*.06));c.lineTo(r*.66+k*r*.05,-r*(.62-k*.08));c.lineTo(r*.66+k*r*.05,r*.3);c.stroke();}
        for(let k=0;k<5;k++){c.beginPath();c.moveTo(r*.62,r*.3);c.lineTo(r,r*(.05+k*.12));c.stroke();}
        c.restore();
        c.beginPath();c.arc(-r*.04,r*.02,r*.88,0,TAU);c.strokeStyle='rgba(214,80,90,.75)';c.lineWidth=Math.max(.5,r*.04);c.stroke();
        const hex=(R,ox,oy)=>{c.beginPath();for(let k=0;k<6;k++){const a=Math.PI/2+k*Math.PI/3;c.lineTo(ox+Math.cos(a)*R*.88,oy+Math.sin(a)*R);}c.closePath();};
        const lx=-r*.1,ly=r*.04;
        hex(r*.48,lx,ly);c.fillStyle='#fde3bd';c.fill();c.strokeStyle='#d6505a';c.lineWidth=Math.max(.5,r*.04);c.stroke();
        hex(r*.34,lx,ly);c.fillStyle='#e0213f';c.fill();c.strokeStyle='#7f1d1d';c.stroke();
        const open=.09+Math.sin((t||0)*.002)*.03;
        c.strokeStyle='rgba(127,29,29,.9)';c.lineWidth=Math.max(.4,r*.025);
        for(let k=0;k<6;k++){const a=Math.PI/2+k*Math.PI/3,b=a+Math.PI/3+.5;c.beginPath();c.moveTo(lx+Math.cos(a)*r*.3,ly+Math.sin(a)*r*.34);c.lineTo(lx+Math.cos(b)*r*open,ly+Math.sin(b)*r*open);c.stroke();}
        hex(r*open,lx,ly);c.fillStyle='#1a0505';c.fill();
        c.restore();
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
        // Nave da Elite: octaedro verde com chevron e quatro hastes de pontas amarelo-limão.
        elite(c,col,t){
            engine(c,0,13,2.6,10,'#a7f3d0',t);
            [[-17,-14],[17,-13],[-15,16],[17,15]].forEach(([x,y])=>{
                const a=Math.atan2(y,x),nx=-Math.sin(a)*1.5,ny=Math.cos(a)*1.5;
                shade(c,[[nx,ny],[x+nx,y+ny],[x-nx,y-ny],[-nx,-ny]],'#3dd598');
                const tx=Math.cos(a),ty=Math.sin(a);
                shade(c,[[x+tx*4,y+ty*4],[x-ty*3.2,y+tx*3.2],[x+ty*3.2,y-tx*3.2]],'#8be32c');
                shade(c,[[x+tx*4,y+ty*4],[x-ty*3.2,y+tx*3.2],[x,y]],'#e3ff73',false);
            });
            const T=[0,-15],L=[-14,3],R=[14,-1],B=[3,15],C=[0,3];
            shade(c,[T,L,C],'#dcff7e',false);shade(c,[T,C,R],'#7dffd2',false);shade(c,[C,R,B],'#1e5136',false);shade(c,[L,C,B],'#3fd39b',false);
            c.strokeStyle=INK;poly(c,[T,R,B,L]);c.stroke();
            c.beginPath();c.moveTo(T[0],T[1]);c.lineTo(C[0],C[1]);c.lineTo(R[0],R[1]);c.moveTo(C[0],C[1]);c.lineTo(B[0],B[1]);c.strokeStyle='rgba(27,15,48,.35)';c.stroke();
            shade(c,[[-5,-6],[0,-3.4],[5,-7],[0,-1]],'#1f5a3c');
        },
        // Nave de Guerra (restaurada): disco voador perolado e iridescente, cúpula com escotilha circular e pernas angulares.
        war(c,col,t){
            engine(c,-6,15,2.8,10,'#c4b5fd',t);engine(c,6,15,2.8,10,'#c4b5fd',t);
            // pernas dobradas em quatro direções diagonais
            [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([sx,sy])=>{
                shade(c,[[11*sx,8*sy],[19*sx,13*sy],[21*sx,10*sy],[13*sx,5*sy]],'#d3d6e1');
                shade(c,[[19*sx,13*sy],[23*sx,19*sy],[26*sx,17*sy],[21*sx,10*sy]],'#b9bdcc');
                shade(c,[[22*sx,18*sy],[27*sx,21*sy],[28*sx,18*sy],[25*sx,16*sy]],'#9ea3b4');
            });
            // aba externa do disco
            const g=c.createLinearGradient(-20,-18,20,18);
            g.addColorStop(0,'#fbe3ee');g.addColorStop(.4,'#fbfbfd');g.addColorStop(.75,'#eef1f8');g.addColorStop(1,'#d6e4fb');
            c.beginPath();c.ellipse(0,0,20,18,0,0,TAU);c.fillStyle=g;c.fill();c.strokeStyle=INK;c.stroke();
            c.save();c.beginPath();c.ellipse(0,0,20,18,0,0,TAU);c.clip();
            c.beginPath();c.ellipse(7,7,18,16,0,0,TAU);c.fillStyle='rgba(150,160,190,.2)';c.fill();
            c.restore();
            // anel de painéis e luzes
            c.beginPath();c.ellipse(0,0,15,13.5,0,0,TAU);c.strokeStyle='rgba(110,118,145,.65)';c.stroke();
            c.lineWidth*=.6;c.beginPath();
            for(let k=0;k<12;k++){const a=k*TAU/12;c.moveTo(Math.cos(a)*15,Math.sin(a)*13.5);c.lineTo(Math.cos(a)*20,Math.sin(a)*18);}
            c.strokeStyle='rgba(110,118,145,.45)';c.stroke();c.lineWidth/=.6;
            for(let k=0;k<12;k++){const a=k*TAU/12+TAU/24;c.beginPath();c.arc(Math.cos(a)*17.5,Math.sin(a)*15.8,.9,0,TAU);c.fillStyle=(Math.floor((t||0)/300)+k)%4===0?'#f5d0fe':'#c4b5fd';c.fill();}
            // cúpula central
            const d=c.createRadialGradient(-4,-4,1,0,0,11);d.addColorStop(0,'#ffffff');d.addColorStop(.6,'#f3f1fa');d.addColorStop(1,'#d9dcea');
            c.beginPath();c.ellipse(0,0,11,10,0,0,TAU);c.fillStyle=d;c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.ellipse(-3.5,-4,3.5,2.2,-.5,0,TAU);c.fillStyle='rgba(255,215,235,.45)';c.fill();
            // escotilha circular
            c.beginPath();c.arc(0,0,5.4,0,TAU);c.fillStyle='#f4f5fa';c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.arc(0,0,3.6,0,TAU);c.strokeStyle='rgba(27,15,48,.7)';c.stroke();
            c.beginPath();c.arc(0,0,2.1,0,TAU);c.fillStyle='#e6e9f2';c.fill();c.strokeStyle='rgba(27,15,48,.45)';c.stroke();
        },
        // Excursão: mão de luz azul com veios verdes e punho cilíndrico.
        excursion(c,col,t){
            engine(c,0,17,4,11,'#5eead4',t);
            const BLUE='#3a86ee',GLOW='#2ef5a8',LINE='rgba(170,215,255,.85)';
            const finger=(x,y,len,w,ang)=>{
                c.save();c.translate(x,y);c.rotate(ang);
                c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w/2,-len+w/2);c.arc(0,-len+w/2,w/2,Math.PI,0);c.lineTo(w/2,0);c.closePath();
                c.fillStyle=BLUE;c.fill();c.strokeStyle='#1d4ed8';c.stroke();
                c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w/2,-len+w/2);c.arc(0,-len+w/2,w/2,Math.PI,Math.PI*1.5);c.lineTo(-w*.05,0);c.closePath();c.fillStyle=GLOW;c.globalAlpha=.85;c.fill();c.globalAlpha=1;
                c.beginPath();c.moveTo(-w/2,-len*.45);c.lineTo(w/2,-len*.45);c.moveTo(-w/2,-len*.75);c.lineTo(w/2,-len*.75);c.strokeStyle=LINE;c.lineWidth*=.5;c.stroke();c.lineWidth*=2;
                c.beginPath();c.ellipse(w*.12,-len+w*.9,w*.26,w*.42,0,0,TAU);c.fillStyle='#93d2ff';c.fill();
                c.restore();
            };
            // punho
            c.beginPath();c.moveTo(-5.5,7);c.lineTo(-5.5,15);c.ellipse(0,15,5.5,2.2,0,Math.PI,0,true);c.lineTo(5.5,7);c.closePath();c.fillStyle='#2f6fd6';c.fill();c.strokeStyle='#1d4ed8';c.stroke();
            c.beginPath();c.ellipse(0,15.4,4.6,1.8,0,0,TAU);c.fillStyle='#1e3a8a';c.fill();
            c.beginPath();c.rect(-3,14.8,6,1.2);c.fillStyle='#93c5fd';c.fill();
            c.beginPath();c.rect(-5.5,8,2.4,7);c.fillStyle=GLOW;c.globalAlpha=.8;c.fill();c.globalAlpha=1;
            // dedos
            finger(-6.2,-2,10,3.3,-.12);finger(-2.1,-3,12.5,3.4,-.03);finger(2.1,-3,12,3.4,.04);finger(6,-1.5,9.5,3.1,.13);
            // palma
            c.beginPath();c.moveTo(-8,-3);c.quadraticCurveTo(0,-5.5,8,-2.5);c.quadraticCurveTo(9,4,5.5,8);c.lineTo(-5.5,8);c.quadraticCurveTo(-9,4,-8,-3);c.closePath();
            c.fillStyle=BLUE;c.fill();c.strokeStyle='#1d4ed8';c.stroke();
            c.beginPath();c.moveTo(-8,-3);c.quadraticCurveTo(-9,4,-5.5,8);c.lineTo(-3,8);c.quadraticCurveTo(-5,2,-4,-3.5);c.closePath();c.fillStyle=GLOW;c.globalAlpha=.8;c.fill();c.globalAlpha=1;
            c.beginPath();c.moveTo(-2,6);c.quadraticCurveTo(1,1,5,-1);c.moveTo(0,-3.5);c.quadraticCurveTo(1,1,-1,5);c.strokeStyle=LINE;c.lineWidth*=.5;c.stroke();c.lineWidth*=2;
            // polegar
            finger(-7.5,4,9,3.3,-.95);
        },
        // Nave Rubi: cápsula magenta arredondada, visor amarelo triangular e duas aletas.
        ruby(c,col,t){
            engine(c,-3.5,12,2,7,'#ff7ab0',t);engine(c,3.5,12,2,7,'#ff7ab0',t);
            shade(c,[[-8,6],[-11,14],[-7.5,13],[-4.5,9]],'#c3005a');
            shade(c,[[8,6],[11,14],[7.5,13],[4.5,9]],'#74004a');
            const body=()=>{c.beginPath();c.moveTo(0,14);c.bezierCurveTo(-7,10,-13,4,-13,-3);c.bezierCurveTo(-13,-11,-7,-16,0,-16);c.bezierCurveTo(7,-16,13,-11,13,-3);c.bezierCurveTo(13,4,7,10,0,14);c.closePath();};
            body();c.fillStyle='#76004a';c.fill();
            c.save();body();c.clip();
            c.beginPath();c.moveTo(-20,-20);c.lineTo(-1,-17);c.bezierCurveTo(-8,-8,-8,6,-1,15);c.lineTo(-20,20);c.closePath();c.fillStyle='#c4005a';c.fill();
            c.beginPath();c.moveTo(-14,-4.5);c.quadraticCurveTo(0,-8,14,-4.5);c.strokeStyle='#a3003f';c.lineWidth*=.5;c.stroke();c.lineWidth*=2;
            c.restore();
            body();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.moveTo(-8.5,-7);c.quadraticCurveTo(0,-8.2,8.5,-7.2);c.quadraticCurveTo(8.8,-6.4,8,-5.6);c.lineTo(0.8,0.6);c.quadraticCurveTo(0,1.3,-0.8,0.6);c.lineTo(-8.4,-5.8);c.quadraticCurveTo(-9.2,-6.6,-8.5,-7);c.closePath();
            c.fillStyle='#fbe98e';c.fill();
            c.save();c.clip();c.beginPath();c.moveTo(-10,-9);c.lineTo(-2,-9);c.lineTo(-6,-1);c.lineTo(-10,-1);c.closePath();c.fillStyle='#ffffc2';c.fill();c.restore();
        },
        // Nave de carga: torpedo amarelo com faixas castanhas, anel frontal e aleta traseira curva.
        cargo(c,col,t){
            engine(c,-3.5,15,2.4,9,'#ffd27a',t);engine(c,3.5,15,2.4,9,'#ffd27a',t);
            const hull=()=>{c.beginPath();c.moveTo(0,-19);c.bezierCurveTo(5,-15,7.5,-7,7.5,2);c.bezierCurveTo(7.5,9,6,13,4.5,14.5);c.quadraticCurveTo(0,16,-4.5,14.5);c.bezierCurveTo(-6,13,-7.5,9,-7.5,2);c.bezierCurveTo(-7.5,-7,-5,-15,0,-19);c.closePath();};
            shade(c,[[6.5,4],[9.5,5],[9.5,8.5],[6.5,8]],'#e8b878');
            hull();c.fillStyle='#fbe27a';c.fill();
            c.save();hull();c.clip();
            c.fillStyle='#fef9c3';c.fillRect(-8,-20,4.2,36);
            c.fillStyle='#cd9065';c.fillRect(3.6,-20,5,36);
            c.restore();
            hull();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.ellipse(1.2,4,1,4,0,0,TAU);c.fillStyle='#8a5a3a';c.fill();
            shade(c,[[-9.5,-6.5],[9.5,-6.5],[9.5,-2.5],[-9.5,-2.5]],'#fbe27a');
            shade(c,[[-9.5,-6.5],[-7,-6.5],[-7,-2.5],[-9.5,-2.5]],'#cd9065');shade(c,[[7,-6.5],[9.5,-6.5],[9.5,-2.5],[7,-2.5]],'#cd9065');
            c.beginPath();c.moveTo(-10.5,12.5);c.quadraticCurveTo(0,15.5,10.5,12.5);c.lineTo(10.5,15);c.quadraticCurveTo(0,18,-10.5,15);c.closePath();c.fillStyle='#f5d36a';c.fill();c.strokeStyle=INK;c.stroke();
            c.beginPath();c.moveTo(-10.5,15);c.quadraticCurveTo(0,18,10.5,15);c.lineTo(10.5,16);c.quadraticCurveTo(0,19,-10.5,16);c.closePath();c.fillStyle='#cd9065';c.fill();c.stroke();
        },
        // Olho Vermelho: sonda circular creme e laranja com lente hexagonal.
        redeye(c,col,t){drawRedEye(c,0,0,12,t);},
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

    // ------------------------------------------------------------------
    // Estruturas: arquitetura Gem (blocos facetados em tons pastel,
    // costuras tracejadas, antenas listradas, pilares de cristal).
    // Quadro: base em (0,12), largura ±24, altura até ~ -46.
    // ------------------------------------------------------------------
    const css=a=>'rgb('+a.map(v=>Math.round(Math.max(0,Math.min(255,v)))).join(',')+')';
    function structPalette(pal){
        const ruler=hex(pal?.color||'#b9a4f0');
        const base=mix(ruler,hex('#d9ccff'),.5);
        const blue=mix(hex('#8ea6f2'),ruler,.2),pink=mix(hex('#f2a9d6'),ruler,.2);
        const tri=b=>({light:css(mix(b,[255,255,255],.5)),mid:css(b),dark:css(mix(b,hex('#2e2160'),.42)),deep:css(mix(b,hex('#1b1240'),.65))});
        return {main:tri(base),blue:tri(blue),pink:tri(pink),glow:pal?.glow||'#7dd3fc',accent:pal?.accent||'#e9ddff',ruler:css(ruler)};
    }
    function seam(c,pts,closed){c.save();c.setLineDash([1.6,1.4]);c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.55;c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);if(closed)c.closePath();c.stroke();c.restore();}
    function face(c,pts,fill,edge){poly(c,pts);c.fillStyle=fill;c.fill();c.strokeStyle=edge||'rgba(27,15,48,.55)';c.lineWidth=.7;c.stroke();}
    // Bloco isométrico: centro da base (x,y), meia-largura w, profundidade d, altura h.
    function block(c,x,y,w,d,h,t,roof){
        const L=[x-w,y],F=[x,y+d],R=[x+w,y],B=[x,y-d],up=p=>[p[0],p[1]-h];
        face(c,[L,F,up(F),up(L)],t.mid);face(c,[F,R,up(R),up(F)],t.dark);
        if(roof){const apex=[x,y-h-roof];face(c,[up(L),up(F),apex],t.light);face(c,[up(F),up(R),apex],t.mid);seam(c,[up(F),apex]);}
        else{face(c,[up(L),up(F),up(R),up(B)],t.light);seam(c,[[x-w*.7,y-h],[x,y-h+d*.7],[x+w*.7,y-h]]);}
        seam(c,[[x-w+1,y-h*.5],[x,y+d-h*.5],[x+w-1,y-h*.5]]);
        return {top:y-h};
    }
    function windows(c,x0,y0,cols,rows,dx,dy,slope,color){c.fillStyle=color||'rgba(27,15,48,.55)';for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){c.beginPath();c.arc(x0+i*dx,y0+j*dy+i*slope,.7,0,TAU);c.fill();}}
    function antenna(c,x,y,h,col){
        const w=1.6;poly(c,[[x-w,y],[x+w,y],[x+.4,y-h],[x-.4,y-h]]);c.fillStyle='#e9e4fb';c.fill();c.strokeStyle='rgba(27,15,48,.5)';c.lineWidth=.5;c.stroke();
        c.fillStyle=col||'#38bdf8';for(let k=1;k<4;k++){const yy=y-h*k/4;c.fillRect(x-w*(1-k/4.5),yy-1,w*2*(1-k/4.5),1.3);}
    }
    function prism(c,x,y,w,h,t){ // pilar de cristal hexagonal visto de frente
        const cap=w*.9;
        face(c,[[x-w,y],[x-w,y-h],[x,y-h-cap],[x,y]],t.mid);face(c,[[x,y],[x,y-h-cap],[x+w,y-h],[x+w,y]],t.dark);
        face(c,[[x-w,y-h],[x,y-h-cap*2.2],[x+w,y-h],[x,y-h-cap]],t.light);
    }
    function plate(c,t,r){r=r||24;face(c,[[-r,12],[0,12+r*.4],[0,15+r*.4],[-r,15]],t.dark);face(c,[[0,12+r*.4],[r,12],[r,15],[0,15+r*.4]],t.deep);face(c,[[-r,12],[0,12-r*.38],[r,12],[0,12+r*.4]],t.light);seam(c,[[-r*.75,12],[0,12-r*.28],[r*.75,12],[0,12+r*.3]],true);}
    function glowDot(c,x,y,r,col,active){c.save();if(active){c.shadowColor=col;c.shadowBlur=r*3;}c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=col;c.fill();c.restore();}
    function gemTop(c,x,y,s,col,dark){ // gema alongada (como a do Injetor)
        face(c,[[x,y-s*1.5],[x+s*.75,y-s*.9],[x+s*.75,y+s*.55],[x,y+s*1.05],[x-s*.75,y+s*.55],[x-s*.75,y-s*.9]],col,'rgba(60,8,24,.8)');
        face(c,[[x,y-s*1.5],[x+s*.75,y-s*.9],[x+s*.2,y-s*.5],[x-s*.3,y-s*.95]],'rgba(255,255,255,.35)',null);
        face(c,[[x+s*.75,y-s*.9],[x+s*.75,y+s*.55],[x,y+s*1.05],[x+s*.2,y-s*.5]],dark,'rgba(60,8,24,.6)');
    }
    const STRUCTURE_ART={
        essence_chamber(c,P,a,t){plate(c,P.main);block(c,0,10,15,6,16,P.main,16);
            glowDot(c,0,-8,4,P.glow,a);face(c,[[-4,-8],[0,-14],[4,-8],[0,-2]],'rgba(255,255,255,.65)');
            prism(c,-12,6,2.6,10,P.pink);prism(c,12,6,2.6,10,P.pink);antenna(c,0,-26,10,P.ruler);},
        injector(c,P,a,t){
            // pernas de aranha e broca
            c.strokeStyle='#2b2b33';c.lineWidth=2;c.lineCap='round';
            [[-1,[-12,4],[-20,26]],[1,[12,4],[22,20]],[-1,[-7,8],[-10,30]],[1,[7,8],[9,30]]].forEach(([s,k,f])=>{c.beginPath();c.moveTo(s*5,10);c.lineTo(k[0],k[1]);c.lineTo(f[0],f[1]);c.stroke();});
            face(c,[[-7,10],[7,10],[5,14],[-5,14]],'#3a3a44','#111');face(c,[[-2,14],[2,14],[0,24]],'#2b2b33','#111');
            // cilindro com fluido
            face(c,[[-6,-20],[6,-20],[6,10],[-6,10]],'#3b3b45','#111');
            face(c,[[-5.2,-17],[0.5,-17],[0.5,7],[-5.2,7]],'rgba(190,240,255,.55)','#111');
            c.save();poly(c,[[-5,-16.5],[0.3,-16.5],[0.3,6.5],[-5,6.5]]);c.clip();c.strokeStyle='#b07ad6';c.lineWidth=2.2;
            for(let k=0;k<3;k++){c.beginPath();for(let yy=-17;yy<=8;yy+=1){const xx=-2.4+Math.sin(yy*.45+k*2+(t||0)*.003)*2;yy===-17?c.moveTo(xx,yy):c.lineTo(xx,yy);}c.stroke();}c.restore();
            c.strokeStyle='#5b5b66';c.lineWidth=.8;c.beginPath();c.moveTo(2.5,-18);c.lineTo(2.5,8);c.moveTo(4.4,-16);c.lineTo(4.4,6);c.stroke();
            face(c,[[-7,-23],[7,-23],[6,-19],[-6,-19]],'#26262e','#111');
            gemTop(c,0,-34,7.5,'#e11d48','#9f1239');
            if(a)glowDot(c,0,-34,1.4,'#fecdd3',true);},
        reef(c,P,a,t){plate(c,P.blue);
            [[-10,6,9],[8,7,8],[0,0,11]].forEach(([x,y,r])=>{c.beginPath();c.ellipse(x,y,r,r*.75,0,Math.PI,TAU);c.closePath();c.fillStyle=P.pink.light;c.fill();c.strokeStyle='rgba(27,15,48,.5)';c.lineWidth=.7;c.stroke();
                for(let k=1;k<4;k++){c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(Math.PI+k*Math.PI/4)*r,y+Math.sin(Math.PI+k*Math.PI/4)*r*.75);c.strokeStyle='rgba(180,120,170,.55)';c.stroke();}});
            [[-4,-4],[4,-2],[-12,2]].forEach(([x,y])=>{const g=c.createRadialGradient(x-1,y-1,.3,x,y,2.6);g.addColorStop(0,'#fff');g.addColorStop(1,'#e9d5ff');c.beginPath();c.arc(x,y,2.4,0,TAU);c.fillStyle=g;c.fill();c.strokeStyle='rgba(27,15,48,.4)';c.stroke();});
            prism(c,15,8,2,12,P.blue);prism(c,-17,9,1.8,9,P.blue);},
        mineral_extractor(c,P,a,t){plate(c,P.main);
            c.strokeStyle=P.main.deep;c.lineWidth=2;[[-16,12],[16,12],[0,18]].forEach(([x,y])=>{c.beginPath();c.moveTo(0,-26);c.lineTo(x,y);c.stroke();});
            block(c,0,-4,8,3.5,10,P.main,6);
            const spin=(t||0)*.01;face(c,[[-3,0],[3,0],[0,14]],P.blue.light);c.strokeStyle=P.blue.dark;c.lineWidth=.7;for(let k=0;k<3;k++){const yy=2+((k*4+spin*6)%12);c.beginPath();c.moveTo(-3+yy*.2,yy);c.lineTo(3-yy*.2,yy+1.2);c.stroke();}
            antenna(c,0,-20,10,P.ruler);},
        workshop(c,P,a,t){plate(c,P.blue);block(c,-6,10,14,5,18,P.blue);windows(c,-18,-4,6,4,2.2,2.6,.8);
            block(c,12,11,8,4,11,P.pink,7);antenna(c,-15,-6,10,'#38bdf8');antenna(c,-2,-3,9,'#38bdf8');
            c.strokeStyle=a?P.glow:'rgba(200,180,255,.5)';c.lineWidth=1.3;c.beginPath();c.moveTo(-24,4);c.quadraticCurveTo(0,-14,24,0);c.stroke();},
        refinery(c,P,a,t){plate(c,P.main);
            [-8,8].forEach((x,i)=>{block(c,x,10-i,6,3,22+i*5,i?P.pink:P.main,8);c.fillStyle=a?'#fb923c':'#7c5a4a';c.fillRect(x-4,-4-i*2,3,8);});
            if(a){const f=1+Math.sin((t||0)*.01)*.25;glowDot(c,8,-32,2.4*f,'rgba(251,146,60,.8)',true);}
            antenna(c,-8,-20,7,'#fb923c');},
        research_center(c,P,a,t){plate(c,P.blue);
            c.beginPath();c.moveTo(-18,10);c.lineTo(-16,-2);c.lineTo(-8,-12);c.lineTo(8,-12);c.lineTo(16,-2);c.lineTo(18,10);c.closePath();c.fillStyle=P.blue.mid;c.fill();c.strokeStyle='rgba(27,15,48,.55)';c.lineWidth=.7;c.stroke();
            face(c,[[-8,-12],[0,-18],[8,-12],[0,-6]],P.blue.light);face(c,[[8,-12],[16,-2],[18,10],[6,10],[0,-6]],P.blue.dark);seam(c,[[-16,-2],[16,-2]]);
            c.strokeStyle='#e9e4fb';c.lineWidth=1.2;c.beginPath();c.moveTo(0,-18);c.lineTo(0,-40);c.stroke();
            c.strokeStyle=a?P.glow:P.blue.light;c.lineWidth=1;c.beginPath();c.ellipse(0,-30,10,3,-.25+(t||0)*.0005,0,TAU);c.stroke();glowDot(c,0,-41,2,P.glow,a);},
        reactor(c,P,a,t){plate(c,P.main);
            prism(c,-12,10,3.4,18,P.pink);prism(c,12,10,3.4,20,P.blue);prism(c,-5,4,3,26,P.blue);prism(c,6,5,3,24,P.pink);
            glowDot(c,0,-6,5+(a?Math.sin((t||0)*.006):0),a?P.glow:P.main.mid,a);glowDot(c,0,-6,2,'#fff',a);},
        defense_tower(c,P,a,t){plate(c,P.main,16);
            // haste helicoidal
            c.strokeStyle=P.main.deep;c.lineWidth=2.2;for(let k=0;k<2;k++){c.beginPath();for(let yy=12;yy>=-12;yy-=1){const xx=Math.sin(yy*.35+k*Math.PI)*3.2;yy===12?c.moveTo(xx,yy):c.lineTo(xx,yy);}c.stroke();}
            c.strokeStyle=P.main.dark;c.lineWidth=1;c.beginPath();c.moveTo(0,12);c.lineTo(0,-12);c.stroke();
            // cabeça facetada
            const D='#4b4f6a',M='#5d627f',Lt='#7a7f9e';
            face(c,[[-4,-12],[4,-12],[7,-17],[-7,-17]],D);
            face(c,[[-7,-17],[-10,-26],[-6,-36],[0,-38],[0,-17]],M);face(c,[[7,-17],[10,-26],[6,-36],[0,-38],[0,-17]],D);
            face(c,[[-6,-36],[0,-50],[0,-38]],Lt);face(c,[[6,-36],[0,-50],[0,-38]],M);
            seam(c,[[-10,-26],[10,-26]]);glowDot(c,-4,-26,.9,a?'#fecaca':'#222',a);glowDot(c,4,-26,.9,a?'#fecaca':'#222',a);
            [-1,1].forEach(s=>face(c,[[8*s,-30],[12*s,-34],[9*s,-26]],Lt));},
        galaxy_warp(c,P,a,t){
            // plataforma circular escura com plataformas de dobra
            c.beginPath();c.ellipse(0,10,25,10,0,0,TAU);c.fillStyle='#24345e';c.fill();c.strokeStyle='#0c1530';c.lineWidth=.9;c.stroke();
            c.beginPath();c.ellipse(0,7,25,10,0,0,TAU);c.fillStyle='#1b2a52';c.fill();c.strokeStyle='#cbd5f5';c.lineWidth=.6;c.stroke();
            c.strokeStyle='rgba(220,225,255,.55)';c.lineWidth=.5;c.beginPath();c.ellipse(0,7,9,3.6,0,0,TAU);c.stroke();c.beginPath();c.ellipse(0,7,17,6.8,0,0,TAU);c.stroke();
            const pads=[[0,7,3.4],[-11,4,1.8],[11,4,1.8],[-15,9,1.6],[15,9,1.6],[-6,12,1.6],[6,12,1.6],[-6,2,1.4],[7,2,1.4]];
            c.beginPath();pads.slice(1).forEach(([x,y])=>{c.moveTo(0,7);c.lineTo(x,y);});c.stroke();
            pads.forEach(([x,y,r],i)=>{c.beginPath();c.ellipse(x,y,r*1.4,r*.6,0,0,TAU);c.fillStyle=i?'#c4b5fd':'#f5f3ff';c.fill();c.strokeStyle='#e9ddff';c.stroke();});
            if(a){const p=((t||0)*.002)%1;c.save();c.globalAlpha=.6*(1-p);c.beginPath();c.ellipse(0,7-p*18,4.8,2,0,0,TAU);c.strokeStyle=P.glow;c.lineWidth=1.2;c.stroke();c.restore();
                const g=c.createLinearGradient(0,7,0,-24);g.addColorStop(0,'rgba(233,221,255,.7)');g.addColorStop(1,'rgba(233,221,255,0)');c.fillStyle=g;c.fillRect(-4.5,-24,9,31);}
            // pilares de pedra ao redor
            [[-22,7,10],[22,7,10],[-13,0,14],[13,0,14],[0,-3,18]].forEach(([x,y,h])=>{face(c,[[x-2.6,y],[x-2,y-h],[x,y-h-3],[x,y]],'#e7e3f4');face(c,[[x,y],[x,y-h-3],[x+2,y-h],[x+2.6,y]],'#a9a6c4');});
            [[-18,13,8],[18,13,8]].forEach(([x,y,h])=>{face(c,[[x-2.4,y],[x-1.8,y-h],[x,y-h-2.5],[x,y]],'#dad5ee');face(c,[[x,y],[x,y-h-2.5],[x+1.8,y-h],[x+2.4,y]],'#3c3f63');});},
        shipyard(c,P,a,t){plate(c,P.blue);
            // telhado nervurado
            for(let k=0;k<6;k++){const x=-18+k*6.5;face(c,[[x,10],[x+5,10],[x+3,-10-k*1.2],[x-1,-8-k*1.2]],k%2?P.blue.dark:P.blue.mid);}
            seam(c,[[-19,-2],[19,-6]]);
            c.strokeStyle='#e9e4fb';c.lineWidth=1.3;c.beginPath();c.moveTo(16,10);c.lineTo(20,-22);c.lineTo(4,-26);c.stroke();
            c.save();c.translate(2,-30);c.rotate(-.2);c.beginPath();c.ellipse(0,0,6,3,0,0,TAU);c.fillStyle='#f8fafc';c.fill();c.strokeStyle='rgba(27,15,48,.6)';c.lineWidth=.6;c.stroke();c.restore();
            antenna(c,-15,-12,9,'#38bdf8');},
        bubble_room(c,P,a,t){plate(c,P.pink);block(c,0,10,14,5,12,P.pink,9);
            [[-9,-20,5],[6,-26,6],[12,-14,4]].forEach(([x,y,r],i)=>{const yy=y+Math.sin((t||0)*.002+i*2)*1.5;c.beginPath();c.arc(x,yy,r,0,TAU);c.fillStyle='rgba(244,168,228,.28)';c.fill();c.strokeStyle='rgba(253,224,255,.85)';c.lineWidth=.8;c.stroke();
                face(c,[[x,yy-r*.4],[x+r*.3,yy],[x,yy+r*.4],[x-r*.3,yy]],['#38bdf8','#f43f5e','#34d399'][i]);c.beginPath();c.arc(x-r*.4,yy-r*.4,r*.18,0,TAU);c.fillStyle='rgba(255,255,255,.8)';c.fill();});},
        shield_generator(c,P,a,t){plate(c,P.blue);block(c,0,10,6,3,22,P.blue,8);
            face(c,[[0,-40],[4,-34],[0,-28],[-4,-34]],'#bfdbfe');
            c.save();c.strokeStyle=a?P.glow:'rgba(147,197,253,.4)';c.lineWidth=1.4;c.globalAlpha=a?.8:.5;c.beginPath();c.ellipse(0,4,26,30,0,Math.PI*1.05,Math.PI*1.95);c.stroke();c.globalAlpha=.15;c.beginPath();c.ellipse(0,4,26,30,0,Math.PI,TAU);c.fillStyle=P.glow;c.fill();c.restore();},
        royal_palace(c,P,a,t){
            // salão iluminado com piso de luz
            face(c,[[-26,12],[0,1],[26,12],[0,23]],P.main.dark);
            const tiles=['#fdf4ff','#f0abfc','#a5f3fc','#c4b5fd'];
            for(let i=0;i<2;i++)for(let j=0;j<2;j++){const ox=(i-j)*9,oy=(i+j)*4.2+3;face(c,[[ox-9,oy+4.2],[ox,oy],[ox+9,oy+4.2],[ox,oy+8.4]],tiles[(i*2+j)%4],'rgba(27,15,48,.4)');}
            block(c,-17,6,6,3,16,P.pink,6);block(c,17,6,6,3,18,P.blue,6);
            antenna(c,-19,-14,9,'#38bdf8');antenna(c,19,-16,9,'#38bdf8');
            // torre central com coroa de pétalas
            block(c,0,0,7,3.5,22,P.main);
            const cy=-30;[[-11,cy+2],[-6,cy-6],[0,cy-9],[6,cy-6],[11,cy+2]].forEach(([x,y],i)=>face(c,[[x*.3,cy+6],[x,y],[x*.55,y-6],[0,cy-1]],i%2?P.main.light:'#ffffff'));
            face(c,[[-7,cy+6],[0,cy+1],[7,cy+6],[0,cy+10]],P.main.light);
            glowDot(c,0,cy-2,2.2,P.ruler,a);},
        diamond_quarters(c,P,a,t){plate(c,P.main,16);block(c,0,8,7,3.5,30,P.main,10);windows(c,-5,-14,3,4,2.2,3,.7,'rgba(255,255,255,.55)');face(c,[[0,-32],[3,-28],[0,-24],[-3,-28]],P.ruler);},
        zoo(c,P,a,t){plate(c,P.blue);block(c,0,11,15,5,6,P.blue);
            [[-9,-2,7,'#4ade80'],[7,-4,8,'#38bdf8'],[-1,-14,7,'#f472b6']].forEach(([x,y,r,col],i)=>{
                c.save();c.beginPath();c.arc(x,y,r,0,TAU);c.clip();c.fillStyle='rgba(30,20,60,.55)';c.fillRect(x-r,y-r,2*r,2*r);
                c.fillStyle=col;c.beginPath();c.ellipse(x,y+r*.7,r*1.1,r*.5,0,0,TAU);c.fill();
                c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.ellipse(x+Math.sin((t||0)*.002+i)*r*.3,y+r*.1,r*.22,r*.15,0,0,TAU);c.fill();c.restore();
                c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle='rgba(200,240,255,.18)';c.fill();c.strokeStyle='rgba(233,221,255,.9)';c.lineWidth=.8;c.stroke();
                c.beginPath();c.arc(x-r*.35,y-r*.35,r*.18,0,TAU);c.fillStyle='rgba(255,255,255,.75)';c.fill();});
            antenna(c,13,4,8,'#4ade80');},
        lunar_base(c,P,a,t){plate(c,P.blue);c.beginPath();c.ellipse(0,6,16,14,0,Math.PI,TAU);c.closePath();c.fillStyle=P.blue.light;c.fill();c.strokeStyle='rgba(27,15,48,.55)';c.lineWidth=.7;c.stroke();seam(c,[[-12,-2],[12,-2]]);seam(c,[[0,-8],[0,6]]);antenna(c,10,-4,10,'#38bdf8');},
        default(c,P,a,t){plate(c,P.main);block(c,0,10,12,5,16,P.main,8);}
    };
    // Edifícios decorativos da cidade (crescem com o desenvolvimento da colônia).
    const CITY_ART={
        house(c,P,v){block(c,0,0,4,1.8,4+v*2,v>.5?P.pink:P.main,3);},
        block(c,P,v){const h=7+v*5;block(c,0,0,5,2.2,h,v>.5?P.blue:P.main);windows(c,-4,-h+2,3,Math.floor(h/3),1.6,2.4,.5,'rgba(255,255,255,.55)');},
        tower(c,P,v){const h=13+v*9;block(c,0,0,3.6,1.6,h,v>.5?P.blue:P.pink,4);windows(c,-2.6,-h+3,2,Math.floor(h/3.2),1.6,2.8,.5,'rgba(255,255,255,.6)');},
        pillar(c,P,v){prism(c,-2.2,0,1.6,8+v*4,P.pink);prism(c,2,1,1.8,11+v*5,P.blue);},
        spire(c,P,v){block(c,0,0,2.6,1.2,10+v*6,P.main,9);antenna(c,0,-(19+v*6),6,'#38bdf8');},
        dome(c,P,v){c.beginPath();c.ellipse(0,0,5.5,5,0,Math.PI,TAU);c.closePath();c.fillStyle=P.blue.light;c.fill();c.strokeStyle='rgba(27,15,48,.5)';c.lineWidth=.6;c.stroke();seam(c,[[0,-5],[0,0]]);},
        ribs(c,P,v){for(let k=0;k<4;k++){const x=-6+k*3.2;face(c,[[x,0],[x+2.6,0],[x+1.6,-7-k],[x-.6,-6-k]],k%2?P.blue.dark:P.blue.mid);}},
        plaza(c,P,v){const tiles=['#fdf4ff','#f0abfc','#a5f3fc','#c4b5fd'];for(let i=0;i<2;i++)for(let j=0;j<2;j++){const ox=(i-j)*3.5,oy=(i+j)*1.6-1.6;face(c,[[ox-3.5,oy+1.6],[ox,oy],[ox+3.5,oy+1.6],[ox,oy+3.2]],tiles[(i*2+j+Math.floor(v*4))%4],'rgba(27,15,48,.35)');}},
        ruin(c,P,v){face(c,[[-4,0],[0,1.8],[0,-3-v*3],[-1.5,-4-v*2],[-4,-2.5]],P.main.dark);face(c,[[0,1.8],[4,0],[4,-2],[2.5,-1],[1.2,-3.5-v*3],[0,-3-v*3]],P.main.deep);
            c.fillStyle='rgba(27,15,48,.45)';[[-5,1],[5,1.2],[3,2]].forEach(([x,y])=>{c.beginPath();c.arc(x,y,.8,0,TAU);c.fill();});},
        statue(c,P,v){face(c,[[-3,0],[3,0],[2,-3],[-2,-3]],P.main.dark);face(c,[[-2,-3],[2,-3],[1.4,-12],[-1.4,-12]],'#f5f3ff');
            [[-4,-15],[-2,-18],[0,-19.5],[2,-18],[4,-15]].forEach(([x,y],i)=>face(c,[[x*.3,-12],[x,y],[x*.5,y-2.5],[0,-13]],i%2?'#ede9fe':'#ffffff'));}
    };
    function drawCityBuilding(c,kind,opts={}){
        const art=CITY_ART[kind]||CITY_ART.house;
        c.save();c.translate(opts.x||0,opts.y||0);const s=opts.scale||1;c.scale(s,s);c.lineJoin='round';
        art(c,opts.pal||structPalette(opts.palette),opts.variant||0);
        if(opts.lit){c.fillStyle='rgba(255,236,170,.9)';c.beginPath();c.arc(.8,-3,.55,0,TAU);c.fill();}
        c.restore();
    }
    function drawStructure(c,id,opts={}){
        const art=STRUCTURE_ART[id]||STRUCTURE_ART.default;
        c.save();c.translate(opts.x||0,opts.y||0);const s=opts.scale||1;c.scale(s,s);
        c.lineJoin='round';c.lineCap='round';
        if(opts.active===false)c.globalAlpha=.72;
        if(opts.active!==false&&opts.glow!==false){c.shadowColor='rgba(201,166,255,.35)';c.shadowBlur=4;}
        art(c,structPalette(opts.palette),opts.active!==false,opts.time||0);
        c.restore();
    }
    function paintStructurePreviews(root){
        (root||document).querySelectorAll('canvas.structure-preview:not([data-painted])').forEach(cv=>{
            const w=cv.width,h=cv.height,c=cv.getContext('2d');
            const bg=c.createRadialGradient(w/2,h*.55,2,w/2,h*.55,w*.6);bg.addColorStop(0,'rgba(140,92,220,.32)');bg.addColorStop(1,'rgba(20,10,40,0)');c.fillStyle=bg;c.fillRect(0,0,w,h);
            let pal=null;try{if(typeof getPlanetRulerColors==='function')pal=getPlanetRulerColors(PLANETS[state.activeColonyPlanetId||'homeworld']);}catch(e){}
            drawStructure(c,cv.dataset.structure,{x:w/2,y:h*.62,scale:Math.min(w,h)/68,palette:pal,time:0});
            cv.setAttribute('data-painted','1');
        });
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
        paintShipPreviews(document);paintStructurePreviews(document);
        new MutationObserver(()=>{paintShipPreviews(document);paintStructurePreviews(document);}).observe(document.body,{childList:true,subtree:true});
    }
    if(document.body)watchShipPreviews();else document.addEventListener('DOMContentLoaded',watchShipPreviews);

        function setQuality(q){
        if(!QUALITY[q])q='medium';if(q===QUALITY_KEY)return false;
        QUALITY_KEY=q;TEX_W=QUALITY[q].w;TEX_H=QUALITY[q].h;MAX_RES=QUALITY[q].max;
        TEXTURE_CACHE.clear();GEM_COVER_CACHE.clear();DAMAGE_CACHE.clear();SPHERE_CACHE.clear();PENDING.clear();LAST_GLOBE=null;
        try{window.dispatchEvent(new CustomEvent('gempire-quality',{detail:q}));}catch(e){}
        return true;
    }
    window.GempirePlanetArt={setQuality,getQuality:()=>QUALITY_KEY,drawPlanet,drawSpaceBackground,drawStar,drawShip,drawRedEye,drawStructure,paintStructurePreviews,drawCityBuilding,structPalette,surfaceQuery,paintShipPreviews,BIOMES,_cache:{TEXTURE_CACHE,SPHERE_CACHE}};
})();
