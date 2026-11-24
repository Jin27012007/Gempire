/* =========================================================================
 * GEMPIRE · Seletor de quantidade sem teclado
 *
 * Todo <input type="number"> do jogo vira um seletor tocável: botões − e +
 * (segurar acelera), botão "Máx" quando há limite, e uma barra deslizante para
 * faixas grandes. O campo original continua no DOM (oculto) guardando o valor,
 * então o código do jogo segue lendo input.value e recebendo onchange.
 * ========================================================================= */
(function(){
    'use strict';
    const num=(v,d)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
    function limits(input){
        const min=num(input.min===''?undefined:input.min,0),maxAttr=input.max===''?undefined:input.max;
        const max=maxAttr===undefined?Infinity:num(maxAttr,Infinity),step=Math.max(1,num(input.step,1));
        return {min,max:Math.max(min,max),step};
    }
    function clamp(input,v){const {min,max,step}=limits(input);v=Math.round((v-min)/step)*step+min;return Math.max(min,Math.min(max,v));}
    function setValue(input,v,ui){
        v=clamp(input,v);
        if(String(v)===input.value){ui&&refresh(input,ui);return;}
        input.value=String(v);
        refresh(input,ui);
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function refresh(input,ui){
        if(!ui)return;
        const {min,max}=limits(input),v=clamp(input,num(input.value,min));
        ui.val.textContent=v.toLocaleString('pt-BR');
        ui.minus.disabled=input.disabled||v<=min;ui.plus.disabled=input.disabled||v>=max;
        if(ui.maxBtn){ui.maxBtn.disabled=input.disabled||v>=max;}
        if(ui.zeroBtn){ui.zeroBtn.disabled=input.disabled||v<=min;}
        if(ui.range){ui.range.min=min;ui.range.max=max;ui.range.value=v;ui.range.disabled=input.disabled;ui.range.style.setProperty('--fill',((v-min)/Math.max(1,max-min)*100)+'%');}
    }
    // Segurar o botão repete o passo, cada vez mais rápido e com passos maiores.
    function holdRepeat(btn,input,ui,dir){
        let timer=null,count=0;
        const tick=()=>{
            const {max,min,step}=limits(input),span=Number.isFinite(max)?max-min:1000;
            const big=count>20?Math.max(step,Math.round(span/40)):count>8?Math.max(step,Math.round(span/200))||step:step;
            setValue(input,num(input.value,min)+dir*big,ui);count++;
            timer=setTimeout(tick,count<2?350:count<8?90:50);
        };
        const stop=()=>{clearTimeout(timer);timer=null;count=0;};
        btn.addEventListener('pointerdown',e=>{if(btn.disabled)return;e.preventDefault();stop();tick();});
        ['pointerup','pointerleave','pointercancel'].forEach(t=>btn.addEventListener(t,stop));
        btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setValue(input,num(input.value,0)+dir*limits(input).step,ui);}});
    }
    function enhance(input){
        if(input.dataset.gstep||input.type!=='number')return;
        input.dataset.gstep='1';
        const {min,max}=limits(input);
        const wrap=document.createElement('span');wrap.className='gstep';
        const row=document.createElement('span');row.className='gstep-row';
        const mk=(cls,label,aria)=>{const b=document.createElement('button');b.type='button';b.className='gstep-btn '+cls;b.textContent=label;b.setAttribute('aria-label',aria);return b;};
        const minus=mk('gstep-minus','−','Diminuir'),plus=mk('gstep-plus','+','Aumentar');
        const val=document.createElement('output');val.className='gstep-val';
        row.append(minus,val,plus);
        const ui={minus,plus,val};
        if(Number.isFinite(max)&&max-min>=3){
            ui.zeroBtn=mk('gstep-zero',min>0?'Mín':'0','Valor mínimo');ui.maxBtn=mk('gstep-max','Máx','Valor máximo');
            row.append(ui.zeroBtn,ui.maxBtn);
            ui.zeroBtn.addEventListener('click',()=>setValue(input,min,ui));
            ui.maxBtn.addEventListener('click',()=>setValue(input,max,ui));
        }
        wrap.append(row);
        // Faixas grandes ganham barra deslizante para escolher rápido (ex.: milhares de Gems).
        if(Number.isFinite(max)&&max-min>10){
            const r=document.createElement('input');r.type='range';r.className='gstep-range';r.step=limits(input).step;
            r.addEventListener('input',()=>setValue(input,num(r.value,min),ui));
            ui.range=r;wrap.append(r);
        }
        holdRepeat(minus,input,ui,-1);holdRepeat(plus,input,ui,1);
        input.classList.add('gstep-source');input.tabIndex=-1;input.setAttribute('aria-hidden','true');input.readOnly=true;input.setAttribute('inputmode','none');
        input.insertAdjacentElement('afterend',wrap);
        // Mantém o seletor em dia se o jogo mudar o valor ou os limites por código.
        new MutationObserver(()=>refresh(input,ui)).observe(input,{attributes:true,attributeFilter:['max','min','value','disabled']});
        input.addEventListener('change',()=>refresh(input,ui));
        refresh(input,ui);
    }
    function scan(root){
        if(!root||root.nodeType!==1)return;
        if(root.matches&&root.matches('input[type="number"]'))enhance(root);
        root.querySelectorAll&&root.querySelectorAll('input[type="number"]:not([data-gstep])').forEach(enhance);
    }
    function start(){
        scan(document.body);
        new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
    }
    window.GempireStepper={enhance,scan,setValue};
    if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
