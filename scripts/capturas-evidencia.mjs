// ---------------------------------------------------------------------------
// Regenera la evidencia de funcionamiento de Kubo (kubo-docs/evidencia/):
//   · 9 capturas PNG a 1360x880 sobre el guion de 09-demo-guion.md
//   · 05-cifrado-en-base.txt y 10-repositorios.txt (comprobaciones reales)
//   · demo-kubo.webm: recorrido con subtitulos (base visual del video) [--video]
//
// Uso (desde kubo-web, donde vive Playwright):
//   make reset-demo        # demo limpia y presentable (recomendado antes)
//   cd kubo-web && node ../kubo-docs/scripts/capturas-evidencia.mjs [--video]
//
// Requiere: sistema arriba (localhost:3000), Chrome, docker y ffmpeg (--video).
// ---------------------------------------------------------------------------
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('@playwright/test');

const VIDEO = process.argv.includes('--video');
const BASE = 'http://localhost:3000';
const SALIDA = resolve(process.cwd(), '../kubo-docs/evidencia');
const WORKSPACE = resolve(process.cwd(), '..');
const TMP_CUADROS = '/tmp/opencode/kubo-evidencia-cuadros';
const VIEWPORT = { width: 1360, height: 880 };
const PAUSA_ARG = Number(process.argv.find((a) => a.startsWith('--pausa='))?.split('=')[1]);
// Pausa por seccion: 25 s al grabar (comodo para narrar los 6-7 min del
// guion; ajustable con --pausa=<segundos>); 0.7 s para capturas rapidas.
const PAUSA = VIDEO ? (PAUSA_ARG > 0 ? PAUSA_ARG * 1000 : 25_000) : 700;

const marcas = []; // subtitulos: {t, texto}
let t0 = 0;

function marcar(texto, retraso = PAUSA / 1000 + 0.3) {
  // La marca se toma despues de la pausa y la captura; se resta ese retraso
  // para que el subtitulo empiece cuando la seccion aparece en pantalla.
  marcas.push({ t: Math.max(0.5, (Date.now() - t0) / 1000 - retraso), texto });
  console.log(`  ▸ ${texto}`);
}

async function pausa(page, ms = PAUSA) {
  await page.waitForTimeout(ms);
}

function srt() {
  const fmt = (s) => {
    const ms = Math.round((s % 1) * 1000);
    const seg = Math.floor(s);
    const hh = String(Math.floor(seg / 3600)).padStart(2, '0');
    const mm = String(Math.floor((seg % 3600) / 60)).padStart(2, '0');
    const ss = String(seg % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss},${String(ms).padStart(3, '0')}`;
  };
  return marcas
    .map((marca, i) => {
      const fin = marcas[i + 1]?.t ?? marca.t + PAUSA / 1000 + 2;
      return `${i + 1}\n${fmt(marca.t)} --> ${fmt(fin)}\n${marca.texto}\n`;
    })
    .join('\n');
}

mkdirSync(SALIDA, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

// Calentamiento: deja cargar la app (fuentes y precache del service worker)
// antes de arrancar el cronometro y el bucle de captura; si no, la primera
// captura espera la carga inicial y el tiempo del video queda desfasado.
await page.goto(`${BASE}/ingresar`);
await page.getByRole('heading', { name: /ingresa a tu negocio/i }).waitFor();
await page.evaluate(() => document.fonts.ready);

t0 = Date.now();

// El video nativo de Playwright solo emite cuadros cuando la pagina cambia y
// los re-timporiza a 25 fps, asi que el webm queda acortado (time-lapse) y los
// subtitulos se desincronizan. En su lugar capturamos cuadros PNG con su marca
// de tiempo real y los ensamblamos con ffmpeg: el tiempo del video es el real.
const cuadros = [];
let capturando = false;
if (VIDEO) {
  mkdirSync(TMP_CUADROS, { recursive: true });
  capturando = true;
  (async () => {
    while (capturando) {
      const t = (Date.now() - t0) / 1000;
      const ruta = join(TMP_CUADROS, `f${String(cuadros.length).padStart(5, '0')}.jpg`);
      try {
        // JPEG (mas liviano para miles de cuadros) con tope de tiempo: si una
        // captura se cuelga, el bucle sigue y el hueco queda como una pausa.
        await page.screenshot({ path: ruta, type: 'jpeg', quality: 90, timeout: 2500 });
        cuadros.push({ t, ruta });
      } catch {
        // Navegacion en curso o captura lenta: se salta el cuadro.
      }
      await new Promise((r) => setTimeout(r, 140));
    }
  })();
}

// ---------------------------------------------------------------------------
// Recorrido (sigue el guion de demostracion)
// ---------------------------------------------------------------------------

// 01 · Ingreso
await page.goto(`${BASE}/ingresar`);
await page.getByRole('heading', { name: /ingresa a tu negocio/i }).waitFor();
await pausa(page);
await page.screenshot({ path: join(SALIDA, '01-ingreso.png') });
marcar('Ingreso: la PWA de Kubo');

await page.getByLabel('Correo').fill('admin@kubo.local');
await page.getByLabel('Contraseña').fill('Admin123!');
await page.getByRole('button', { name: /ingresar/i }).click();
await page.waitForURL(/tablero/, { timeout: 20_000 });

// 02 · Tablero
await page.getByRole('heading', { name: /tablero del negocio/i }).waitFor();
await pausa(page, VIDEO ? PAUSA : 1600); // render de las graficas incluido
await page.screenshot({ path: join(SALIDA, '02-tablero.png') });
marcar('Tablero: indicadores construidos desde los eventos de venta');

// 03 · Clientes (enmascarados)
await page.goto(`${BASE}/clientes`);
await page.getByRole('heading', { name: /^clientes/i }).waitFor();
await page.getByRole('table').waitFor();
await pausa(page);
await page.screenshot({ path: join(SALIDA, '03-clientes.png') });
marcar('Clientes: documento y telefono enmascarados');

// 04 · Detalle del cliente (datos completos; cifrados en la base)
await page.getByRole('button', { name: /^Editar / }).first().click();
await page.getByRole('dialog').waitFor();
await pausa(page, VIDEO ? PAUSA : 1500); // el detalle se pide al API (descifrado)
await page.screenshot({ path: join(SALIDA, '04-detalle-cliente.png') });
marcar('Detalle: documento y telefono completos (en la base van cifrados)');
await page.keyboard.press('Escape');

// 06 · Catalogo
await page.goto(`${BASE}/productos`);
await page.getByRole('heading', { name: /productos e inventario/i }).waitFor();
await page.getByRole('table').waitFor();
await pausa(page);
await page.screenshot({ path: join(SALIDA, '06-productos.png') });
marcar('Catalogo: precio, IVA, stock y alerta de stock bajo');

// Compras · Caja · Bodegas (recorrido del video)
await page.goto(`${BASE}/compras`);
await page.getByRole('heading', { name: /compras y proveedores/i }).waitFor();
await pausa(page);
marcar('Compras: entradas que suman inventario y actualizan costo');

await page.goto(`${BASE}/caja`);
await page.getByRole('heading', { name: /^caja$/i }).waitFor();
await pausa(page);
marcar('Caja: apertura, venta en efectivo, cierre y arqueo');

await page.goto(`${BASE}/bodegas`);
await page.getByRole('heading', { name: /bodegas y transferencias/i }).waitFor();
await pausa(page);
marcar('Bodegas: stock por bodega y transferencias');

// 07 · POS con carrito
await page.goto(`${BASE}/pos`);
await page.getByRole('heading', { name: /punto de venta/i }).waitFor();
await page.getByRole('button', { name: /Arroz 500 g/ }).click();
await page.getByRole('button', { name: /Cobrar \$\s*[1-9]/ }).waitFor();
await pausa(page);
await page.screenshot({ path: join(SALIDA, '07-pos.png') });
marcar('POS: carrito con IVA desagregado y total a cobrar');

// 08 · Venta sin conexion (queda en la cola local)
await context.setOffline(true);
await page.getByText('Sin internet').waitFor();
await page.getByRole('button', { name: /Cafe molido 250 g/ }).click();
await page.getByRole('button', { name: /Cobrar \$\s*[1-9]/ }).click();
await page.getByText(/quedó en cola/).waitFor({ timeout: 30_000 });
await page.getByText(/esperando sincronización/).waitFor({ timeout: 30_000 });
await pausa(page);
await page.screenshot({ path: join(SALIDA, '08-pos-offline.png') });
marcar('Sin conexion: la venta no se pierde, queda en la cola local');

// 09 · Sincronizacion al reconectar
await context.setOffline(false);
await page.getByText(/esperando sincronización/).waitFor({ state: 'hidden', timeout: 60_000 });
await page.getByText('En línea').waitFor();
await pausa(page);
await page.screenshot({ path: join(SALIDA, '09-sincronizacion.png') });
marcar('Al reconectar, la cola se vacia sola y el tablero se actualiza');

// 11 · Documentos
await page.goto(`${BASE}/documentos`);
await page.getByRole('heading', { name: /^documentos$/i }).waitFor();
await pausa(page, VIDEO ? PAUSA : 1500);
await page.screenshot({ path: join(SALIDA, '11-documentos.png') });
marcar('Documentos: facturas XML, nota credito, comprobantes PDF y soportes');

// Notificaciones · Usuarios · Configuracion (recorrido del video)
await page.goto(`${BASE}/notificaciones`);
await page.getByRole('heading', { name: /notificaciones/i }).waitFor();
await pausa(page);
marcar('Notificaciones: stock bajo, compras y resumen del dia');

await page.goto(`${BASE}/usuarios`);
await page.getByRole('heading', { name: /usuarios y roles/i }).waitFor();
await pausa(page);
marcar('Usuarios y roles del negocio');

await page.goto(`${BASE}/configuracion`);
await page.getByRole('heading', { name: /configuración del negocio/i }).waitFor();
await pausa(page);
marcar('Configuracion: vertical, zona horaria, datos fiscales y plan');

// ---------------------------------------------------------------------------
// Cierre: video + comprobaciones de texto
// ---------------------------------------------------------------------------
capturando = false;
await new Promise((r) => setTimeout(r, 400)); // deja cerrar el bucle de captura
await context.close();
await browser.close();

if (VIDEO) {
  // Lista de concatenacion con la duracion real de cada cuadro.
  const lista = join(TMP_CUADROS, 'lista.txt');
  const lineas = [];
  cuadros.forEach((cuadro, i) => {
    const fin = cuadros[i + 1]?.t ?? cuadro.t + 2;
    lineas.push(`file '${cuadro.ruta}'`, `duration ${Math.max(0.04, fin - cuadro.t).toFixed(3)}`);
  });
  lineas.push(`file '${cuadros[cuadros.length - 1].ruta}'`);
  writeFileSync(lista, lineas.join('\n') + '\n');

  const srtPath = join(TMP_CUADROS, 'subtitulos.srt');
  writeFileSync(srtPath, srt());
  const destino = join(SALIDA, 'demo-kubo.webm');
  execSync(
    `ffmpeg -y -loglevel error -f concat -safe 0 -i "${lista}" ` +
      `-vf "fps=25,subtitles=${srtPath}:force_style='FontName=DejaVu Sans,FontSize=17,PrimaryColour=&H00FFFFFF,BorderStyle=3,OutlineColour=&HCC000000,BackColour=&HCC000000,MarginV=26,Alignment=2'" ` +
      `-fps_mode cfr -c:v libvpx -b:v 1M -crf 22 -an "${destino}"`,
    { stdio: 'inherit' }
  );
  console.log(`✓ demo-kubo.webm regenerado (${(statSync(destino).size / 1e6).toFixed(1)} MB)`);
}

// 05 · El cifrado en la base (consulta real)
const psql =
  'docker exec kubo-postgres psql -U kubo_root -d kubo_crm -c "select name, ' +
  'left(document_number_encrypted, 28) as documento_cifrado, ' +
  'left(phone_encrypted, 20) as telefono_cifrado from customers limit 4"';
const salidaPsql = execSync(psql, { encoding: 'utf8' });
writeFileSync(join(SALIDA, '05-cifrado-en-base.txt'), `$ ${psql}\n\n${salidaPsql}`);

// 10 · Los repositorios del workspace
const salidaLs = execSync('ls -d kubo-*/', { cwd: WORKSPACE, encoding: 'utf8' });
writeFileSync(join(SALIDA, '10-repositorios.txt'), `$ ls -d kubo-*/\n\n${salidaLs}`);

console.log(`✓ evidencia regenerada en ${basename(SALIDA)}/ (capturas + txt${VIDEO ? ' + webm' : ''})`);
