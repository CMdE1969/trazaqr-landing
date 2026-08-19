#!/usr/bin/env node
/**
 * scripts/build-header.js
 * ---------------------------------------------------------------------
 * Inserta el contenido de partials/header.html (ÚNICA FUENTE DE VERDAD
 * del Header/Nav público) entre los marcadores
 *
 *     <!-- TQR:HEADER:START -->
 *     <!-- TQR:HEADER:END -->
 *
 * de cada página pública listada en PAGES, más abajo.
 *
 * NO EDITAR el <nav> a mano dentro de esas páginas: cualquier cambio ahí
 * se perderá (y "--check" lo detectará como desincronizado) en el
 * próximo build. Edita SIEMPRE partials/header.html.
 *
 * Uso (desde la raíz del repo, trazaqr-landing):
 *
 *   node scripts/build-header.js           Reescribe las páginas que
 *                                           estén desincronizadas del
 *                                           partial. No toca las que ya
 *                                           estén al día.
 *
 *   node scripts/build-header.js --check   No escribe nada. Sale con
 *                                           código 1 si alguna página
 *                                           está desincronizada del
 *                                           partial (o tiene marcadores
 *                                           rotos/duplicados). Pensado
 *                                           para correr antes de un
 *                                           commit.
 *
 * Sin dependencias de npm — solo usa los módulos nativos de Node
 * (fs, path). No requiere package.json ni instalar nada.
 * ---------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARTIAL_PATH = path.join(ROOT, 'partials', 'header.html');

// Las 16 páginas públicas que llevan la cabecera global.
const PAGES = [
  'index.html',
  'academia/index.html',
  'academia/deca/index.html',
  'academia/deca/que-es-el-deca.html',
  'academia/deca/quien-debe-generar.html',
  'academia/deca/quien-esta-obligado.html',
  'academia/deca/sin-deca-control-carretera.html',
  'academia/deca/transporte-internacional.html',
  'academia/deca/transporte-privado-complementario.html',
  'academia/deca/transportista-autonomo.html',
  'deca/estoy-obligado.html',
  'ayuda.html',
  'terminos.html',
  'privacidad.html',
  'cookies.html',
  'aviso-legal.html',
];

const START_MARKER = '<!-- TQR:HEADER:START';
const END_MARKER = '<!-- TQR:HEADER:END -->';
const GENERATED_NOTE =
  ' — generado automáticamente desde partials/header.html por ' +
  'scripts/build-header.js. NO editar a mano: los cambios se perderán. -->';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function buildBlock(partialContent) {
  return (
    START_MARKER + GENERATED_NOTE + '\n' +
    partialContent.trim() + '\n' +
    END_MARKER
  );
}

function main() {
  const checkOnly = process.argv.includes('--check');

  if (!fs.existsSync(PARTIAL_PATH)) {
    console.error('No se encuentra partials/header.html en ' + PARTIAL_PATH);
    process.exit(1);
  }

  const partial = fs.readFileSync(PARTIAL_PATH, 'utf8');
  const block = buildBlock(partial);

  const outOfSync = [];
  const broken = [];
  const missing = [];

  for (const rel of PAGES) {
    const filePath = path.join(ROOT, rel);
    if (!fs.existsSync(filePath)) {
      missing.push(rel);
      continue;
    }

    const html = fs.readFileSync(filePath, 'utf8');

    const startCount = countOccurrences(html, START_MARKER);
    const endCount = countOccurrences(html, END_MARKER);
    if (startCount !== 1 || endCount !== 1) {
      broken.push(`${rel} (START x${startCount}, END x${endCount} — debería ser x1 cada uno)`);
      continue;
    }

    const startIdx = html.indexOf(START_MARKER);
    const endIdx = html.indexOf(END_MARKER, startIdx + START_MARKER.length);
    if (endIdx === -1) {
      broken.push(`${rel} (END no aparece después de START)`);
      continue;
    }

    const currentBlock = html.slice(startIdx, endIdx + END_MARKER.length);

    if (currentBlock.trim() === block.trim()) {
      continue; // ya sincronizada, no tocar el fichero
    }

    outOfSync.push(rel);

    if (!checkOnly) {
      const before = html.slice(0, startIdx);
      const after = html.slice(endIdx + END_MARKER.length);
      const newHtml = before + block + after;

      // Verificación de seguridad: el fichero resultante debe tener
      // exactamente un marcador de cada — si no, no se escribe.
      if (countOccurrences(newHtml, START_MARKER) !== 1 || countOccurrences(newHtml, END_MARKER) !== 1) {
        broken.push(`${rel} (la reescritura habría dejado marcadores duplicados — abortada, fichero NO tocado)`);
        outOfSync.pop();
        continue;
      }

      fs.writeFileSync(filePath, newHtml, 'utf8');
    }
  }

  if (missing.length) {
    console.error('Páginas listadas en PAGES que no existen en disco:');
    missing.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }

  if (broken.length) {
    console.error('Páginas con marcadores rotos/duplicados (revisar a mano):');
    broken.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }

  if (checkOnly) {
    if (outOfSync.length || broken.length || missing.length) {
      if (outOfSync.length) {
        console.error('\nDesincronizadas respecto a partials/header.html:');
        outOfSync.forEach((f) => console.error('  - ' + f));
        console.error('\nEjecuta: node scripts/build-header.js');
      }
      process.exit(1);
    }
    console.log(`OK — ${PAGES.length} páginas sincronizadas con partials/header.html`);
    return;
  }

  if (outOfSync.length) {
    console.log(`Actualizada(s) ${outOfSync.length} página(s):`);
    outOfSync.forEach((f) => console.log('  - ' + f));
  } else if (!broken.length && !missing.length) {
    console.log('Ya estaba todo sincronizado — no se ha tocado ningún fichero.');
  }

  if (process.exitCode === 1) {
    process.exit(1);
  }
}

main();
