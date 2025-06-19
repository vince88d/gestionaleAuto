const fs = require('fs');
const path = require('path');

const appName = 'react-electron'; // <- usa il tuo nome app se diverso
const platform = 'win32'; // o 'darwin' per macOS
const arch = 'x64'; // o 'arm64' se necessario

const sourcePath = path.join(__dirname, '../assets/pdf/contratto_completo.pdf');
const destPath = path.join(__dirname, `../out/${appName}-${platform}-${arch}/resources/pdf/contratto_completo.pdf`);

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.copyFileSync(sourcePath, destPath);

console.log('✅ contratto_completo.pdf copiato in resources/pdf');
