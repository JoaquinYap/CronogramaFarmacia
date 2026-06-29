const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Add saveHistoryState to btn-duplicate-employee
code = code.replace(/card\.querySelector\('\.btn-duplicate-employee'\)\.addEventListener\('click', \(\) => \{/g, 
  `card.querySelector('.btn-duplicate-employee').addEventListener('click', () => {
        saveHistoryState();`);

// 2. Add saveHistoryState to brush mousedown
code = code.replace(/row\.addEventListener\('click', \(e\) => \{([\s\S]*?)if \(activeBrush\) \{/g, 
  `row.addEventListener('click', (e) => {$1if (activeBrush) {\n                        saveHistoryState();`);

// 3. Add saveHistoryState to btnPasteWeek
code = code.replace(/header\.querySelector\('\.btn-paste-week'\)\.addEventListener\('click', \(\) => \{/g, 
  `header.querySelector('.btn-paste-week').addEventListener('click', () => {
                saveHistoryState();`);

// 4. Add saveHistoryState to btnPasteDay
code = code.replace(/btnPasteDay\.addEventListener\('click', \(\) => \{/g, 
  `btnPasteDay.addEventListener('click', () => {
                    saveHistoryState();`);

// 5. Add SortableJS initialization to renderEmployees (wait, renderEmployees re-renders everything. Better to init Sortable once on DOM.employeesContainer).
// I will add a bindEvents additions block.
let bindEventsRegex = /function bindEvents\(\) \{([\s\S]*?)\}/;
let bindEventsCode = code.match(bindEventsRegex);
if (bindEventsCode) {
    let newBindEvents = bindEventsCode[1] + `
        // Undo / Redo / Directory bindings
        if(DOM.btnUndo) DOM.btnUndo.addEventListener('click', undo);
        if(DOM.btnRedo) DOM.btnRedo.addEventListener('click', redo);
        if(DOM.btnDirectory) DOM.btnDirectory.addEventListener('click', openDirectoryModal);
        if(DOM.btnCloseDirectory) DOM.btnCloseDirectory.addEventListener('click', () => DOM.directoryModal.style.display = 'none');
        if(DOM.btnImportDirectory) DOM.btnImportDirectory.addEventListener('click', importFromDirectory);
        
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
        });

        // Initialize SortableJS
        if (typeof Sortable !== 'undefined' && DOM.employeesContainer) {
            new Sortable(DOM.employeesContainer, {
                handle: '.employee-drag-handle',
                animation: 150,
                onEnd: function (evt) {
                    saveHistoryState();
                    const item = employees.splice(evt.oldIndex, 1)[0];
                    employees.splice(evt.newIndex, 0, item);
                    renumberEmployees();
                }
            });
        }
`;
    code = code.replace(bindEventsRegex, `function bindEvents() {${newBindEvents}}`);
}

fs.writeFileSync('app.js', code);
console.log('App JS patched 1/3');
