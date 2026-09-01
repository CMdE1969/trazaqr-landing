#!/usr/bin/env node
/**
 * scripts/build-header.js
 * ---------------------------------------------------------------------
 * Inserta el contenido del partial de cabecera correspondiente (por
 * defecto partials/header.html — ÚNICA FUENTE DE VERDAD del Header/Nav
 * público del sitio) entre los marcadores
 *
 *     <!-- TQR:HEADER:START -->
 *     <!-- TQR:HEADER:END -->
 *
 * de cada página pública listada en PAGES, más abajo.
 *
 * Algunas páginas pueden usar un partial DISTINTO al general (variante),
 * declarado en su propia entrada de PAGES — hoy solo ayuda.html, que usa
 * partials/header-ayuda.html (cabecera reducida: Academia + teléfono +
 * botón "Volver a la app", sin el resto de enlaces de la landing).
 *
 * NO EDITAR el <nav> a mano dentro de esas páginas: cualquier cambio ahí
 * se perderá (y "--check" lo detectará como desincronizado) en el
 * próximo build. Edita SIEMPRE el partial correspondiente.
 *
 * Uso (desde la raíz del repo, trazaqr-landing):
 *
 *   node scripts/build-header.js           Reescribe las páginas que
 *                                           estén desincronizadas de su
 *                                           partial. No toca las que ya
 *                                           estén al día.
 *
 *   node scripts/build-header.js --check   No escribe nada. Sale con
 *                                           código 1 si alguna página
 *                                           está desincronizada de su
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
const DEFAULT_PARTIAL = 'header.html';

// Las 16 páginas públicas que llevan la cabecera global. Cada entrada
// puede llevar `partial` para usar un fichero de partials/ distinto al
// general (DEFAULT_PARTIAL); si se omite, usa el general.
const PAGES = [
  { file: 'index.html' },
  { file: 'academia/index.html' },
  { file: 'academia/deca/index.html' },
  { file: 'academia/deca/que-es-el-deca.html' },
  { file: 'academia/deca/quien-debe-generar.html' },
  { file: 'academia/deca/quien-esta-obligado.html' },
  { file: 'academia/deca/sin-deca-control-carretera.html' },
  { file: 'academia/deca/transporte-internacional.html' },
  { file: 'academia/deca/transporte-privado-complementario.html' },
  { file: 'academia/deca/transportista-autonomo.html' },
  { file: 'deca/estoy-obligado.html' },
  { file: 'ayuda.html', partial: 'header-ayuda.html' },
  { file: 'terminos.html' },
  { file: 'privacidad.html' },
  { file: 'cookies.html' },
  { file: 'aviso-legal.html' },
];

const START_MARKER = '<!-- TQR:HEADER:START';
const END_MARKER = '<!-- TQR:HEADER:END -->';

function generatedNote(partialName) {
  return (
    ` — generado automáticamente desde partials/${partialName} por ` +
    'scripts/build-header.js. NO editar a mano: los cambios se perderán. -->'
  );
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function buildBlock(partialContent, partialName) {
  return (
    START_MARKER + generatedNote(partialName) + '\n' +
    partialContent.trim() + '\n' +
    END_MARKER
  );
}

function main() {
  const checkOnly = process.argv.includes('--check');

  // Carga (una vez cada uno) todos los partials distintos que use PAGES.
  const partialNames = [...new Set(PAGES.map((p) => p.partial || DEFAULT_PARTIAL))];
  const partials = {};
  for (const name of partialNames) {
    const partialPath = path.join(ROOT, 'partials', name);
    if (!fs.existsSync(partialPath)) {
      console.error('No se encuentra partials/' + name + ' en ' + partialPath);
      process.exit(1);
    }
    partials[name] = fs.readFileSync(partialPath, 'utf8');
  }

  const outOfSync = [];
  const broken = [];
  const missing = [];

  for (const { file: rel, partial } of PAGES) {
    const partialName = partial || DEFAULT_PARTIAL;
    const block = buildBlock(partials[partialName], partialName);

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
        console.error('\nDesincronizadas respecto a su partial:');
        outOfSync.forEach((f) => console.error('  - ' + f));
        console.error('\nEjecuta: node scripts/build-header.js');
      }
      process.exit(1);
    }
    console.log(`OK — ${PAGES.length} páginas sincronizadas con su partial de cabecera`);
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
