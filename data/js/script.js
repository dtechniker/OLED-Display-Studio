/* * OLED Studio V2.4 - Licensed under AGPL-3.0
 * Copyright (c) 2024 DTech (DTechniker)
 * Source code must be made available when running this software on a network.
 */


// =========================
// SIMPLE I18N HELPER
// =========================

const OLED_I18N = {
    current: navigator.language.startsWith('de') ? 'de' : 'en',
    dict: {},

    setLang(lang) {
        this.current = lang;
        this.dict = (lang === 'de') ? window.LANG_DE : window.LANG_EN;
    } 
};

// Globale Übersetzungsfunktion
function t(key, vars = {}) {
    const str = OLED_I18N.dict[key] || key;

    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

const OLED_APP = {
	
state: {
    isMouseDown: false,
    stampData: null,
    guideSize: 0,
    lastGenerated: { id: "grid_main", w: 128, h: 32 }
},

workshopConfig: [
    { id: 'g8',    w: 8,  h: 8,  pxSize: 18, scalable: true,  next: 'g16'},
    { id: 'g16',   w: 16, h: 16, pxSize: 10, scalable: true,  next: 'g32'},
    { id: 'g32',   w: 32, h: 32, pxSize: 6,  scalable: false, next: null },
    { id: 'g8x16', w: 8,  h: 16, pxSize: 12, scalable: false, next: null },
    { id: 'g16x8', w: 16, h: 8,  pxSize: 12, scalable: false, next: null }
],

	

// =========================
// INITIALISIERUNG
// =========================

init() {
    OLED_I18N.setLang(OLED_I18N.current);

    this.cacheDOM();               // DOM-Elemente holen
    this.applyHTMLLocalization();  // Texte setzen
    this.bindEvents();             // Events binden
    this.renderWorkshop();         // Workshop erzeugen
    this.renderMainGrid();         // Hauptgrid erzeugen
    this.renderAxis();             // Achsen erzeugen
    this.updatePreview();          // Preview zeichnen
    this.renderTemplates();        // Templates laden
	this.initGridGuideEvents();	   //
	this.initGlobalMouseEvents();  // 
	this.initWorkshopButtons();	   // Workshop Btn einbinden
	this.initMainButtons();	       // Main Btn einbinden
	this.initPanelHoverReset();    // Tooltip-Reset für Panels
},

// =========================
// DOM CACHE
// =========================

cacheDOM() {
    this.dom = {
        // MAIN GRID
        mainGrid: document.getElementById('grid_main'),
        preview1: document.getElementById('preview1x')?.getContext('2d'),
        ghost: document.getElementById('stamp_ghost'),

        // INFO & OUTPUT
        infoBox: document.getElementById('info_content'),
        output: document.getElementById('output_code'),
        memUsage: document.getElementById('memory_usage'),

        // EXPORT / ASCII
        formatSelect: document.getElementById('code_format'),
        asciiConfig: document.getElementById('ascii_config'),
        charOn: document.getElementById('char_on'),
        charOff: document.getElementById('char_off'),

        // WORKSHOP
        workshopContainer: document.getElementById('workshop_container'),

        // TEMPLATE PANEL
        templateContainer: document.getElementById('elemV_content')
    };
},

initPanelHoverReset() { 
	this.setInfo("tooptip_clr");
	const panels = [
        "head_Line",
        "panel_workshop",
        "panel_templates",
        "panel_info",
        "export_section"
    ];

    panels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener("mouseleave", () => {
            this.setInfo("tooptip_clr");
        });
    });
},

// =========================
// HTML LOKALISIERUNG
// =========================

applyHTMLLocalization() {
    const dict = OLED_I18N.dict;

    // 1) Statische Texte
    const staticIds = [
        "main_grid", "desc_grid", "titel_templates", "titel_export",
        "titel_output", "titel_import", "txt_importTip",
        "titel_preview", "disc_templetes",
        "info_content", "txt_datavolue"
    ];

    staticIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || !dict[id]) return;

        if (id === "txt_datavolue") {
            const strong = el.querySelector("#memory_usage");
            el.innerHTML = `${t(id)} `;
            el.appendChild(strong);
            el.append(" Bytes");
            return;
        }

        el.textContent = t(id);
    });

    // 2) Buttons (title)
    document.querySelectorAll("button[id]").forEach(btn => {
        const key = btn.id;
        if (dict[key]) btn.title = t(key);
    });

    // 3) Inputs + Textareas (placeholder + title)
    document.querySelectorAll("input[id], textarea[id]").forEach(el => {
        const key = el.id;

        if (dict[key]) el.placeholder = t(key);

        const titleKey = key + "_title";
        if (dict[titleKey]) el.title = t(titleKey);
    });

    // 4) Checkboxen (nur Tooltip)
    document.querySelectorAll("input[type=checkbox][id]").forEach(cb => {
        const titleKey = cb.id + "_title";
        if (dict[titleKey]) cb.title = t(titleKey);
    });

    // 5) Select + Optionen
    document.querySelectorAll("select[id]").forEach(sel => {
        const selKey = sel.id;

        const titleKey = selKey + "_title";
        if (dict[titleKey]) sel.title = t(titleKey);

        if (!dict[selKey]) return;

        sel.querySelectorAll("option").forEach(opt => {
            const val = opt.value;
            if (dict[selKey][val]) {
                opt.textContent = t(dict[selKey][val]);
            }
        });
    });

    // 6) Tooltips aus data-action
    document.querySelectorAll("[data-action]").forEach(el => {
        const action = el.dataset.action;
        if (dict.tooltips && dict.tooltips[action]) {
            el.title = t(dict.tooltips[action].t);
            el.dataset.tooltipDesc = t(dict.tooltips[action].d);
        }
    });

    // 7) Spezielle Tooltip-Funktionen (falls vorhanden)
    if (dict.tooltip_ToWorkshop_desc) {
        const el = document.getElementById("btn_ToWorkshop");
        if (el) el.title = t("tooltip_ToWorkshop_desc");
    }

    if (dict.tooltip_GetStamp_desc) {
        const el = document.getElementById("btn_GetStamp");
        if (el) el.title = t("tooltip_GetStamp_desc");
    }
},

// =========================
// EVENT BINDING (ZENTRAL)
// =========================
bindEvents() {

    // Zeichnen starten
    this.dom.mainGrid.addEventListener("mousedown", (e) => {
        this.state.isMouseDown = true;
        this.handleMainGridDown(e);
    });

    // Zeichnen beim Ziehen
    this.dom.mainGrid.addEventListener("mousemove", (e) => {
        if (this.state.isMouseDown) {
            this.handleMainGridMove(e);
        }
    });

    // Zeichnen stoppen
    document.addEventListener("mouseup", () => {
        this.state.isMouseDown = false;
    });

    // WORKSHOP EVENTS
    // Raster laden
    document.querySelectorAll("[data-action='load_to_workshop']")
        .forEach(btn => btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-target");
            this.loadToWorkshop(id);
        }));

    // TEMPLATE FILTER EVENTS
    ['chk_filt_8', 'chk_filt_16', 'chk_filt_32'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.renderTemplates());
    });

    // EXPORT EVENTS
    this.dom.formatSelect?.addEventListener('change', () => this.refreshCode());
    this.dom.charOn?.addEventListener('input', () => this.refreshCode());
    this.dom.charOff?.addEventListener('input', () => this.refreshCode());

    const copy = document.getElementById('btn_copy_code');
    if (copy) copy.addEventListener('click', () => this.copyToClipboard());

    const clearExBtn = document.getElementById('btn_clr_code');
    if (clearExBtn) clearExBtn.addEventListener('click', () => {
        const area = document.getElementById('output_code');
        if (area) area.value = '';
    });

    // IMPORT EVENTS
    const clearBtn = document.getElementById('btn_clear_import');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        const area = document.getElementById('imp_universal');
        if (area) area.value = '';
    });

    const btnImport = document.querySelector('[data-action="import_universal"]');
    if (btnImport) btnImport.addEventListener('click', () => {
        this.universalImport('imp_universal');
    });
},

// Globale Maus-Events
initGlobalMouseEvents() {
    // Rechtsklick → Stempelabbruch vormerken
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            this.state.isMouseDown = true;
        }
        if (e.button === 2 && this.state.stampData) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // Stempel NICHT hier löschen!
            // Nur merken, dass wir ihn löschen wollen
            this._cancelStamp = true;
        }
    }, true);

    // Kontextmenü blockieren, solange Stempel aktiv ist
    window.addEventListener('contextmenu', (e) => {

        if (this.state.stampData) {
            e.preventDefault();
        }

        // Wenn ein Stempelabbruch vorgemerkt ist → jetzt löschen
        if (this._cancelStamp) {
            this.state.stampData = null;
            this.updateGhost();
			
			this.setInfo("stamp");
            this._cancelStamp = false;
        }
    });


    document.addEventListener('mouseup', () => {
        this.state.isMouseDown = false;
    });

    document.addEventListener('mousemove', (e) => this.handleGhostMove(e));
},

// Grid-Guides
initGridGuideEvents() {
    ['chk_grid_8', 'chk_grid_16', 'chk_grid_32'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.applyGridGuides());
    });
},

// Main-Grid Buttons
initMainButtons() {
    const buttons = document.querySelectorAll(".btn_main");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action;
            this.applyToolToMainRaster("grid_main", action);
        });
    });
},
applyToolToMainRaster(id, action) {
    switch (action) {

        case "clear":
            this.clearGrid(id);
            break;
        case "code":
            this.generateCode(id, 128, 32);
            break;
        case "invert":
            this.invertMainGrid();
            break;
        case "shift_left":
            this.shiftMainGrid(-1, 0);
            break;
        case "shift_right":
            this.shiftMainGrid(1, 0);
            break;
        case "shift_up":
            this.shiftMainGrid(0, -1);
            break;
        case "shift_down":
            this.shiftMainGrid(0, 1);
            break;
    }
},

// D) Export
initExportEvents() {
    this.dom.formatSelect.addEventListener('change', () => this.refreshCode());
    this.dom.charOn.addEventListener('input', () => this.refreshCode());
    this.dom.charOff.addEventListener('input', () => this.refreshCode());
},

// F) Template-Filter
initTemplateFilterEvents() {
    ['chk_filt_8', 'chk_filt_16', 'chk_filt_32'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => this.renderTemplates());
    });
},

// WORKSHOP RENDERING (MODULAR)
renderWorkshop() {
    const container = document.getElementById('workshop_container');
    container.innerHTML = '';

    this.workshopConfig.forEach(conf => {
        const card = this.createWorkshopCard(conf);
        container.appendChild(card);
    });

    this.activateFirstWorkshopCard();
},

handleMainGridDown(e) {
    const target = e.target;
    if (!target || !target.classList.contains("pixel")) return;

    const x = parseInt(target.dataset.x);
    const y = parseInt(target.dataset.y);

    // Stempel aktiv?
    if (this.state.stampData) {
        this.applyStamp(x, y);
        return;
    }

    // Normaler Pixel
    target.checked = !target.checked;

    this.updatePreview();
    this.updateMemoryUsage();
},
handleMainGridMove(e) {
    const target = e.target;
    if (!target || !target.classList.contains("pixel")) return;

    const x = parseInt(target.dataset.x);
    const y = parseInt(target.dataset.y);

    // Stempel aktiv?
    if (this.state.stampData) {
        this.applyStamp(x, y);
        return;
    }

    // Normaler Pixel beim Ziehen
    target.checked = true;

    this.updatePreview();
    this.updateMemoryUsage();
},

// CARD ERZEUGEN
createWorkshopCard(conf) {
    const card = document.createElement('div');
    card.className = 'box_card';

    // Hover Info
    card.addEventListener("mouseenter", () => {
    this.setInfo("ws_" + conf.id);
	});
	        
    // Aktivieren per Klick
    card.addEventListener("click", () => {
        document.querySelectorAll(".box_card")
            .forEach(c => c.classList.remove("active_raster"));
        card.classList.add("active_raster");
    });

    // Card Inhalt
    card.innerHTML = `
        <span>${conf.w}x${conf.h}</span>
        <div id="${conf.id}" class="mini_grid"
             style="grid-template-columns:repeat(${conf.w},${conf.pxSize}px)">
        </div>
    `;

    const grid = card.querySelector('.mini_grid');
    this.createWorkshopGrid(grid, conf);

    return card;
},

// GRID + PIXEL ERZEUGEN
createWorkshopGrid(grid, conf) {

    for (let i = 0; i < conf.w * conf.h; i++) {

        const x = i % conf.w;
        const y = Math.floor(i / conf.w);

        const pixel = this.createPixel(conf.pxSize, false);
        pixel.classList.add('pixel_workshop');
        pixel.dataset.x = x;
        pixel.dataset.y = y;

        this.bindWorkshopPixelEvents(pixel, conf, x, y);

        grid.appendChild(pixel);
    }

    this.bindWorkshopStampImport(grid, conf);
},

// PIXEL EVENTS (WORKSHOP)
bindWorkshopPixelEvents(pixel, conf, x, y) {

    pixel.addEventListener('mousedown', (e) => {

        // Rechtsklick blockieren
        if (e.button === 2) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        // Stempel anwenden
        if (this.state.stampData && e.button === 0) {

            const cfg = this.workshopConfig.find(c => c.id === conf.id);
            const gW = cfg?.w || 32;
            const gH = cfg?.h || 32;

            this.applyStampToGrid(conf.id, x, y, gW, gH);

            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        // Normales Zeichnen
        if (e.button === 0) {
            this.state.isMouseDown = true;
            pixel.classList.toggle('active');
            this.updatePreview();
        }
    });

    pixel.addEventListener('mouseenter', () => {
        if (this.state.isMouseDown && !this.state.stampData) {
            pixel.classList.add('active');
            this.updatePreview();
        }
    });
},

// STEMPEL IMPORT
bindWorkshopStampImport(grid, conf) {
    // Wenn man auf ein Stempel-Raster klickt, wird ein Stempel erzeugt
    grid.addEventListener('click', () => {
        if (!this.state.stampData) return;
        const tempTemplate = {
            name: "Stempel_Import",
            size: conf.w,
            data: this.generateCodeFromStamp()
        };
        this.loadToWorkshop(tempTemplate);
    });
},

generateCodeFromStamp() {

    const { w, h, pixels } = this.state.stampData;
    // Leere Matrix erzeugen
    const matrix = Array.from({ length: h }, () =>
        Array.from({ length: w }, () => 0)
    );
    // Pixel eintragen
    pixels.forEach(p => {
        if (p.y >= 0 && p.y < h && p.x >= 0 && p.x < w) {
            matrix[p.y][p.x] = 1;
        }
    });
    // Zeilen zu einem einzigen String verbinden
    return matrix.map(row => row.join("")).join("\n");
},

// ERSTE KARTE AKTIVIEREN
activateFirstWorkshopCard() {
    const first = document.querySelector(".box_card");
    if (first) first.classList.add("active_raster");
},

// WORKSHOP BUTTONS
initWorkshopButtons() {
    const buttons = document.querySelectorAll(".btn_workshop");
    buttons.forEach(btn => {
        btn.addEventListener("mouseenter", () => {
			this.setInfo(btn.dataset.action);
        });
        btn.addEventListener("click", () => {
            const active = document.querySelector(".box_card.active_raster");
            if (!active) return;
            const canvas = active.querySelector(".mini_grid");
            if (!canvas) return;
            this.applyToolToRaster(canvas.id, btn.dataset.action);
        });
    });
},

scaleGrid(sId, sW, sH, tId) {
    const src = document.getElementById(sId).children;
    const trg = document.getElementById(tId).children;
    const tConf = this.workshopConfig.find(c => c.id === tId);

    Array.from(trg).forEach(p => p.classList.remove('active'));

    for (let y = 0; y < sH; y++) {
        for (let x = 0; x < sW; x++) {

            if (src[y * sW + x].classList.contains('active')) {

                const idx = (y * 2) * tConf.w + (x * 2);

                if (trg[idx]) trg[idx].classList.add('active');
                if (trg[idx + 1]) trg[idx + 1].classList.add('active');
                if (trg[idx + tConf.w]) trg[idx + tConf.w].classList.add('active');
                if (trg[idx + tConf.w + 1]) trg[idx + tConf.w + 1].classList.add('active');
            }
        }
    }
},
applyToolToRaster(id, action) {
    switch (action) {
        case "clear":
            this.clearWorkshopRaster(id);
            break;
        case "code":
            const { w, h } = this.parseWorkshopId(id);
            this.generateCode(id, w, h);
            break;
		case "scale":
			this.scaleWorkshopRaster(id);
			break;
		case "stamp":
			this.stampWorkshopRaster(id);
			break;
        case "invert":
            this.invertWorkshopRaster(id);
            break;
		case "mirror_h": 
		case "mirror_v": 
			this.mirrorWorkshopRaster(id, action); 
			break;
		case "rotate":
			this.rotateWorkshopRaster(id);
			break;
        case "shift_up":
        case "shift_down":
        case "shift_left":
        case "shift_right":
            this.shiftWorkshopRaster(id, action);
            break;
    }
},

scaleWorkshopRaster(id) {
    const conf = this.workshopConfig.find(c => c.id === id);
    if (!conf || !conf.scalable || !conf.next) return;
    const nextId = conf.next;
    const oldGrid = document.getElementById(id);
    const newGrid = document.getElementById(nextId);
    if (!oldGrid || !newGrid) return;
    const oldPixels = Array.from(oldGrid.querySelectorAll('.pixel_workshop'));
    const newPixels = Array.from(newGrid.querySelectorAll('.pixel_workshop'));
    // Ziel-Grid leeren
    newPixels.forEach(p => p.classList.remove('active'));
    const targetConf = this.workshopConfig.find(c => c.id === nextId);
    const W = targetConf.w;
    const H = targetConf.h;
    // Jeden Pixel verdoppeln
    for (let y = 0; y < conf.h; y++) {
        for (let x = 0; x < conf.w; x++) {
            const index = y * conf.w + x;
            if (oldPixels[index].classList.contains('active')) {
                const nx = x * 2;
                const ny = y * 2;
                const set = (tx, ty) => {
                    const idx = ty * W + tx;
                    newPixels[idx]?.classList.add('active');
                };
                set(nx, ny);
                set(nx + 1, ny);
                set(nx, ny + 1);
                set(nx + 1, ny + 1);
            }
        }
    }
    this.updatePreview();
},

rotateWorkshopRaster(id) {
    const grid = document.getElementById(id);
    if (!grid) return;
    const conf = this.workshopConfig.find(c => c.id === id);
    if (!conf) return;
    const w = conf.w;
    const h = conf.h;
    const px = Array.from(grid.querySelectorAll('.pixel_workshop'));
    // Zustand merken
    const state = px.map(p => p.classList.contains('active'));
    // Alles löschen
    px.forEach(p => p.classList.remove('active'));
    // 90° im Uhrzeigersinn:
    // (x, y) → (y, w - 1 - x)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (state[y * w + x]) {
                const nx = y;
                const ny = w - 1 - x;
                // Nur setzen, wenn innerhalb des Grids
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    px[ny * w + nx].classList.add('active');
                }
            }
        }
    }
    this.updatePreview();
},

shiftWorkshopRaster(id, action) {
    const grid = document.getElementById(id);
    if (!grid) return;
    const conf = this.workshopConfig.find(c => c.id === id);
    if (!conf) return;
    const w = conf.w;
    const h = conf.h;
    const px = Array.from(grid.querySelectorAll('.pixel_workshop'));
    const state = px.map(p => p.classList.contains('active'));// Zustand merken
    px.forEach(p => p.classList.remove('active'));// Alles löschen
    let dx = 0, dy = 0;// Bewegungsrichtung bestimmen
    switch (action) {
        case "shift_left":  dx = -1; break;
        case "shift_right": dx =  1; break;
        case "shift_up":    dy = -1; break;
        case "shift_down":  dy =  1; break;
    }
    for (let y = 0; y < h; y++) { // Neue Positionen setzen
        for (let x = 0; x < w; x++) {
            if (state[y * w + x]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {// Nur innerhalb des Workshop‑Grids
                    px[ny * w + nx].classList.add('active');
                }
            }
        }
    }
    this.updatePreview();
},

invertWorkshopRaster(id) {
    const grid = document.getElementById(id);
    if (!grid) return;
    grid.querySelectorAll('.pixel_workshop')
        .forEach(p => p.classList.toggle('active'));
    this.updatePreview();
},

stampWorkshopRaster(id) {
    const grid = document.getElementById(id);
    if (!grid) return;
    const { w, h } = this.parseWorkshopId(id); // z.B. g8, g16, g16x16
    const pixels = [...grid.querySelectorAll('.pixel_workshop')];
    if (pixels.length !== w * h) {
        console.warn("Workshop-Rastergröße passt nicht zur ID:", id, "erwartet", w * h, "gefunden", pixels.length);
        return;
    }
    const hexRows = [];
    const bytesPerRow = Math.ceil(w / 8); // 8x8 → 1, 16x16 → 2, 32x32 → 4
    for (let y = 0; y < h; y++) {
        for (let b = 0; b < bytesPerRow; b++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = b * 8 + bit;
                if (x >= w) break; // falls Breite kein Vielfaches von 8 ist
                const index = y * w + x;
                const active = pixels[index].classList.contains("active");
                // Bitposition im Byte: MSB links → 7 - bit
                if (active) {
                    byte |= (1 << (7 - bit));
                }
            }
            const hex = "0x" + byte.toString(16).padStart(2, "0").toUpperCase();
            hexRows.push(hex);
        }
    }
    const impArea = document.getElementById("imp_universal");
    if (!impArea) return;
    impArea.value = `/* icon_${w}x${h} */\n${hexRows.join(", ")}`;
    this.universalImport("imp_universal");
},

mirrorWorkshopRaster(id, direction) {
    const grid = document.getElementById(id);
    if (!grid) return;
    const conf = this.workshopConfig.find(c => c.id === id);
    if (!conf) return;
    const w = conf.w;
    const h = conf.h;
    const px = Array.from(grid.querySelectorAll('.pixel_workshop'));
    // Zustand merken
    const state = px.map(p => p.classList.contains('active'));
    // Alles löschen
    px.forEach(p => p.classList.remove('active'));
    if (direction === "mirror_h") {
        // Horizontal spiegeln (links ↔ rechts)
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (state[y * w + x]) {
                    const nx = w - 1 - x;
                    px[y * w + nx].classList.add('active');
                }
            }
        }
    }
    if (direction === "mirror_v") {
        // Vertikal spiegeln (oben ↔ unten)
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (state[y * w + x]) {
                    const ny = h - 1 - y;
                    px[ny * w + x].classList.add('active');
                }
            }
        }
    }
    this.updatePreview();
},

parseWorkshopId(id) {
    // Entfernt das führende "g"
    const raw = id.slice(1); // z.B. "8", "16", "8x16"

    // Prüfen, ob es ein "x" gibt → also ein Rechteck
    if (raw.includes("x")) {
        const [w, h] = raw.split("x").map(Number);
        return { w, h };
    }

    // Ansonsten ist es ein Quadrat
    const size = parseInt(raw);
    return { w: size, h: size };
},

clearWorkshopRaster(id) {
    const grid = document.getElementById(id);
    if (!grid) return;

    // Workshop-Pixel auswählen
    const pixels = grid.querySelectorAll(".pixel_workshop");

    pixels.forEach(p => p.classList.remove("active"));

    this.updatePreview();
},

renderMainGrid() {
    const grid = this.dom.mainGrid;
    grid.innerHTML = '';

    for (let i = 0; i < 128 * 32; i++) {
        const px = document.createElement('div');
        px.className = 'pixel_main';
        px.addEventListener('mousedown', (e) => {

            // Rechtsklick → Stempel abbrechen + Browser-Menü blockieren
            if (e.button === 2) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.state.stampData = null;
                return;
            }
            // Linksklick + Stempel aktiv → Stempel anwenden
            if (this.state.stampData && e.button === 0) {
                this.applyStamp(i % 128, Math.floor(i / 128));
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            // Normaler Linksklick → Pixel toggeln
            if (e.button === 0) {
                this.state.isMouseDown = true;
                px.classList.toggle('active');
                this.updatePreview();
            }
        });
        px.addEventListener('mouseenter', () => {
            if (this.state.isMouseDown && !this.state.stampData) {
                px.classList.add('active');
                this.updatePreview();
            }
        });
        grid.appendChild(px);
    }
    this.applyGridGuides();
},

// PIXEL FACTORY (DOM ONLY — Events werden extern gebunden)
createPixel(size, isMain = false) {
    const pixel = document.createElement('div');
    pixel.style.width = size + 'px';
    pixel.style.height = size + 'px';
    pixel.className = isMain ? 'pixel_main' : 'pixel_workshop';
    return pixel;
},
bindMainPixelEvents(pixel, x, y) {

    pixel.addEventListener('mousedown', () => {

        if (this.state.stampData) {
            this.applyStamp(x, y);
        } else {
            pixel.classList.toggle('active');
            this.updatePreview();
        }
    });

    pixel.addEventListener('mouseenter', () => {
        if (this.state.isMouseDown && !this.state.stampData) {
            pixel.classList.add('active');
            this.updatePreview();
        }
    });
},
 renderAxis() {
        const c = document.getElementById('col_headers');
        const r = document.getElementById('row_headers');
        c.innerHTML = '';
        r.innerHTML = '';

        // Spalten
        for (let i = 0; i < 128; i++) {
            const d = document.createElement('div');
            d.className = 'header_cell';
            d.style.left = (i * 9) + "px";
            d.style.width = "9px";
            d.innerText = (i % 10 === 0) ? i : "·";
            d.addEventListener('click', () => this.toggleLine(i, 'col'));
            c.appendChild(d);
        }

        // Zeilen
        for (let i = 0; i < 32; i++) {
            const d = document.createElement('div');
            d.className = 'header_cell';
            d.style.top = (i * 9) + "px";
            d.style.height = "9px";
            d.innerText = (i % 8 === 0) ? i : "·";
            d.addEventListener('click', () => this.toggleLine(i, 'row'));
            r.appendChild(d);
        }
    },
clearGrid(id) {
    const c = document.getElementById(id);
    if (!c) return;
    const kids = (id === 'grid_main')
        ? c.querySelectorAll('.pixel_main')
        : c.children;
    Array.from(kids).forEach(p => p.classList.remove('active'));
    if (id === 'grid_main') this.updatePreview();
},
shiftMainGrid(dx, dy) {
    const px = Array.from(document.querySelectorAll('#grid_main .pixel_main'));
    const state = px.map(p => p.classList.contains('active'));
    px.forEach(p => p.classList.remove('active'));
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 128; x++) {
            if (state[y * 128 + x]) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < 128 && ny >= 0 && ny < 32) {
                    px[ny * 128 + nx].classList.add('active');
                }
            }
        }
    }
    this.updatePreview();
},
invertMainGrid() {
    document.querySelectorAll('#grid_main .pixel_main')
        .forEach(p => p.classList.toggle('active'));
    this.updatePreview();
},
toggleLine(idx, type) {
    const px = document.querySelectorAll('.pixel_main');
    const isCol = type === 'col';
    const limit = isCol ? 32 : 128;
    const start = isCol ? idx : idx * 128;
    const setOn = !px[start].classList.contains('active');

    for (let k = 0; k < limit; k++) {
        const pIdx = isCol ? (k * 128 + idx) : (idx * 128 + k);
        if (setOn) px[pIdx].classList.add('active');
        else px[pIdx].classList.remove('active');
    }

    this.updatePreview();
},
applyGridGuides() {
    const g8  = document.getElementById('chk_grid_8');
    const g16 = document.getElementById('chk_grid_16');
    const g32 = document.getElementById('chk_grid_32');
    const px  = document.querySelectorAll('.pixel_main');

    let frameColor = "#222";
    if (g8.checked)  frameColor = "#6f6";
    if (g16.checked) frameColor = "#6ff";
    if (g32.checked) frameColor = "#f66";

    const grid = this.dom.mainGrid;
    grid.style.borderLeft = grid.style.borderTop = `1px solid ${frameColor}`;

    px.forEach((p, i) => {
        const x = (i % 128) + 1;
        const y = Math.floor(i / 128) + 1;

        const bR =
            (g32.checked && x % 32 === 0) ? "#f66" :
            (g16.checked && x % 16 === 0) ? "#6ff" :
            (g8.checked  && x % 8  === 0) ? "#6f6" : "#222";

        const bB =
            (g32.checked && y % 32 === 0) ? "#f66" :
            (g16.checked && y % 16 === 0) ? "#6ff" :
            (g8.checked  && y % 8  === 0) ? "#6f6" : "#222";

        p.style.borderRight  = `1px solid ${bR}`;
        p.style.borderBottom = `1px solid ${bB}`;
    });
},

// EXPORT LOGIC (MODULAR)
refreshCode() {
    const { id, w, h } = this.state.lastGenerated;
    this.generateCode(id, w, h);
},

generateCode(id, w, h) {
    this.state.lastGenerated = { id, w, h };
    const format = this.dom.formatSelect.value;
    const isMain = (id === 'grid_main');
    const px = isMain
        ? document.querySelectorAll('.pixel_main')
        : document.getElementById(id)?.children;
    if (!px) return;
    const name = isMain ? 'bitmap_128x32' : `icon_${w}x${h}`;
    let output = "";
    let bytesCount = 0;
    // ASCII-Konfiguration sichtbar/unsichtbar
    this.dom.asciiConfig.style.display = (format === 'visual_art') ? 'flex' : 'none';
   
       // ---------------------------------------------------
    // FORMAT SWITCH
    // ---------------------------------------------------

    if (format === 'adafruit_gfx' || format === 'cpp_binary') {
        ({ output, bytesCount } = this.generateAdafruitOrBinary(px, w, h, name, format));
        this.setInfo(format, t("export_desc_adafruit"));
    }
    else if (format === 'visual_art') {
        ({ output, bytesCount } = this.generateAsciiArt(px, w, h));
        this.setInfo(format, t("export_desc_ascii"));
    }
    else if (format === 'ssd1306_native') {
        ({ output, bytesCount } = this.generateSSD1306(px, w, h, name));
        this.setInfo(format, t("export_desc_ssd1306"));
    }   
    // OUTPUT & UI UPDATE
    this.dom.output.value = output;
    this.dom.memUsage.innerText = bytesCount;
    document.getElementById('export_section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
},
generateAdafruitOrBinary(px, w, h, name, format) {

    const data = [];
    const bytesPerRow = Math.ceil(w / 8);

    for (let y = 0; y < h; y++) {
        for (let b = 0; b < bytesPerRow; b++) {

            let byte = 0;
            let binaryStr = "0b";

            for (let bit = 0; bit < 8; bit++) {
                const x = b * 8 + bit;
                if (x < w) {
                    const idx = y * w + x;
                    const active = px[idx].classList.contains('active');

                    if (active) {
                        byte |= (0x80 >> bit);
                        binaryStr += "1";
                    } else {
                        binaryStr += "0";
                    }
                }
            }

            if (format === 'adafruit_gfx') {
                data.push("0x" + byte.toString(16).padStart(2, '0').toUpperCase());
            } else {
                data.push(binaryStr);
            }
        }
    }

    const output =
        `// ${(format === 'adafruit_gfx') ? 'HEX Array' : 'Binary Array'} (${w}x${h}) Horizontal (Adafruit GFX Standard)\n` +
        `const unsigned char ${name}[] PROGMEM = {\n` +
        `  ${data.join(', ')}\n` +
        `};`;

    return { output, bytesCount: data.length };
},
generateAsciiArt(px, w, h) {

    const cOn  = this.dom.charOn.value  || '#';
    const cOff = this.dom.charOff.value || '.';
    const lines = [];

    for (let y = 0; y < h; y++) {
        let line = "";
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            line += px[idx].classList.contains('active') ? cOn : cOff;
        }
        lines.push(`   ${line}`);
    }

    const output =
        `/*  Visual Preview (${w}x${h})\n` +
        lines.join('\n') +
        `\n*/`;

    return { output, bytesCount: w * h };
},
generateSSD1306(px, w, h, name) {

    const data = [];
    const pages = Math.ceil(h / 8);

    for (let p = 0; p < pages; p++) {
        for (let x = 0; x < w; x++) {

            let byte = 0;

            for (let bit = 0; bit < 8; bit++) {
                const y = p * 8 + bit;
                const idx = y * w + x;

                if (y < h && px[idx] && px[idx].classList.contains('active')) {
                    byte |= (1 << bit);
                }
            }

            data.push("0x" + byte.toString(16).padStart(2, '0').toUpperCase());
        }
    }

    const output =
        `// Native SSD1306 Buffer Format (Vertical)\n` +
        `const unsigned char ${name}[] PROGMEM = {\n` +
        `  ${data.join(', ')}\n` +
        `};`;

    return { output, bytesCount: data.length };
},
updatePreview() {
    const c1 = this.dom.preview1;
    c1.fillStyle = "#000";
    c1.fillRect(0, 0, 128, 32);
    c1.fillStyle = "#00eaff";
    document.querySelectorAll('.pixel_main').forEach((p, i) => {
        if (!p.classList.contains('active')) return;
        const x = i % 128;
        const y = Math.floor(i / 128);
        c1.fillRect(x, y, 1, 1);
    });
},
setInfo(id) {
    if (!this.dom.infoBox) return;
    const dict = OLED_I18N.dict;
    let title = "";
    let desc  = "";
    // Tooltip vorhanden?
    if (dict.tooltips && dict.tooltips[id]) {
        const tip = dict.tooltips[id];
        title = tip.t ? t(tip.t) : "";
        desc  = tip.d ? t(tip.d) : "";
    }
    // Fallback: normale Übersetzung
    else {
        title = dict[id] ? t(id) : (id || "");
        desc  = "";
    }
    this.dom.infoBox.innerHTML = `
        <div class="infoBoxTitel">${title}</div>
        <div class="infoBoxDisc">${desc}</div>
    `;
},
// CLIPBOARD
// -------------------------------------------------------
copyToClipboard() {
    navigator.clipboard
        .writeText(this.dom.output.value)
        .then(() => this.setInfo("code"));
},

pasteClipboard(targetId) {
    navigator.clipboard.readText().then(txt => {
        const el = document.getElementById(targetId);
        if (el) el.value = txt;
        this.setInfo("code");
    });
},

// UNIVERSAL IMPORT
universalImport(sourceId) {
    const area = document.getElementById(sourceId);
    if (!area) return;
    const raw = area.value;
    const tokens = raw.match(/(0x[0-9A-Fa-f]{2}|0b[01]{8})/g);
    if (!tokens) {
        alert(t("alert_Import"));
        return;}
    // Standardwerte
    let w = 128, h = 32;
    // Dimensionen aus Kommentar / Name (z.B. icon_32x32)
    const dimMatch = raw.match(/(\d+)x(\d+)/);
    if (dimMatch) {
        w = parseInt(dimMatch[1], 10);
        h = parseInt(dimMatch[2], 10);
    } else {
        // Fallback-Heuristik
        if (tokens.length <= 8)        { w = 8;  h = 8;  }
        else if (tokens.length <= 32)  { w = 16; h = 16; }
        else if (tokens.length <= 128) { w = 32; h = 32; }
    }

    const pixels = [];
    const bytesPerRow = Math.ceil(w / 8);
    tokens.forEach((token, idx) => {
        const val = token.startsWith('0x')
            ? parseInt(token, 16)
            : parseInt(token.substring(2), 2);

        const row = Math.floor(idx / bytesPerRow);
        const colInRow = idx % bytesPerRow;

        for (let bit = 0; bit < 8; bit++) {
            if ((val >> (7 - bit)) & 1) {
                const x = colInRow * 8 + bit;
                const y = row;
                if (x < w && y < h) {
                    pixels.push({ x, y });
                }
            }
        }
    });

    this.state.stampData = { w, h, pixels };
    this.updateGhost();

    this.setInfo("stamp");
},

// STAMP LOGIC
prepareStamp(id, w, h, e) {
    const grid = document.getElementById(id);
    if (!grid) return;

    const px = grid.children;
    const active = [];

    // Alle aktiven Pixel sammeln
    for (let i = 0; i < px.length; i++) {
        if (px[i].classList.contains('active')) {
            active.push({ x: i % w, y: Math.floor(i / w) });
        }
    }

    if (active.length === 0) {
        this.setInfo("stampEmpty");
        return;
    }

    // Bounding Box berechnen
    const minX = Math.min(...active.map(p => p.x));
    const minY = Math.min(...active.map(p => p.y));
    const maxX = Math.max(...active.map(p => p.x));
    const maxY = Math.max(...active.map(p => p.y));

    // Stempel-Daten speichern
    this.state.stampData = {
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        pixels: active.map(p => ({
            x: p.x - minX,
            y: p.y - minY
        }))
    };

    this.updateGhost();

    // Ghost sofort an Cursor setzen
    if (this.dom.ghost && e) {
        this.dom.ghost.style.left = (e.pageX + 2) + 'px';
        this.dom.ghost.style.top = (e.pageY + 2) + 'px';
        this.dom.ghost.style.display = 'grid';
    }

    this.setInfo("stamp");
},

// GHOST-VORSCHAU
updateGhost() {
    const g = this.dom.ghost;
    const d = this.state.stampData;

    if (!g) return;

    if (!d) {
        g.style.display = 'none';
        return;
    }

    g.style.gridTemplateColumns = `repeat(${d.w}, 9px)`;
    g.innerHTML = '';

    // Ghost-Pixel erzeugen
    for (let i = 0; i < d.w * d.h; i++) {
        const div = document.createElement('div');
        div.style.width = "9px";
        div.style.height = "9px";

        const x = i % d.w;
        const y = Math.floor(i / d.w);

        if (d.pixels.some(p => p.x === x && p.y === y)) {
            div.style.background = 'var(--accent)';
        }

        g.appendChild(div);
    }

    g.style.display = 'grid';
},

// GHOST BEWEGEN
handleGhostMove(e) {
    if (!this.state.stampData) return;

    const ghost = this.dom.ghost;
    if (!ghost) return;

    const posX = e.clientX + window.scrollX;
    const posY = e.clientY + window.scrollY;

    ghost.style.left = (posX + 2) + 'px';
    ghost.style.top = (posY + 2) + 'px';
    ghost.style.display = 'grid';
},

// STEMPEL AUF HAUPTRASTER
applyStamp(sx, sy) {
    if (!this.state.stampData) return;

    const px = document.querySelectorAll('#grid_main .pixel_main');
    const { pixels } = this.state.stampData;

    pixels.forEach(p => {
        const tx = sx + p.x;
        const ty = sy + p.y;

        if (tx < 128 && ty < 32) {
            px[ty * 128 + tx].classList.add('active');
        }
    });

    this.updateGhost();
    this.updatePreview();
},

// TEMPLATE LIST / VORLAGEN (MODULAR)
renderTemplates() {
    const container = document.getElementById('elemV_content');
    if (!container) return;

    const f8  = document.getElementById('chk_filt_8')?.checked;
    const f16 = document.getElementById('chk_filt_16')?.checked;
    const f32 = document.getElementById('chk_filt_32')?.checked;

    container.innerHTML = '';
    const combined = [];

    const noneSelected = !f8 && !f16 && !f32;

    if (f8  || noneSelected) OLED_TEMPLATES_8x8.forEach(t  => combined.push({ ...t, size: 8  }));
    if (f16 || noneSelected) OLED_TEMPLATES_16x16.forEach(t => combined.push({ ...t, size: 16 }));
    if (f32 || noneSelected) OLED_TEMPLATES_32x32.forEach(t => combined.push({ ...t, size: 32 }));

    combined.forEach(template => {
        const item = this.createTemplateItem(template);
        container.appendChild(item);
    });
},
createTemplateItem(template) {
    const item = document.createElement('div');
    item.className = 'template_item';

    const previewHtml = this.renderTemplatePreview(template);

    item.innerHTML = `
        ${previewHtml}
        <div class="t_info">
            <span class="t_name">${template.name}</span>
            <div class="t_btns">
                <button class="t_btn_load" title="${t("t_btn_load")}"><i class="fa fa-qrcode"></i></button>
                <button class="t_btn_stamp" title="${t("t_btn_stamp")}"><i class="fa fa-gavel"></i></button>
            </div>
        </div>
        <span class="t_size">${template.size}x${template.size}</span>
    `;

    this.bindTemplateButtons(item, template);

    return item;
},
renderTemplatePreview(template) {

    const tokens = template.data.match(/(0x[0-9A-Fa-f]{2}|0b[01]{8})/g);
    const displaySize = Math.min(template.size, 16);
    const bytesPerRow = Math.ceil(template.size / 8);

    let html = `<div class="mini_prev_grid" style="grid-template-columns:repeat(${displaySize}, 2px)">`;

    for (let y = 0; y < displaySize; y++) {
        for (let x = 0; x < displaySize; x++) {

            const byteIdx = y * bytesPerRow + Math.floor(x / 8);
            const bitPos  = 7 - (x % 8);
            let active = 0;

            if (tokens && tokens[byteIdx]) {
                const t = tokens[byteIdx];
                const val = t.startsWith('0x')
                    ? parseInt(t, 16)
                    : parseInt(t.substring(2), 2);
                active = (val >> bitPos) & 1;
            }

            html += `<div style="width:2px; height:2px; background:${active ? 'var(--accent)' : '#222'}"></div>`;
        }
    }

    html += `</div>`;
    return html;
},
bindTemplateButtons(item, template) {
    // In Workshop laden
    const btnLoad = item.querySelector('.t_btn_load');
    if (btnLoad) {
        btnLoad.onclick = (e) => {
            e.stopPropagation();
            this.loadToWorkshop(template);

            // Fokus auf das passende Workshop-Raster setzen
            const target = this.workshopConfig.find(c => c.w === template.size && c.h === template.size);
            if (target) {
                this.setWorkshopFocus(target.id);
            }
        };
    }
    // Als Stempel übernehmen
    const btnStamp = item.querySelector('.t_btn_stamp');
    if (btnStamp) {
        btnStamp.onclick = (e) => {
            e.stopPropagation();
            const impArea = document.getElementById('imp_universal');
            if (!impArea) return;
            impArea.value = `/* icon_${template.size}x${template.size} */\n${template.data}`;
            this.universalImport('imp_universal');
        };
    }
},

// TEMPLATE → WORKSHOP GRID
loadToWorkshop(template) {
    const targetGrid = document.getElementById('g' + template.size);
    if (!targetGrid) {
        this.setInfo("errWork");
        return;
    }

    const tokens = template.data.match(/(0x[0-9A-Fa-f]{2}|0b[01]{8})/g);
    if (!tokens) return;

    const cells = targetGrid.children;
    const bytesPerRow = Math.ceil(template.size / 8);

    // Grid leeren
    Array.from(cells).forEach(c => c.classList.remove('active'));

    // Pixel setzen
    tokens.forEach((token, idx) => {
        const val = token.startsWith('0x')
            ? parseInt(token, 16)
            : parseInt(token.substring(2), 2);

        const row      = Math.floor(idx / bytesPerRow);
        const colInRow = idx % bytesPerRow;

        for (let bit = 0; bit < 8; bit++) {
            if ((val >> (7 - bit)) & 1) {
                const x = colInRow * 8 + bit;
                const y = row;
                const cellIdx = y * template.size + x;
                if (cells[cellIdx]) {
                    cells[cellIdx].classList.add('active');
                }
            }
        }
    });
    this.updatePreview();
	
	// Fokus setzen
    const newCard = document.querySelector(`#${template.id}`)?.closest(".box_card");
    if (newCard) {
        document.querySelectorAll(".box_card.active_raster")
            .forEach(c => c.classList.remove("active_raster"));
        newCard.classList.add("active_raster");
    }
	
},

// STEMPEL AUF WORKSHOP-GITTER
applyStampToGrid(gridId, startX, startY, gridW, gridH) {
    if (!this.state.stampData) return;

    const targetGrid = document.getElementById(gridId);
    if (!targetGrid) return;

    const cells = targetGrid.querySelectorAll('.pixel_workshop, .pixel_main');
    const { pixels } = this.state.stampData;

    pixels.forEach(p => {
        const targetX = startX + p.x;
        const targetY = startY + p.y;

        if (
            targetX >= 0 && targetX < gridW &&
            targetY >= 0 && targetY < gridH
        ) {
            const idx = targetY * gridW + targetX;
            if (cells[idx]) {
                cells[idx].classList.add('active');
            }
        }
    });
    this.updatePreview();
},

// setWorkshopFocus
setWorkshopFocus(id) {

    // alten Fokus entfernen
    document.querySelectorAll(".box_card.active_raster")
        .forEach(c => c.classList.remove("active_raster"));

    // neuen Fokus setzen
    const card = document.querySelector(`#${id}`)?.closest(".box_card");
    if (card) {
        card.classList.add("active_raster");
    }
}


} // end OLED_APP

window.addEventListener('DOMContentLoaded', () => OLED_APP.init());

