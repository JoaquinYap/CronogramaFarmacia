const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const directoryAndDashboardCode = `
    // ───── DASHBOARD ─────
    function generateDashboard() {
        if (!DOM.dashBalance) return;
        
        let totalTarget = 0;
        let totalScheduled = 0;
        let balances = [];

        employees.forEach(emp => {
            const target = emp.hours;
            let scheduled = 0;
            emp.days.forEach(d => {
                if (d.type === 'work' || d.type === 'lar') {
                    if (d.start && d.end) {
                        const [sh, sm] = d.start.split(':').map(Number);
                        const [eh, em] = d.end.split(':').map(Number);
                        let diff = (eh + em/60) - (sh + sm/60);
                        if (diff < 0) diff += 24;
                        scheduled += diff;
                    }
                }
            });
            totalTarget += target;
            totalScheduled += scheduled;
            
            balances.push({
                name: emp.name,
                diff: scheduled - target
            });
        });

        DOM.dashBalance.textContent = \`\${Math.round(totalScheduled)} / \${totalTarget} hs\`;
        
        // Sort balances
        balances.sort((a, b) => b.diff - a.diff);
        
        // Top Extras (positive diff)
        const extras = balances.filter(b => b.diff > 0).slice(0, 3);
        DOM.dashExtras.innerHTML = extras.length ? extras.map(b => \`<div>\${b.name}: +\${Math.round(b.diff)}hs</div>\`).join('') : '<div>Ninguno</div>';
        
        // Top Debtors (negative diff)
        const debtors = [...balances].sort((a, b) => a.diff - b.diff).filter(b => b.diff < 0).slice(0, 3);
        DOM.dashDebtors.innerHTML = debtors.length ? debtors.map(b => \`<div>\${b.name}: \${Math.round(b.diff)}hs</div>\`).join('') : '<div>Ninguno</div>';
    }

    // ───── EMPLOYEES DIRECTORY ─────
    let directoryCache = [];

    async function loadDirectoryFromFirebase() {
        if (!currentUser || !db) return [];
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('directory').get();
            let arr = [];
            snapshot.forEach(doc => arr.push(doc.data()));
            directoryCache = arr;
            return arr;
        } catch (e) {
            console.error('Error load dir', e);
            return [];
        }
    }

    async function saveDirectoryToFirebase() {
        if (!currentUser || !db || !employees || employees.length === 0) return;
        try {
            const batch = db.batch();
            const col = db.collection('users').doc(currentUser.uid).collection('directory');
            employees.forEach(emp => {
                if (emp.name.trim()) {
                    const docId = emp.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (docId) {
                        const ref = col.doc(docId);
                        batch.set(ref, {
                            name: emp.name,
                            hours: emp.hours
                        }, { merge: true });
                    }
                }
            });
            await batch.commit();
        } catch (e) {
            console.error('Error save dir', e);
        }
    }

    async function openDirectoryModal() {
        DOM.directoryModal.style.display = 'flex';
        DOM.directoryList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Cargando directorio...</div>';
        const dir = await loadDirectoryFromFirebase();
        if (dir.length === 0) {
            DOM.directoryList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">Tu directorio está vacío. Guardá un cronograma primero para poblarlo automáticamente.</div>';
            return;
        }
        
        DOM.directoryList.innerHTML = '';
        dir.sort((a,b) => a.name.localeCompare(b.name)).forEach((emp, i) => {
            const el = document.createElement('label');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '12px';
            el.style.padding = '8px';
            el.style.background = 'rgba(255,255,255,0.05)';
            el.style.borderRadius = '8px';
            el.style.cursor = 'pointer';
            
            el.innerHTML = \`
                <input type="checkbox" class="dir-checkbox" value="\${i}" style="width: 18px; height: 18px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600;">\${emp.name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">\${emp.hours} hs objetivo</div>
                </div>
            \`;
            DOM.directoryList.appendChild(el);
        });
    }

    function importFromDirectory() {
        saveHistoryState();
        const checkboxes = document.querySelectorAll('.dir-checkbox:checked');
        if (checkboxes.length === 0) {
            toast('No seleccionaste ningún empleado', 'warning');
            return;
        }
        
        checkboxes.forEach(cb => {
            const data = directoryCache[parseInt(cb.value)];
            addEmployee({ name: data.name, hours: data.hours }, true);
        });
        
        DOM.directoryModal.style.display = 'none';
        toast(\`\${checkboxes.length} empleados importados\`, 'success');
    }
`;

code += directoryAndDashboardCode;

// Inject generateDashboard() inside generateAndShowPreview()
code = code.replace(/function generateAndShowPreview\(\) \{/, `function generateAndShowPreview() {
        generateDashboard();`);

// Inject saveDirectoryToFirebase() inside saveConfigToCloud() (after showing toast)
code = code.replace(/toast\('Configuración guardada en la nube', 'success'\);/, `toast('Configuración guardada en la nube', 'success');
            saveDirectoryToFirebase();`);

fs.writeFileSync('app.js', code);
console.log('App JS patched 2/2');
