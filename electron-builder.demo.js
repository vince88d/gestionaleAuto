// Versione DEMO portable per Windows: un solo .exe che parte senza
// installazione. Nome, identificativo e cartella dati sono DIVERSI dalla
// versione normale, cosi' non sostituisce e non tocca il gestionale gia'
// installato dal cliente (che usa %APPDATA%\react-electron): la demo usa
// %APPDATA%\Gestionale Noleggio Demo.
// Si crea con: npm run dist:demo  ->  dist-demo/Gestionale-Noleggio-DEMO-<versione>.exe
module.exports = {
  extends: null,
  appId: 'com.gestionaleauto.demo',
  productName: 'Gestionale Noleggio Demo',
  extraMetadata: {
    main: 'main.js',
    name: 'gestionale-noleggio-demo',
    productName: 'Gestionale Noleggio Demo',
  },
  directories: { output: 'dist-demo' },
  files: ['build/**/*', 'main.js', 'preload.js', 'package.json'],
  extraResources: [{ from: 'assets', to: 'assets' }],
  win: { target: [{ target: 'portable', arch: ['x64'] }] },
  portable: { artifactName: 'Gestionale-Noleggio-DEMO-${version}.exe' },
};
