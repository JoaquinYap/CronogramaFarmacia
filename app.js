// ============================================================
// CronoExcel — app.js
// Complete schedule automation with ExcelJS export, Holidays & Weeks
// ============================================================

(() => {
    'use strict';

    // ───── CONSTANTS ─────
    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const DAY_ABBRS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // 0=Sun..6=Sat
    const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    const FIXED_HOLIDAYS = [
        { m: 0, d: 1, name: 'Año Nuevo' },
        { m: 2, d: 24, name: 'Día de la Memoria' },
        { m: 3, d: 2, name: 'Día de Malvinas' },
        { m: 4, d: 1, name: 'Día del Trabajador' },
        { m: 4, d: 25, name: 'Revolución de Mayo' },
        { m: 5, d: 20, name: 'Día de la Bandera' },
        { m: 6, d: 9, name: 'Día de la Independencia' },
        { m: 11, d: 8, name: 'Inmaculada Concepción' },
        { m: 11, d: 25, name: 'Navidad' }
    ];

    const TYPE_OPTIONS = [
        { value: 'work', label: 'Trabajo' },
        { value: 'franco', label: 'Franco' },
        { value: 'descanso', label: 'Descanso' },
        { value: 'ausente', label: 'Ausente' },
        { value: 'lar', label: 'L.A.R.' },
    ];

    // ───── STATE ─────
    let employees = [];
    let employeeIdCounter = 0;
    let copiedPattern = null; // Will store a 7-day pattern
    let copiedDayPattern = null; // Will store a single day pattern
    let generatedSchedule = null;
    let currentHolidays = [];

    // Brush state
    let activeBrush = null;
    let customBrushes = [];
    const DEFAULT_BRUSHES = [
        { id: 'b1', label: '7-11', type: 'work', start: '07:00', end: '11:00' },
        { id: 'b2', label: '7-14', type: 'work', start: '07:00', end: '14:00' },
        { id: 'b3', label: '7-15', type: 'work', start: '07:00', end: '15:00' },
        { id: 'b4', label: '7-17', type: 'work', start: '07:00', end: '17:00' },
        { id: 'b5', label: '8-13', type: 'work', start: '08:00', end: '13:00' },
        { id: 'b6', label: '9-14', type: 'work', start: '09:00', end: '14:00' },
        { id: 'f', label: 'Franco', type: 'franco', start: '', end: '' },
        { id: 'l', label: 'L.A.R.', type: 'lar', start: '', end: '' }
    ];

    // Theme state
    let currentTheme = localStorage.getItem('cronoexcel_theme') || 'dark';

    // ───── DOM REFS ─────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        monthSelect: $('#month-select'),
        yearInput: $('#year-input'),
        departmentName: $('#department-name'),
        targetHours: $('#target-hours'),
        holidaysList: $('#holidays-list'),
        btnThemeToggle: $('#btn-theme-toggle'),
        employeesContainer: $('#employees-container'),
        employeeTemplate: $('#employee-template'),
        previewTable: $('#preview-table'),
        previewThead: $('#preview-thead'),
        previewTbody: $('#preview-tbody'),
        previewMonthYear: $('#preview-month-year'),
        previewEmpCount: $('#preview-emp-count'),
        sectionConfig: $('#section-config'),
        sectionEmployees: $('#section-employees'),
        sectionPreview: $('#section-preview'),
        toastContainer: $('#toast-container'),
        brushToolbar: $('#brush-toolbar'),
        brushList: $('#brush-list'),
        btnCloseBrush: $('#btn-close-brush'),
    };

    // ───── INIT ─────
    function init() {
        applyTheme(currentTheme);
        populateMonthSelect();
        bindEvents();
        
        // Intenta cargar configuracion antigua de localstorage si existiera
        loadFromStorageLegacy();
        if (employees.length === 0) {
            refreshHolidays();
            addDefaultEmployees();
        } else {
            // Re-render holidays list based on loaded config if any
            renderHolidays();
        }
        
        updateStepIndicator(1);
        initBrushToolbar();
    }

    // ───── BRUSH TOOLBAR ─────
    function renderBrushToolbar() {
        DOM.brushList.innerHTML = '';
        const allBrushes = [...DEFAULT_BRUSHES, ...customBrushes];
        allBrushes.forEach(brush => {
            const btn = document.createElement('button');
            btn.className = `brush-btn ${activeBrush === brush.id ? 'active' : ''}`;
            btn.textContent = brush.label;
            btn.onclick = () => {
                activeBrush = activeBrush === brush.id ? null : brush.id;
                document.body.classList.toggle('brush-active', activeBrush !== null);
                renderBrushToolbar();
            };
            DOM.brushList.appendChild(btn);
        });

        const btnAdd = document.createElement('button');
        btnAdd.className = 'brush-btn';
        btnAdd.textContent = '+ Otro...';
        btnAdd.onclick = () => {
            const start = prompt('Hora de inicio (ej: 06:00):', '06:00');
            if (!start) return;
            const end = prompt('Hora de fin (ej: 13:00):', '13:00');
            if (!end) return;
            const id = 'c' + Date.now();
            // simple parse to format label e.g., 06-13
            const sl = start.split(':')[0];
            const el = end.split(':')[0];
            customBrushes.push({ id, label: `${sl}-${el}`, type: 'work', start, end });
            activeBrush = id;
            document.body.classList.toggle('brush-active', true);
            renderBrushToolbar();
        };
        DOM.brushList.appendChild(btnAdd);
    }

    function initBrushToolbar() {
        const brushFab = $('#brush-fab');
        
        renderBrushToolbar();
        
        brushFab.addEventListener('click', () => {
            DOM.brushToolbar.classList.remove('hidden');
            brushFab.classList.add('hidden');
        });

        DOM.btnCloseBrush.addEventListener('click', () => {
            activeBrush = null;
            document.body.classList.remove('brush-active');
            renderBrushToolbar();
            DOM.brushToolbar.classList.add('hidden');
            brushFab.classList.remove('hidden');
        });
    }

    // ───── THEME ─────
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const iconSun = DOM.btnThemeToggle.querySelector('.icon-sun');
        const iconMoon = DOM.btnThemeToggle.querySelector('.icon-moon');
        if (theme === 'light') {
            iconSun.style.display = 'block';
            iconMoon.style.display = 'none';
        } else {
            iconSun.style.display = 'none';
            iconMoon.style.display = 'block';
        }
    }

    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(currentTheme);
        localStorage.setItem('cronoexcel_theme', currentTheme);
    }

    function populateMonthSelect() {
        const now = new Date();
        MONTH_NAMES.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = name;
            if (i === now.getMonth()) opt.selected = true;
            DOM.monthSelect.appendChild(opt);
        });
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function isHoliday(dayNum) {
        return currentHolidays.some(h => h.day === dayNum);
    }

    // ───── HOLIDAYS ─────
    function refreshHolidays() {
        const m = parseInt(DOM.monthSelect.value);
        // Keep custom holidays if we just changed month? Usually better to reset.
        currentHolidays = [];
        FIXED_HOLIDAYS.forEach(h => {
            if (h.m === m) {
                currentHolidays.push({ day: h.d, name: h.name, custom: false });
            }
        });
        currentHolidays.sort((a, b) => a.day - b.day);
        renderHolidays();
    }

    function renderHolidays() {
        DOM.holidaysList.innerHTML = '';
        if (currentHolidays.length === 0) {
            DOM.holidaysList.innerHTML = '<div style="color:var(--text-muted); font-size:0.875rem;">No hay feriados configurados este mes.</div>';
            return;
        }

        currentHolidays.forEach((h, idx) => {
            const item = document.createElement('div');
            item.className = 'holiday-item';
            
            const dateSpan = document.createElement('div');
            dateSpan.className = 'holiday-date';
            dateSpan.textContent = `${h.day} ${MONTH_NAMES[parseInt(DOM.monthSelect.value)].substring(0,3)}`;
            
            const nameSpan = document.createElement('div');
            nameSpan.className = 'holiday-name';
            nameSpan.textContent = h.name;
            
            const btnDel = document.createElement('button');
            btnDel.className = 'btn-icon';
            btnDel.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            btnDel.onclick = () => {
                currentHolidays.splice(idx, 1);
                renderHolidays();
                reRenderAllEmployeeGrids();
            };

            item.appendChild(dateSpan);
            item.appendChild(nameSpan);
            item.appendChild(btnDel);
            DOM.holidaysList.appendChild(item);
        });
    }

    function addCustomHoliday() {
        $('#add-holiday-form').style.display = 'flex';
        $('#new-holiday-day').focus();
    }

    // ───── EMPLOYEE DAYS LOGIC ─────
    // Create default days array for a given month/year
    function createDefaultMonthDays(shortShift = false) {
        const y = parseInt(DOM.yearInput.value);
        const m = parseInt(DOM.monthSelect.value);
        const total = getDaysInMonth(y, m);
        const days = [];
        
        for (let d = 1; d <= total; d++) {
            const date = new Date(y, m, d);
            const dow = date.getDay(); // 0=Sun
            const hol = isHoliday(d);
            if (dow === 0 || hol) {
                days.push({ dayNum: d, dow, type: 'franco', start: '', end: '' });
            } else {
                days.push({
                    dayNum: d,
                    dow,
                    type: 'work',
                    start: '07:00',
                    end: shortShift ? '14:00' : '15:00'
                });
            }
        }
        return days;
    }

    function addDefaultEmployees() {
        addEmployee({ name: 'Yapura, Servando', hours: 162, days: createDefaultMonthDays(true) });
        addEmployee({ name: 'Benvenutto, Carlos', hours: 220, days: createDefaultMonthDays(false) });
        addEmployee({ name: 'Gatica, Exequiel', hours: 220, days: createDefaultMonthDays(false) });
    }

    // When month/year changes, we need to rebuild the days array for all employees to match new days length and dows
    function onMonthYearChange() {
        refreshHolidays();
        const y = parseInt(DOM.yearInput.value);
        const m = parseInt(DOM.monthSelect.value);
        const total = getDaysInMonth(y, m);

        employees.forEach(emp => {
            const newDays = [];
            for (let d = 1; d <= total; d++) {
                const date = new Date(y, m, d);
                const dow = date.getDay();
                const hol = isHoliday(d);
                
                // When changing month/year, we must start fresh because days of the week shift.
                newDays.push({
                    dayNum: d, dow, type: (dow === 0 || hol) ? 'franco' : 'work',
                    start: (dow === 0 || hol) ? '' : '07:00', end: (dow === 0 || hol) ? '' : '15:00'
                });
            }
            emp.days = newDays;
        });
        
        reRenderAllEmployeeGrids();
    }

    function reRenderAllEmployeeGrids() {
        // Find all active cards and re-render the grid
        $$('.employee-card').forEach(card => {
            const id = parseInt(card.dataset.employeeId);
            const container = card.querySelector('.employee-weeks-container');
            if (container) {
                container.innerHTML = '';
                renderWeeksGrid(container, id);
            }
        });
    }

    // ───── EVENTS ─────
    function bindEvents() {
        DOM.btnThemeToggle.addEventListener('click', toggleTheme);
        $('#btn-add-holiday').addEventListener('click', addCustomHoliday);
        
        $('#btn-cancel-holiday').addEventListener('click', () => {
            $('#add-holiday-form').style.display = 'none';
            $('#new-holiday-day').value = '';
            $('#new-holiday-name').value = '';
        });

        $('#btn-confirm-holiday').addEventListener('click', () => {
            const maxDays = getDaysInMonth(parseInt(DOM.yearInput.value), parseInt(DOM.monthSelect.value));
            const dayInput = $('#new-holiday-day').value;
            const nameInput = $('#new-holiday-name').value;
            
            if (!dayInput) { toast('Ingresa el día', 'warning'); return; }
            const d = parseInt(dayInput);
            if (isNaN(d) || d < 1 || d > maxDays) {
                toast('Día inválido', 'error');
                return;
            }
            if (isHoliday(d)) {
                toast('El feriado ya existe', 'warning');
                return;
            }
            
            const name = nameInput || 'Feriado Extra';
            currentHolidays.push({ day: d, name, custom: true });
            currentHolidays.sort((a, b) => a.day - b.day);

            employees.forEach(emp => {
                if (emp.days && emp.days[d - 1]) {
                    emp.days[d - 1].type = 'franco';
                    emp.days[d - 1].start = '';
                    emp.days[d - 1].end = '';
                }
            });

            renderHolidays();
            reRenderAllEmployeeGrids();
            
            $('#add-holiday-form').style.display = 'none';
            $('#new-holiday-day').value = '';
            $('#new-holiday-name').value = '';
            toast('Feriado agregado', 'success');
        });
        DOM.monthSelect.addEventListener('change', onMonthYearChange);
        DOM.yearInput.addEventListener('change', onMonthYearChange);

        $('#btn-next-employees').addEventListener('click', () => navigateTo(2));
        $('#btn-back-config').addEventListener('click', () => navigateTo(1));
        $('#btn-generate-preview').addEventListener('click', generateAndShowPreview);
        $('#btn-back-employees').addEventListener('click', () => navigateTo(2));
        $('#btn-add-employee').addEventListener('click', () => {
            addEmployee();
            toast('Empleado agregado', 'success');
        });
        $('#btn-export-excel').addEventListener('click', exportToExcel);
        $('#btn-save-config').addEventListener('click', saveToFile);
        $('#btn-load-config').addEventListener('click', loadFromFile);

        $$('.step').forEach(s => {
            s.addEventListener('click', () => {
                const step = parseInt(s.dataset.step);
                if (step === 3 || step === 4) {
                    if (!generatedSchedule) {
                        toast('Primero genera la vista previa', 'warning');
                        return;
                    }
                }
                navigateTo(step <= 2 ? step : 3);
            });
        });
    }

    function navigateTo(step) {
        DOM.sectionConfig.classList.toggle('hidden', step !== 1);
        DOM.sectionEmployees.classList.toggle('hidden', step !== 2);
        DOM.sectionPreview.classList.toggle('hidden', step !== 3 && step !== 4);
        updateStepIndicator(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateStepIndicator(activeStep) {
        const steps = $$('.step');
        const lines = $$('.step-line');
        steps.forEach((s, i) => {
            const num = i + 1;
            s.classList.remove('active', 'completed');
            if (num === activeStep) s.classList.add('active');
            else if (num < activeStep) s.classList.add('completed');
        });
        $$('.step-line').forEach((l, idx) => {
            l.classList.toggle('active', idx < activeStep - 1);
        });
        
        // Show brush toolbar only in Employees view
        if (activeStep === 2) {
            DOM.brushToolbar.classList.remove('hidden');
        } else {
            DOM.brushToolbar.classList.add('hidden');
        }
    }

    function toast(message, type = 'info') {
        const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<div class="toast-icon">${icons[type]}</div><span>${message}</span>`;
        DOM.toastContainer.appendChild(el);
        setTimeout(() => {
            el.classList.add('toast-exit');
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }

    // ───── EMPLOYEE MANAGEMENT ─────
    function addEmployee(data) {
        const id = ++employeeIdCounter;
        const emp = {
            id,
            name: data?.name || '',
            hours: data?.hours || parseInt(DOM.targetHours.value) || 220,
            larEnabled: data?.larEnabled || false,
            larStart: data?.larStart || null,
            larEnd: data?.larEnd || null,
            larHoursPerDay: data?.larHoursPerDay || 7,
            days: data?.days || createDefaultMonthDays(false),
        };
        employees.push(emp);
        renderEmployeeCard(emp);
        renumberEmployees();
        return emp;
    }

    function removeEmployee(id) {
        employees = employees.filter(e => e.id !== id);
        const card = $(`.employee-card[data-employee-id="${id}"]`);
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateX(-30px) scale(0.95)';
            setTimeout(() => {
                card.remove();
                renumberEmployees();
            }, 300);
        }
    }

    function renumberEmployees() {
        $$('.employee-card').forEach((card, i) => {
            card.querySelector('.employee-number').textContent = i + 1;
        });
    }

    function renderEmployeeCard(emp) {
        const template = DOM.employeeTemplate.content.cloneNode(true);
        const card = template.querySelector('.employee-card');
        card.dataset.employeeId = emp.id;

        const nameInput = card.querySelector('.emp-name');
        const hoursInput = card.querySelector('.emp-hours');
        nameInput.value = emp.name;
        hoursInput.value = emp.hours;

        nameInput.addEventListener('input', () => { emp.name = nameInput.value; });
        hoursInput.addEventListener('input', () => { 
            emp.hours = parseInt(hoursInput.value) || 0; 
            recalcLiveHours(emp.id, card);
        });

        card.querySelector('.btn-duplicate-employee').addEventListener('click', () => {
            const clonedDays = emp.days.map(d => ({ ...d }));
            addEmployee({
                name: emp.name ? emp.name + ' (Copia)' : '',
                hours: emp.hours,
                larEnabled: emp.larEnabled,
                larStart: emp.larStart,
                larEnd: emp.larEnd,
                larHoursPerDay: emp.larHoursPerDay,
                days: clonedDays
            });
            toast('Empleado duplicado', 'success');
        });

        card.querySelector('.btn-delete-employee').addEventListener('click', () => {
            if (employees.length <= 1) {
                toast('Debe haber al menos un empleado', 'warning');
                return;
            }
            
            const modal = $('#delete-confirm-modal');
            const msg = $('#delete-confirm-msg');
            const btnConfirm = $('#btn-confirm-delete');
            const btnCancel = $('#btn-cancel-delete');
            
            const empName = emp.name || `Empleado ${emp.id}`;
            msg.textContent = `¿Estás seguro de que querés eliminar a ${empName}? Se perderán todos sus horarios.`;
            modal.style.display = 'flex';
            
            const cleanup = () => {
                modal.style.display = 'none';
                btnConfirm.removeEventListener('click', onConfirm);
                btnCancel.removeEventListener('click', onCancel);
            };
            
            const onConfirm = () => {
                removeEmployee(emp.id);
                toast('Empleado eliminado', 'info');
                cleanup();
            };
            
            const onCancel = () => cleanup();
            
            btnConfirm.addEventListener('click', onConfirm);
            btnCancel.addEventListener('click', onCancel);
        });

        const body = card.querySelector('.employee-card-body');
        card.querySelector('.btn-toggle-employee').addEventListener('click', (e) => {
            const isCollapsing = !body.classList.contains('collapsed');
            if (!isCollapsing) {
                // Auto-collapse others
                $$('.employee-card').forEach(otherCard => {
                    if (otherCard !== card) {
                        const otherBody = otherCard.querySelector('.employee-card-body');
                        if (otherBody) otherBody.classList.add('collapsed');
                        const otherSvg = otherCard.querySelector('.btn-toggle-employee svg');
                        if (otherSvg) otherSvg.style.transform = 'rotate(-90deg)';
                    }
                });
            }
            body.classList.toggle('collapsed');
            const svg = e.currentTarget.querySelector('svg');
            svg.style.transform = body.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
        });

        const larToggle = card.querySelector('.emp-lar-toggle');
        const larInputs = card.querySelector('.lar-inputs');
        const larStartInput = card.querySelector('.emp-lar-start');
        const larEndInput = card.querySelector('.emp-lar-end');
        const larHoursInput = card.querySelector('.emp-lar-hours');

        larToggle.checked = emp.larEnabled;
        larInputs.style.display = emp.larEnabled ? 'flex' : 'none';
        if (emp.larStart) larStartInput.value = emp.larStart;
        if (emp.larEnd) larEndInput.value = emp.larEnd;
        if (emp.larHoursPerDay) larHoursInput.value = emp.larHoursPerDay;

        function applyLarToDays() {
            if (!emp.larEnabled) return;
            const start = parseInt(larStartInput.value);
            const end = parseInt(larEndInput.value);
            if (isNaN(start) || isNaN(end)) return;
            
            const minD = Math.min(start, end);
            const maxD = Math.max(start, end);
            const hs = emp.larHoursPerDay || 7;
            const endHour = 7 + hs;
            const endStr = `${endHour < 10 ? '0' + endHour : endHour}:00`;
            
            let changed = false;
            emp.days.forEach(d => {
                if (d.dayNum >= minD && d.dayNum <= maxD) {
                    const isRed = d.dow === 0 || isHoliday(d.dayNum);
                    if (d.type !== 'lar') changed = true;
                    d.type = 'lar';
                    if (isRed) {
                        d.start = '';
                        d.end = '';
                    } else {
                        if (d.end !== endStr) changed = true;
                        d.start = '07:00';
                        d.end = endStr;
                    }
                }
            });
            if (changed) {
                const container = card.querySelector('.employee-weeks-container');
                container.innerHTML = '';
                renderWeeksGrid(container, emp.id);
            }
        }

        larToggle.addEventListener('change', () => {
            emp.larEnabled = larToggle.checked;
            larInputs.style.display = emp.larEnabled ? 'flex' : 'none';
            if (emp.larEnabled) applyLarToDays();
        });

        larStartInput.addEventListener('change', () => {
            emp.larStart = parseInt(larStartInput.value) || null;
            applyLarToDays();
        });
        larEndInput.addEventListener('change', () => {
            emp.larEnd = parseInt(larEndInput.value) || null;
            applyLarToDays();
        });
        larHoursInput.addEventListener('change', () => {
            emp.larHoursPerDay = parseInt(larHoursInput.value) || 7;
            applyLarToDays();
        });

        renderWeeksGrid(card.querySelector('.employee-weeks-container'), emp.id);
        recalcLiveHours(emp.id, card);
        DOM.employeesContainer.appendChild(card);
    }

    // Group days into weeks (starting on Monday)
    function buildWeeks(days) {
        const weeks = [];
        let currentWeek = [];
        
        days.forEach(d => {
            currentWeek.push(d);
            if (d.dow === 0) { // Sunday ends the week
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });
        if (currentWeek.length > 0) weeks.push(currentWeek);
        return weeks;
    }

    function renderWeeksGrid(container, empId) {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;

        const weeks = buildWeeks(emp.days);

        weeks.forEach((weekDays, wIdx) => {
            const weekBlock = document.createElement('div');
            weekBlock.className = 'week-block';
            
            // Header for the week
            const header = document.createElement('div');
            header.className = 'week-header';
            header.innerHTML = `
                <h5>Semana ${wIdx + 1} (${weekDays[0].dayNum} al ${weekDays[weekDays.length-1].dayNum})</h5>
                <div class="pattern-actions">
                    <button class="btn btn-ghost btn-xs btn-copy-week" title="Copiar esta semana">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Copiar
                    </button>
                    <button class="btn btn-ghost btn-xs btn-paste-week" title="Pegar aquí">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                        Pegar
                    </button>
                </div>
            `;
            
            // Copy logic
            header.querySelector('.btn-copy-week').addEventListener('click', () => {
                // Copy a mapping of DOW -> Settings
                copiedPattern = weekDays.map(d => ({
                    dow: d.dow, type: d.type, start: d.start, end: d.end
                }));
                toast(`Semana ${wIdx + 1} copiada`, 'success');
            });

            // Paste logic
            header.querySelector('.btn-paste-week').addEventListener('click', () => {
                if (!copiedPattern) {
                    toast('Copia una semana primero', 'warning');
                    return;
                }
                weekDays.forEach(d => {
                    const src = copiedPattern.find(p => p.dow === d.dow);
                    if (src) {
                        d.type = src.type;
                        d.start = src.start;
                        d.end = src.end;
                    }
                });
                toast(`Patrón pegado en Semana ${wIdx + 1}`, 'success');
                // Re-render only this employee's grid
                container.innerHTML = '';
                renderWeeksGrid(container, empId);
            });

            const grid = document.createElement('div');
            grid.className = 'schedule-pattern-grid';

            // Days rows
            weekDays.forEach(day => {
                const row = document.createElement('div');
                row.className = 'pattern-day-row';

                const hol = isHoliday(day.dayNum);
                const isRed = day.dow === 0 || hol;
                
                const label = document.createElement('div');
                label.className = `day-label ${isRed ? 'is-holiday' : ''}`;
                
                const extra = hol ? `<span style="font-size:0.65rem; opacity:0.8; margin-left:4px;">(Feriado)</span>` : '';
                label.innerHTML = `<span class="day-abbr">${DAY_NAMES_FULL[day.dow]}</span>${day.dayNum} ${extra}`;

                const typeSelect = document.createElement('select');
                TYPE_OPTIONS.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt.value;
                    o.textContent = opt.label;
                    if (opt.value === day.type) o.selected = true;
                    typeSelect.appendChild(o);
                });

                const isTimeEnabledInit = (day.type === 'work' || day.type === 'lar') && !(day.type === 'lar' && isRed);

                const startInput = document.createElement('input');
                startInput.type = 'time';
                startInput.value = day.start || '07:00';
                startInput.disabled = !isTimeEnabledInit;
                startInput.style.display = isTimeEnabledInit ? '' : 'none';

                const endInput = document.createElement('input');
                endInput.type = 'time';
                endInput.value = day.end || '15:00';
                endInput.disabled = !isTimeEnabledInit;
                endInput.style.display = isTimeEnabledInit ? '' : 'none';

                startInput.addEventListener('change', () => {
                    day.start = startInput.value;
                    recalcLiveHours(emp.id, row.closest('.employee-card'));
                });
                endInput.addEventListener('change', () => {
                    day.end = endInput.value;
                    recalcLiveHours(emp.id, row.closest('.employee-card'));
                });

                typeSelect.addEventListener('change', () => {
                    day.type = typeSelect.value;
                    const isTimeEnabled = (day.type === 'work' || day.type === 'lar') && !(day.type === 'lar' && isRed);
                    startInput.disabled = !isTimeEnabled;
                    endInput.disabled = !isTimeEnabled;
                    startInput.style.display = isTimeEnabled ? '' : 'none';
                    endInput.style.display = isTimeEnabled ? '' : 'none';
                    if (!isTimeEnabled) {
                        day.start = '';
                        day.end = '';
                    } else {
                        day.start = startInput.value || '07:00';
                        day.end = endInput.value || (day.type === 'lar' ? '14:00' : '15:00');
                    }
                    startInput.value = day.start;
                    endInput.value = day.end;
                    updateDayRowColor(row, day.type);
                    recalcLiveHours(emp.id, row.closest('.employee-card'));
                });

                // Init visual state
                updateDayRowColor(row, day.type);
                typeSelect.dispatchEvent(new Event('change'));

                const dayActions = document.createElement('div');
                dayActions.className = 'day-actions';
                dayActions.style.display = 'flex';
                dayActions.style.gap = '4px';
                dayActions.style.marginLeft = 'auto';

                const btnCopyDay = document.createElement('button');
                btnCopyDay.className = 'btn-icon btn-xs';
                btnCopyDay.title = 'Copiar Día';
                btnCopyDay.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                
                const btnPasteDay = document.createElement('button');
                btnPasteDay.className = 'btn-icon btn-xs';
                btnPasteDay.title = 'Pegar Día';
                btnPasteDay.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>';
                
                btnCopyDay.addEventListener('click', () => {
                    copiedDayPattern = { type: day.type, start: day.start, end: day.end };
                    toast('Día copiado', 'success');
                });

                btnPasteDay.addEventListener('click', () => {
                    if (!copiedDayPattern) {
                        toast('Copia un día primero', 'warning');
                        return;
                    }
                    day.type = copiedDayPattern.type;
                    day.start = copiedDayPattern.start;
                    day.end = copiedDayPattern.end;
                    
                    typeSelect.value = day.type;
                    startInput.value = day.start;
                    endInput.value = day.end;
                    typeSelect.dispatchEvent(new Event('change'));
                    toast('Día pegado', 'success');
                });

                dayActions.appendChild(btnCopyDay);
                dayActions.appendChild(btnPasteDay);

                row.appendChild(label);
                row.appendChild(typeSelect);
                row.appendChild(startInput);
                row.appendChild(endInput);
                row.appendChild(dayActions);
                
                // Pincel interaction intercept
                row.addEventListener('click', (e) => {
                    if (activeBrush) {
                        e.preventDefault();
                        e.stopPropagation();
                        const allBrushes = [...DEFAULT_BRUSHES, ...customBrushes];
                        const brush = allBrushes.find(b => b.id === activeBrush);
                        if (!brush) return;

                        const isRed = day.dow === 0 || isHoliday(day.dayNum);

                        if (brush.type === 'work') {
                            if (day.type === 'lar') {
                                // Mantiene tipo L.A.R., solo actualiza los horarios
                                day.start = brush.start;
                                day.end = brush.end;
                            } else {
                                day.type = 'work';
                                day.start = brush.start;
                                day.end = brush.end;
                            }
                        } else if (brush.type === 'lar') {
                            day.type = 'lar';
                            if (isRed) {
                                day.start = '';
                                day.end = '';
                            } else {
                                // Mantiene los horarios actuales si existen
                                day.start = day.start || '07:00';
                                day.end = day.end || '14:00';
                            }
                        } else {
                            day.type = brush.type;
                            day.start = brush.start;
                            day.end = brush.end;
                        }

                        typeSelect.value = day.type;
                        startInput.value = day.start;
                        endInput.value = day.end;
                        typeSelect.dispatchEvent(new Event('change'));

                        // visual feedback
                        row.style.transform = 'scale(0.95)';
                        setTimeout(() => row.style.transform = 'none', 100);
                    }
                }, true); // Use capture phase so we intercept clicks on inputs too

                grid.appendChild(row);
            });

            weekBlock.appendChild(header);
            weekBlock.appendChild(grid);
            container.appendChild(weekBlock);
        });
    }

    // ───── SCHEDULE GENERATION ─────
    function generateSchedule() {
        const month = parseInt(DOM.monthSelect.value);
        const year = parseInt(DOM.yearInput.value);
        const daysInMonth = getDaysInMonth(year, month);

        const scheduleEmployees = employees.map(emp => {
            const finalDays = emp.days.map(d => {
                let hours = 0;
                if (d.type === 'work' && d.start && d.end) {
                    hours = calcHours(d.start, d.end);
                } else if (d.type === 'lar') {
                    if (d.dow === 0) {
                        hours = 0;
                    } else if (d.start && d.end) {
                        hours = calcHours(d.start, d.end);
                    }
                }
                return {
                    ...d,
                    dowAbbr: DAY_ABBRS[d.dow],
                    hours,
                    isRed: d.dow === 0 || isHoliday(d.dayNum)
                };
            });

            const totalHours = finalDays.reduce((sum, d) => sum + d.hours, 0);
            return {
                name: emp.name,
                targetHours: emp.hours,
                totalHours,
                diff: totalHours - emp.hours,
                days: finalDays,
            };
        });

        generatedSchedule = {
            month, year,
            department: DOM.departmentName.value || 'DEPARTAMENTO',
            daysInMonth,
            employees: scheduleEmployees,
        };

        return generatedSchedule;
    }

    function calcHours(start, end) {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        let diff = h2 - h1 + (m2 - m1) / 60;
        if (diff < 0) diff += 24; // Crosses midnight
        return diff;
    }

    function updateDayRowColor(row, type) {
        row.classList.remove('type-work', 'type-franco', 'type-lar');
        if (type === 'work') row.classList.add('type-work');
        else if (type === 'franco') row.classList.add('type-franco');
        else if (type === 'lar') row.classList.add('type-lar');
    }

    function recalcLiveHours(empId, card) {
        const emp = employees.find(e => e.id === empId);
        if (!emp || !card) return;
        
        let total = 0;
        emp.days.forEach(d => {
            if (d.type === 'lar' && (d.dow === 0 || isHoliday(d.dayNum))) return;
            if (d.start && d.end && (d.type === 'work' || d.type === 'lar')) {
                total += calcHours(d.start, d.end);
            }
        });
        emp.totalHours = total;
        emp.diff = total - emp.hours;

        const liveEl = card.querySelector('.emp-hours-live');
        if (liveEl) {
            liveEl.textContent = `Realizadas: ${total} / ${emp.hours} hs`;
            liveEl.classList.remove('overtime', 'exact-time');
            if (total > emp.hours) {
                liveEl.classList.add('overtime');
            } else if (total === emp.hours) {
                liveEl.classList.add('exact-time');
            }
        }
    }

    // ───── PREVIEW ─────
    function generateAndShowPreview() {
        if (employees.length === 0) {
            toast('Agrega al menos un empleado', 'warning');
            return;
        }

        const schedule = generateSchedule();
        renderPreview(schedule);
        navigateTo(3);
        toast('Cronograma generado correctamente', 'success');
    }

    function renderPreview(schedule) {
        const { month, year, daysInMonth, employees: emps } = schedule;

        DOM.previewMonthYear.textContent = `${MONTH_NAMES[month]} ${year}`;
        DOM.previewEmpCount.textContent = `${emps.length} empleado${emps.length !== 1 ? 's' : ''}`;

        // Header
        let theadHtml = '<tr><th>Empleado</th>';
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dow = date.getDay();
            const isRed = dow === 0 || isHoliday(d);
            const cls = isRed ? ' day-header-sun' : '';
            theadHtml += `<th class="${cls}"><div class="day-header-dow">${DAY_ABBRS[dow]}</div><div class="day-header-num">${d}</div></th>`;
        }
        theadHtml += '<th>Total</th></tr>';
        DOM.previewThead.innerHTML = theadHtml;

        // Body
        let tbodyHtml = '';
        emps.forEach((emp, i) => {
            const displayName = emp.name;
            tbodyHtml += `<tr class="emp-row-name"><td>${displayName}</td>`;
            emp.days.forEach(day => {
                let cls = '', content = '';
                if (day.type === 'work') {
                    cls = 'cell-work';
                    content = `${day.start}<br>${day.end}`;
                } else if (day.type === 'franco') {
                    cls = 'cell-franco';
                    content = 'F';
                } else if (day.type === 'descanso') {
                    cls = 'cell-descanso';
                    content = 'D';
                } else if (day.type === 'ausente') {
                    cls = 'cell-ausente';
                    content = 'A';
                } else if (day.type === 'lar') {
                    cls = 'cell-lar';
                    content = 'L.A.R.';
                }
                // Outline if it's red day but worked
                if (day.isRed && day.type === 'work') cls += ' cell-ausente'; 
                tbodyHtml += `<td class="${cls}">${content}</td>`;
            });
            tbodyHtml += `<td class="cell-total">${emp.totalHours}h</td></tr>`;

            tbodyHtml += `<tr class="emp-row-hours"><td>HS: ${emp.targetHours} / T: ${emp.totalHours} / D: ${emp.diff >= 0 ? '+' : ''}${emp.diff}</td>`;
            emp.days.forEach(day => {
                tbodyHtml += `<td class="${day.hours > 0 ? 'cell-work' : ''}">${day.hours > 0 ? day.hours + 'h' : ''}</td>`;
            });
            tbodyHtml += '<td></td></tr>';

            if (i < emps.length - 1) {
                tbodyHtml += `<tr class="emp-separator"><td colspan="${daysInMonth + 2}"></td></tr>`;
            }
        });

        DOM.previewTbody.innerHTML = tbodyHtml;
    }

    // ───── EXCEL EXPORT ─────
    async function exportToExcel() {
        if (!generatedSchedule) {
            toast('Primero genera la vista previa', 'warning');
            return;
        }

        const btn = $('#btn-export-excel');
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            await buildAndDownloadExcel(generatedSchedule);
            toast('Excel exportado correctamente', 'success');
            updateStepIndicator(4);
        } catch (err) {
            console.error(err);
            toast('Error al exportar: ' + err.message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    async function buildAndDownloadExcel(schedule) {
        const { month, year, department, daysInMonth, employees: emps } = schedule;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'CronoExcel';
        const ws = workbook.addWorksheet('Cronograma', { 
            views: [{ showGridLines: false }],
            pageSetup: {
                paperSize: 5, // 5 = Legal/Oficio
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0 // Allow it to span multiple pages vertically if needed
            }
        });

        ws.getColumn(1).width = 20;
        for (let c = 2; c <= 33; c++) ws.getColumn(c).width = 5.5;

        const thin = { style: 'thin', color: { argb: 'FF333333' } };
        const borderAll = { top: thin, bottom: thin, left: thin, right: thin };

        function setCell(row, col, value, opts = {}) {
            const cell = ws.getRow(row).getCell(col);
            cell.value = value;
            if (opts.font) cell.font = opts.font;
            if (opts.fill) cell.fill = opts.fill;
            if (opts.alignment) cell.alignment = opts.alignment;
            if (opts.border) cell.border = opts.border;
            return cell;
        }

        function mergeCells(r1, c1, r2, c2) { ws.mergeCells(r1, c1, r2, c2); }
        
        const fontArial = (size, bold = true, color = '000000', underline = false) => ({
            name: 'Arial', size, bold, underline, color: { argb: 'FF' + color }
        });
        const fontTNR = (size, bold = false, color = '000000') => ({
            name: 'Times New Roman', size, bold, color: { argb: 'FF' + color }
        });

        const alignCenter = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const alignLeft = { horizontal: 'left', vertical: 'middle', wrapText: true };

        // Headers
        const lastCol = daysInMonth + 1;
        const right1Start = lastCol - 2;
        const right1End = lastCol;
        const right2Start = lastCol - 6;
        const right2End = lastCol - 3;
        const leftStart = 4;
        const leftEnd = lastCol - 7;

        mergeCells(1, leftStart, 1, leftEnd); setCell(1, leftStart, department, { font: fontArial(12, true, '000000', 'single'), alignment: alignCenter });
        mergeCells(1, right2Start, 1, right2End); setCell(1, right2Start, 'M: Turno Mañana', { font: fontArial(10, true), alignment: alignLeft });
        mergeCells(1, right1Start, 1, right1End); setCell(1, right1Start, 'D: Descanso', { font: fontArial(10, false), alignment: alignLeft });

        mergeCells(2, leftStart, 2, leftEnd); setCell(2, leftStart, 'DISTRIBUCION DE TURNOS', { font: fontArial(10, false), alignment: alignCenter });
        mergeCells(2, right2Start, 2, right2End); setCell(2, right2Start, 'T: Turno Tarde', { font: fontArial(10, true), alignment: alignLeft });
        mergeCells(2, right1Start, 2, right1End); setCell(2, right1Start, 'A: Ausente', { font: fontArial(10, false), alignment: alignLeft });

        const defaultTarget = parseInt(DOM.targetHours.value) || 220;
        mergeCells(3, leftStart, 3, leftEnd); setCell(3, leftStart, `HORAS A TRABAJAR: ${defaultTarget} HS`, { font: fontArial(10, true), alignment: alignCenter });
        mergeCells(3, right2Start, 3, right2End); setCell(3, right2Start, 'F: Franco', { font: fontArial(10, true), alignment: alignLeft });
        mergeCells(3, right1Start, 3, right1End); setCell(3, right1Start, 'N: Turno noche', { font: fontArial(10, false), alignment: alignLeft });

        // Row 4 & 5: Month and Year
        setCell(4, 1, MONTH_NAMES[month].toUpperCase(), { font: fontArial(12, true), alignment: alignCenter, border: borderAll });
        setCell(5, 1, year, { font: fontArial(12, true), alignment: alignCenter, border: borderAll });

        // Merge the empty space to the right into ONE large cell across both rows
        mergeCells(4, 2, 5, lastCol);
        setCell(4, 2, '', { border: borderAll });

        for (let r = 1; r <= 5; r++) ws.getRow(r).height = 18;

        let currentRow = 6;
        const allEmps = [...emps];
        
        // Add templates
        for (let t = 0; t < 2; t++) {
            allEmps.push({
                id: 'New', name: '', targetHours: defaultTarget, totalHours: 0, diff: -defaultTarget,
                days: Array.from({ length: daysInMonth }, (_, i) => ({
                    dayNum: i + 1, dow: new Date(year, month, i + 1).getDay(),
                    dowAbbr: DAY_ABBRS[new Date(year, month, i + 1).getDay()],
                    type: '', start: '', end: '', hours: 0,
                    isRed: new Date(year, month, i + 1).getDay() === 0 || isHoliday(i+1)
                })),
                isEmpty: true,
            });
        }

        for (const emp of allEmps) {
            const r1 = currentRow, r2 = currentRow + 1, r3 = currentRow + 2, r4 = currentRow + 3, r5 = currentRow + 4;
            [16, 16, 22, 22, 16].forEach((h, i) => ws.getRow(currentRow + i).height = h);

            // Name (Col 1, R1-R3)
            const displayName = emp.name;
            ws.mergeCells(r1, 1, r3, 1);
            setCell(r1, 1, displayName, { font: fontTNR(10, true), alignment: alignLeft, border: borderAll });
            
            const hsText = emp.isEmpty ? `HS: ${emp.targetHours}   /T: 0 / D:${-emp.targetHours}` : `HS: ${emp.targetHours}   /T: ${emp.totalHours} / D:${emp.diff}`;
            setCell(r4, 1, hsText, { font: fontArial(7, true), alignment: alignLeft, border: borderAll });
            setCell(r5, 1, emp.totalHours || '', { font: fontArial(8, true), alignment: alignCenter, border: borderAll });

            for (let d = 0; d < daysInMonth; d++) {
                const col = d + 2;
                const day = emp.days[d];
                const fontColor = day.isRed ? 'FF0000' : '000000'; // RED for holidays/Sundays

                setCell(r1, col, day.dowAbbr, { font: fontArial(8, true, fontColor), alignment: alignCenter, border: borderAll });
                setCell(r2, col, day.dayNum, { font: fontArial(8, true, fontColor), alignment: alignCenter, border: borderAll });
                setCell(r5, col, day.hours > 0 ? day.hours : '', { font: fontArial(8, true, fontColor), alignment: alignCenter, border: borderAll });
                
                setCell(r3, col, '', { font: fontArial(8, true, fontColor), alignment: alignCenter, border: borderAll });
                setCell(r4, col, '', { font: fontArial(8, true, fontColor), alignment: alignCenter, border: borderAll });
            }

            if (!emp.isEmpty) applyMergingRules(ws, emp, r3, r4, daysInMonth);

            for (let c = 1; c <= daysInMonth + 1; c++) {
                ws.getRow(r5).getCell(c).border = { ...borderAll, bottom: { style: 'medium', color: { argb: 'FF000000' } } };
            }
            currentRow += 5;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const depStr = department ? department.toUpperCase().trim() : 'DEPOSITO';
        a.download = `CRONOGRAMA ${depStr} ${MONTH_NAMES[month].toUpperCase()} ${year}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    function applyMergingRules(ws, emp, r3, r4, daysInMonth) {
        const thin = { style: 'thin', color: { argb: 'FF333333' } };
        const borderAll = { top: thin, bottom: thin, left: thin, right: thin };
        const alignCenter = { horizontal: 'center', vertical: 'middle', wrapText: true };

        const processed = new Array(daysInMonth).fill(false);
        let d = 0;
        
        while (d < daysInMonth) {
            const day = emp.days[d];
            const col = d + 2;
            const fontColor = day.isRed ? 'FF0000' : '000000';
            const fontArial = (size) => ({ name: 'Arial', size, bold: true, color: { argb: 'FF' + fontColor } });

            if (day.type === 'lar') {
                let runEnd = d;
                while (runEnd + 1 < daysInMonth && emp.days[runEnd + 1].type === 'lar') {
                    runEnd++;
                }
                const runLen = runEnd - d + 1;
                const colStart = d + 2;
                const colEnd = runEnd + 2;
                
                if (runLen > 1) ws.mergeCells(r3, colStart, r4, colEnd);
                else ws.mergeCells(r3, colStart, r4, colStart);

                const cell = ws.getRow(r3).getCell(colStart);
                cell.value = `L.A.R. ${runLen} DIAS`;
                const fontSize = runLen >= 5 ? 16 : runLen === 4 ? 14 : runLen === 3 ? 12 : 8;
                cell.font = { name: 'Arial', size: fontSize, bold: true, color: { argb: 'FF000000' } };
                cell.alignment = alignCenter;
                cell.border = borderAll;
                for (let i = d; i <= runEnd; i++) processed[i] = true;
                d = runEnd + 1;
            } else if (day.type !== 'work') {
                const label = day.type === 'franco' ? 'F' : day.type === 'descanso' ? 'D' : 'A';
                ws.mergeCells(r3, col, r4, col);
                const cell = ws.getRow(r3).getCell(col);
                cell.value = label;
                cell.font = fontArial(16);
                cell.alignment = alignCenter;
                cell.border = borderAll;
                processed[d] = true;
                d++;
            } else {
                let runEnd = d;
                while (runEnd + 1 < daysInMonth &&
                       emp.days[runEnd + 1].type === 'work' &&
                       emp.days[runEnd + 1].start === day.start &&
                       emp.days[runEnd + 1].end === day.end) {
                    runEnd++;
                }
                const runLen = runEnd - d + 1;

                if (runLen >= 3) {
                    const colStart = d + 2;
                    const colEnd = runEnd + 2;
                    ws.mergeCells(r3, colStart, r4, colEnd);
                    const cell = ws.getRow(r3).getCell(colStart);
                    cell.value = `${day.start} A ${day.end}`;
                    const fontSize = runLen >= 5 ? 16 : runLen === 4 ? 14 : runLen === 3 ? 12 : 8;
                    cell.font = { name: 'Arial', size: fontSize, bold: true, color: { argb: 'FF000000' } };
                    cell.alignment = alignCenter;
                    cell.border = borderAll;
                    for (let i = d; i <= runEnd; i++) processed[i] = true;
                    d = runEnd + 1;
                } else {
                    for (let i = d; i <= runEnd; i++) {
                        const c = i + 2;
                        const cColor = emp.days[i].isRed ? 'FF0000' : '000000';
                        const cFont = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF' + cColor } };
                        
                        ws.getRow(r3).getCell(c).value = emp.days[i].start;
                        ws.getRow(r3).getCell(c).font = cFont;
                        ws.getRow(r3).getCell(c).alignment = alignCenter;
                        ws.getRow(r3).getCell(c).border = borderAll;

                        ws.getRow(r4).getCell(c).value = emp.days[i].end;
                        ws.getRow(r4).getCell(c).font = cFont;
                        ws.getRow(r4).getCell(c).alignment = alignCenter;
                        ws.getRow(r4).getCell(c).border = borderAll;
                        processed[i] = true;
                    }
                    d = runEnd + 1;
                }
            }
        }
    }

    // ───── STORAGE ─────
    function loadFromStorageLegacy() {
        try {
            const raw = localStorage.getItem('cronoexcel_config_v2');
            if (!raw) return;
            const data = JSON.parse(raw);
            DOM.departmentName.value = data.department || '';
            DOM.monthSelect.value = data.month || 0;
            DOM.yearInput.value = data.year || 2026;
            DOM.targetHours.value = data.targetHours || 220;

            refreshHolidays();
            if (data.holidays && Array.isArray(data.holidays)) {
                data.holidays.forEach(h => currentHolidays.push(h));
                currentHolidays.sort((a,b) => a.day - b.day);
                renderHolidays();
            }

            if (data.employees && data.employees.length > 0) {
                employees = [];
                employeeIdCounter = 0;
                DOM.employeesContainer.innerHTML = '';
                data.employees.forEach(e => addEmployee(e));
            }
        } catch (err) {}
    }
    function saveToFile() {
        try {
            const data = {
                department: DOM.departmentName.value,
                month: DOM.monthSelect.value,
                year: DOM.yearInput.value,
                targetHours: DOM.targetHours.value,
                holidays: currentHolidays.filter(h => h.custom),
                employees: employees.map(e => ({
                    name: e.name, hours: e.hours, 
                    larEnabled: e.larEnabled, larStart: e.larStart, larEnd: e.larEnd,
                    larHoursPerDay: e.larHoursPerDay,
                    days: e.days
                })),
            };
            const str = JSON.stringify(data, null, 2);
            const blob = new Blob([str], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Backup_${MONTH_NAMES[data.month]}_${data.year}.json`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast('Backup descargado', 'success');
        } catch (err) {
            toast('Error al descargar', 'error');
        }
    }

    function loadFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    DOM.departmentName.value = data.department || '';
                    DOM.monthSelect.value = data.month || 0;
                    DOM.yearInput.value = data.year || 2026;
                    DOM.targetHours.value = data.targetHours || 220;

                    refreshHolidays();
                    if (data.holidays && Array.isArray(data.holidays)) {
                        data.holidays.forEach(h => currentHolidays.push(h));
                        currentHolidays.sort((a,b) => a.day - b.day);
                        renderHolidays();
                    }

                    if (data.employees && data.employees.length > 0) {
                        employees = [];
                        employeeIdCounter = 0;
                        DOM.employeesContainer.innerHTML = '';
                        data.employees.forEach(e => addEmployee(e));
                    }
                    toast('Backup cargado exitosamente', 'success');
                } catch (err) {
                    toast('Archivo inválido', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // ───── START ─────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
