const fs = require('fs');
let html = fs.readFileSync('index.html');
// If there's a BOM or weird encoding, reading as buffer and converting to utf8 might show .
let str = html.toString('utf8');
str = str.replace(/\?"/g, 'ó');
str = str.replace(/\?/g, 'ó');
str = str.replace(//g, 'ó');
fs.writeFileSync('index.html', str, 'utf8');
console.log('Fixed index.html encoding!');
