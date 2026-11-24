/* =========================================================================
 * GEMPIRE · Iconografia facetada
 * Conjunto de ícones SVG próprios (traço + faceta translúcida) que substitui
 * os emojis da interface. O módulo injeta um sprite <symbol> no documento e
 * converte automaticamente qualquer emoji mapeado que apareça no DOM —
 * inclusive no conteúdo gerado dinamicamente pelo jogo.
 * ========================================================================= */
(function(){
    'use strict';
    const F='fill="currentColor" fill-opacity=".22" stroke="none"';
    // Cada ícone é desenhado em uma grade 24×24. Formas com class "f" recebem a
    // faceta translúcida; o traço vem do elemento <svg class="gi"> externo.
    const ICONS={
        gem:'<path '+F+' d="M6 4h12l4 5-10 11L2 9z"/><path d="M6 4h12l4 5-10 11L2 9z M2 9h20 M9 4 7.5 9 12 20l4.5-11L15 4"/>',
        crown:'<path '+F+' d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 18 3 8l5 4 4-7 4 7 5-4-1 10z M4 21h16"/>',
        warning:'<path '+F+' d="M12 3 22 20H2z"/><path d="M12 3 22 20H2z M12 9.5v4.5 M12 17h.01"/>',
        swords:'<path d="M4 4l11.5 11.5 M20 4 8.5 15.5 M13.5 17.5l4-4 M6.5 13.5l4 4 M16 16l3.5 3.5 M8 16l-3.5 3.5"/><path '+F+' d="M4 4l3.5.6 8 8-2.9 2.9-8-8z"/>',
        flask:'<path '+F+' d="M6.5 15h11l2.6 4.3A1.2 1.2 0 0 1 19 21H5a1.2 1.2 0 0 1-1.1-1.7z"/><path d="M9 3h6 M10 3v6l-6 10.3A1.2 1.2 0 0 0 5 21h14a1.2 1.2 0 0 0 1-1.7L14 9V3 M6.5 15h11"/>',
        sparkle:'<path '+F+' d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
        ship:'<path '+F+' d="M2 13l5-4h10l5 4-5 4H7z"/><path d="M2 13l5-4h10l5 4-5 4H7z M2 13h20 M8.5 9l2-4.5h3l2 4.5 M8 17l-1 3 M16 17l1 3"/>',
        pickaxe:'<path '+F+' d="M3.5 8C8 3.5 16 3.5 20.5 8 16 6.5 8 6.5 3.5 8z"/><path d="M3.5 8C8 3.5 16 3.5 20.5 8 16 6.5 8 6.5 3.5 8z M12 5.5V21"/>',
        pool:'<path '+F+' d="M12 3c3 4 4.5 6 4.5 8a4.5 4.5 0 0 1-9 0c0-2 1.5-4 4.5-8z"/><path d="M12 3c3 4 4.5 6 4.5 8a4.5 4.5 0 0 1-9 0c0-2 1.5-4 4.5-8z M2.5 18c2 1.5 3.8 1.5 5.7 0s3.8-1.5 5.7 0 3.8 1.5 5.7 0"/>',
        flower:'<path '+F+' d="M12 9.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM9.5 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M12 9.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM9.5 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><circle cx="12" cy="12" r="1.6"/>',
        scale:'<path d="M12 3v18 M7 21h10 M4 7h16 M4 7 1.5 13.5a2.6 2.6 0 0 0 5 0z M20 7l-2.5 6.5a2.6 2.6 0 0 0 5 0z"/><path '+F+' d="M1.5 13.5h5a2.6 2.6 0 0 1-5 0zm16 0h5a2.6 2.6 0 0 1-5 0z"/>',
        wave:'<path d="M2 9c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.6 5-1 M2 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.6 5-1"/>',
        scroll:'<path '+F+' d="M6 3h12v15a3 3 0 0 1-3 3H5.5"/><path d="M6 3h12v15a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2v-2h12v2a2 2 0 0 0 2 2 M6 3v14 M9 8h6 M9 11.5h6"/>',
        tower:'<path '+F+' d="M12 2l4 6v13H8V8z"/><path d="M12 2l4 6v13H8V8z M8 8h8 M12 2v19 M3 21h18 M5 21v-6l3-2 M19 21v-6l-3-2"/>',
        bolt:'<path '+F+' d="M13 2 4 14h7l-1 8 9-12h-7z"/><path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
        planet:'<circle '+F+' cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="6.5"/><path d="M5.7 14.6C2.4 16.8 1.6 18.6 3 19.3c2 1 8-1.3 12.7-5.2S22.5 6 21 5c-.9-.6-2.8 0-5 1.2"/>',
        injector:'<path '+F+' d="M12 2l4 2.5v5L12 12 8 9.5v-5z"/><path d="M12 2l4 2.5v5L12 12 8 9.5v-5z M12 12v5 M12 17l-5.5 4 M12 17l5.5 4 M12 17v4"/>',
        book:'<path '+F+' d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20 M8.5 7h7"/>',
        temple:'<path '+F+' d="M3 9l9-6 9 6z"/><path d="M3 9l9-6 9 6z M5.5 9v9 M10 9v9 M14 9v9 M18.5 9v9 M3 21h18 M4 18h16"/>',
        close:'<path d="M6 6l12 12 M18 6 6 18"/>',
        check:'<path d="M4 12.5l5 5L20 6.5"/>',
        hammer:'<path '+F+' d="M13 3.5l7.5 7.5-3 3L10 6.5z"/><path d="M13 3.5l7.5 7.5-3 3L10 6.5z M11.7 8.2 3.6 16.3a2 2 0 0 0 2.8 2.8l8.1-8.1"/>',
        eye:'<path '+F+' d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><path d="M12 8.6 15.4 12 12 15.4 8.6 12z"/>',
        shield:'<path '+F+' d="M12 2.5 20 6v6c0 4.5-3.4 8-8 9.5C7.4 20 4 16.5 4 12V6z"/><path d="M12 2.5 20 6v6c0 4.5-3.4 8-8 9.5C7.4 20 4 16.5 4 12V6z M12 2.5v19 M4 11h16"/>',
        flame:'<path '+F+' d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z"/><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z"/>',
        snow:'<path d="M12 2v20 M3.3 7l17.4 10 M3.3 17 20.7 7 M9 3.8l3 2 3-2 M9 20.2l3-2 3 2 M3.6 10.4l2.8-1.3-.2-3.2 M20.4 13.6l-2.8 1.3.2 3.2 M3.6 13.6l2.8 1.3-.2 3.2 M20.4 10.4l-2.8-1.3.2-3.2"/>',
        play:'<path '+F+' d="M7 4l13 8-13 8z"/><path d="M7 4l13 8-13 8z"/>',
        left:'<path d="M15 5l-7 7 7 7"/>',
        right:'<path d="M9 5l7 7-7 7"/>',
        rotate:'<path d="M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7"/>',
        plus:'<path d="M12 5v14 M5 12h14"/>',
        minus:'<path d="M5 12h14"/>',
        flag:'<path '+F+' d="M5 4h13l-2.5 4L18 12H5z"/><path d="M5 21V3 M5 4h13l-2.5 4L18 12H5"/>',
        chart:'<path '+F+' d="M8 20v-8h4v8zm6 0V5h4v15z"/><path d="M3 20h18 M4 20v-5h4v5 M8 20v-8h4v8 M14 20V5h4v15"/>',
        power:'<path '+F+' d="M12 3l3 4.5L12 21 9 7.5z"/><path d="M12 3l3 4.5L12 21 9 7.5z M9 7.5h6 M4 10l3-1.5 M20 10l-3-1.5 M5 15.5l3-.8 M19 15.5l-3-.8"/>',
        people:'<circle '+F+' cx="9" cy="8" r="3.5"/><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M15.5 4.6a3.5 3.5 0 0 1 0 6.8 M18 14.3c2.2.7 3.5 2.8 3.5 5.7"/>',
        wrench:'<path '+F+' d="M15 3a5 5 0 0 0-4.6 6.9L3 17.3 6.7 21l7.4-7.4A5 5 0 0 0 21 9l-3 3-3-3 3-3a5 5 0 0 0-3-3z"/><path d="M15 3a5 5 0 0 0-4.6 6.9L3 17.3 6.7 21l7.4-7.4A5 5 0 0 0 21 9l-3 3-3-3 3-3a5 5 0 0 0-3-3z"/>',
        compass:'<circle cx="12" cy="12" r="9.5"/><path '+F+' d="M16 8l-2.5 5.5L8 16l2.5-5.5z"/><path d="M16 8l-2.5 5.5L8 16l2.5-5.5z"/>',
        drop:'<path '+F+' d="M12 2.5c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/><path d="M12 2.5c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z M9 14a3 3 0 0 0 3 3"/>',
        palette:'<path '+F+' d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4C21 6.5 17 3 12 3z M7.5 11h.01 M10 7h.01 M14.5 7h.01 M17 10.5h.01"/>',
        search:'<circle '+F+' cx="10.5" cy="10.5" r="6.5"/><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
        cargo:'<path '+F+' d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z M3 7.5l9 4.5 9-4.5 M12 12v9 M7.5 5.2l9 4.6"/>',
        heart:'<path '+F+' d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/><path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>',
        menu:'<path d="M4 6h16 M4 12h16 M4 18h16"/>',
        panel:'<rect '+F+' x="14" y="4" width="7" height="16"/><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M14 4v16 M16.5 8h2 M16.5 11h2"/>',
        target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle '+F+' cx="12" cy="12" r="5"/><path d="M12 10.5 13.5 12 12 13.5 10.5 12z"/>',
        save:'<path '+F+' d="M8 21v-7h8v7z"/><path d="M5 3h11l4 4v14H4V3z M8 3v5h7V3 M8 21v-7h8v7"/>',
        gear:'<path '+F+' d="M12 2l1.8 2.6 3-.9.6 3.1 3 1.1-1.3 2.9 1.3 2.9-3 1.1-.6 3.1-3-.9L12 22l-1.8-2.6-3 .9-.6-3.1-3-1.1L4.9 13 3.6 10.1l3-1.1.6-3.1 3 .9z"/><path d="M12 2l1.8 2.6 3-.9.6 3.1 3 1.1-1.3 2.9 1.3 2.9-3 1.1-.6 3.1-3-.9L12 22l-1.8-2.6-3 .9-.6-3.1-3-1.1L4.9 13 3.6 10.1l3-1.1.6-3.1 3 .9z"/><circle cx="12" cy="12" r="3"/>',
        back:'<path d="M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3"/>',
        medal:'<path d="M8 2h8l-2.5 6.2h-3z"/><circle cx="12" cy="15" r="6.5"/><path '+F+' d="M12 11.3l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/><path d="M12 11.3l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
        masks:'<path '+F+' d="M3 3.5h11v6a5.5 5.5 0 0 1-11 0z"/><path d="M3 3.5h11v6a5.5 5.5 0 0 1-11 0z M10 13.5h11v2a5.5 5.5 0 0 1-11 0 M6 8h.01 M11 8h.01 M6 11.5c1.5 1 3.5 1 5 0 M14 16h.01 M18 16h.01 M14 19c1.3-.8 2.7-.8 4 0"/>',
        warp:'<circle '+F+' cx="12" cy="12" r="9.5"/><path d="M12 12c0-2 2-3 3.5-2S17 13 15 14.5 9 15 8 12s2-7 6-7 8 3 7 8 M12 12c0 2-2 3-3.5 2S7 11 9 9.5 15 9 16 12s-2 7-6 7-8-3-7-8"/>',
        pawn:'<path '+F+' d="M8 18h8l-1.5-6h-5z"/><path d="M6 21h12 M8 18h8l-1.5-6h-5z M9 12h6 M12 3a3.2 3.2 0 1 0 0 6.4A3.2 3.2 0 0 0 12 3z"/>',
        leaf:'<path '+F+' d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z M3 21l11-11"/>',
        volcano:'<path '+F+' d="M2 21l7-11h6l7 11z"/><path d="M2 21l7-11h6l7 11z M9 10l1.5 3 1.5-2 1.5 2L15 10 M10.5 6.5c0-1.8 1.8-2 1.8-4 M14 6.5c0-1.2 1.2-1.6 1.8-3"/>',
        idea:'<path '+F+' d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/><path d="M9 19h6 M10 22h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
        sun:'<circle '+F+' cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5 M12 19.5V22 M2 12h2.5 M19.5 12H22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8"/>',
        moon:'<path '+F+' d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
        chat:'<path '+F+' d="M4 4.5h16v11H9.5L4 20z"/><path d="M4 4.5h16v11H9.5L4 20z M8 8.5h8 M8 11.5h5"/>',
        music:'<path d="M9 18V5.5l11-2.5v13"/><circle '+F+' cx="6.5" cy="18" r="2.5"/><circle cx="6.5" cy="18" r="2.5"/><circle '+F+' cx="17.5" cy="16" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
        dot:'<circle cx="12" cy="12" r="5" fill="currentColor"/>',
        hourglass:'<path '+F+' d="M8 17.5c0-2 4-3.5 4-5.5 0 2 4 3.5 4 5.5z"/><path d="M6 3h12 M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9"/>',
        orb:'<circle '+F+' cx="12" cy="11" r="7"/><circle cx="12" cy="11" r="7"/><path d="M7 21h10 M8.5 18l-1 3 M15.5 18l1 3 M9 8.5a3.5 3.5 0 0 1 3-2"/>',
        thermo:'<path '+F+' d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z M12 9v8"/>',
        doc:'<path '+F+' d="M6 2.5h8l4 4v15H6z"/><path d="M6 2.5h8l4 4v15H6z M14 2.5v4h4 M9 12h6 M9 15.5h6"/>',
        hands:'<path '+F+' d="M12 4l3 4-3 4-3-4z"/><path d="M12 4l3 4-3 4-3-4z M3 13c2 0 4 1 5.5 3l1.5 2h4l1.5-2c1.5-2 3.5-3 5.5-3 M3 13v4c2 0 3.5 1 5 3h8c1.5-2 3-3 5-3v-4"/>',
        facet:'<path '+F+' d="M12 3l7 9-7 9-7-9z"/><path d="M12 3l7 9-7 9-7-9z M5 12h14"/>'
    };

    // Emoji → ícone. Variações (com ou sem U+FE0F) são tratadas pela regex.
    const EMOJI={
        '💎':'gem','👑':'crown','♛':'crown','⚠':'warning','🚨':'warning','⚔':'swords','🔬':'flask','⚗':'flask',
        '✨':'sparkle','✧':'sparkle','💡':'idea','🛸':'ship','🚀':'ship','⛏':'pickaxe','🛁':'pool','🌸':'flower','❀':'flower',
        '⚖':'scale','🌊':'wave','📜':'scroll','🏗':'tower','⚡':'bolt','🌍':'planet','🌎':'planet','🌏':'planet','💉':'injector',
        '📖':'book','📚':'book','🏛':'temple','✕':'close','✖':'close','❌':'close','✓':'check','✔':'check','✅':'check','🔨':'hammer',
        '👁':'eye','🛡':'shield','🔥':'flame','❄':'snow','▶':'play','◀':'left','🔄':'rotate','➕':'plus','➖':'minus',
        '🚩':'flag','⚑':'flag','📊':'chart','💪':'power','👥':'people','🤝':'people','🔧':'wrench','🧭':'compass','💧':'drop',
        '🎨':'palette','🔍':'search','🚚':'cargo','💚':'heart','🤍':'heart','💗':'heart','♡':'heart','❤':'heart',
        '☰':'menu','🗂':'panel','🎯':'target','▣':'save','💾':'save','⚙':'gear','↩':'back','🎖':'medal','🎭':'masks',
        '🌌':'warp','🌀':'warp','♟':'pawn','🌿':'leaf','🌱':'leaf','🌋':'volcano','☀':'sun','☼':'sun','🌙':'moon','☾':'moon',
        '💬':'chat','♫':'music','🔴':'dot','⏳':'hourglass','⌛':'hourglass','🗼':'tower','🪐':'planet','🔮':'orb','🌡':'thermo','🌑':'moon','📄':'doc','🤲':'hands'
    };
    const keys=Object.keys(EMOJI).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const EMOJI_RE=new RegExp('('+keys.join('|')+')\\uFE0F?','gu');
    const TEST_RE=new RegExp('(?:'+keys.join('|')+')','u');

    function svg(name,extraClass){
        if(!ICONS[name])name='facet';
        return '<svg class="gi gi-'+name+(extraClass?' '+extraClass:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#gi-'+name+'"></use></svg>';
    }
    function injectSprite(){
        if(document.getElementById('gempire-icon-sprite'))return;
        const holder=document.createElement('div');
        holder.innerHTML='<svg id="gempire-icon-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'+
            Object.entries(ICONS).map(([k,v])=>'<symbol id="gi-'+k+'" viewBox="0 0 24 24">'+v+'</symbol>').join('')+'</svg>';
        document.body.insertBefore(holder.firstChild,document.body.firstChild);
    }

    const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION','SELECT','svg','SVG','CANVAS','TITLE','use','symbol']);
    function stripEmoji(text){return text.replace(EMOJI_RE,'').replace(/\s{2,}/g,' ').trim();}
    function convertTextNode(node){
        const text=node.nodeValue;
        if(!text||!TEST_RE.test(text))return;
        const parent=node.parentNode;
        if(!parent)return;
        if(SKIP.has(parent.nodeName)||parent.closest&&parent.closest('svg,select,textarea')){
            if(parent.nodeName==='OPTION'||parent.nodeName==='TEXTAREA'||parent.nodeName==='TITLE')node.nodeValue=stripEmoji(text);
            return;
        }
        const frag=document.createDocumentFragment();
        let last=0;EMOJI_RE.lastIndex=0;let m;
        while((m=EMOJI_RE.exec(text))){
            if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
            const t=document.createElement('template');t.innerHTML=svg(EMOJI[m[1]]);
            frag.appendChild(t.content.firstChild);
            last=m.index+m[0].length;
        }
        if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
        parent.replaceChild(frag,node);
    }
    function convertAttributes(el){
        if(el.title&&TEST_RE.test(el.title))el.title=stripEmoji(el.title);
        if(el.placeholder&&TEST_RE.test(el.placeholder))el.placeholder=stripEmoji(el.placeholder);
    }
    function decorate(root){
        if(!root)return;
        if(root.nodeType===3){convertTextNode(root);return;}
        if(root.nodeType!==1&&root.nodeType!==11)return;
        if(root.nodeType===1){if(SKIP.has(root.nodeName))return;convertAttributes(root);}
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
        const texts=[];let n;
        while((n=walker.nextNode())){
            if(n.nodeType===3){if(TEST_RE.test(n.nodeValue))texts.push(n);}
            else convertAttributes(n);
        }
        texts.forEach(convertTextNode);
    }
    function start(){
        injectSprite();
        decorate(document.body);
        const observer=new MutationObserver(records=>{
            for(const r of records){
                if(r.type==='characterData')convertTextNode(r.target);
                else if(r.type==='attributes')convertAttributes(r.target);
                else r.addedNodes.forEach(decorate);
            }
        });
        observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','placeholder']});
    }
    window.GempireIcons={svg,decorate,names:Object.keys(ICONS),emojiMap:EMOJI};
    if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
