/**
 * Colores de marca sugeridos a partir del logo (en el navegador, con canvas).
 * - Exige un logo con resolución y nitidez suficientes; si no, no sugiere nada (mejor ningún color que uno malo).
 * - Ignora fondo transparente o blanco y agrupa los tonos parecidos.
 * - Principal: el tono oscuro con más presencia (o el color más presente si no hay oscuros; prefiere color frente a negro o gris).
 *   Acento: el más saturado con un tono distinto al principal. Secundario: otro tono del logo o una variante del principal.
 * - Cada color se oscurece lo necesario para que el texto blanco de los botones se lea (mismo criterio que el backend).
 */

export type ColoresSugeridos = {
  colorPrincipal: string;
  colorSecundario: string;
  colorTerciario: string;
};

export type ResultadoColoresLogo =
  | { ok: true; colores: ColoresSugeridos; paleta: string[] }
  | { ok: false; motivo: string };

const LADO_MINIMO = 48;
const ANCHO_MINIMO = 160;
const LADO_MUESTRA = 240;
/** Varianza del laplaciano por debajo de la cual el logo se considera borroso. */
const NITIDEZ_MINIMA = 12;
const PRESENCIA_MINIMA = 0.02;
const CONTRASTE_BOTON = 4.5;
const CONTRASTE_MINIMO = 3;

type Rgb = { r: number; g: number; b: number };
type Grupo = Rgb & { n: number; h: number; s: number; l: number };

function hsl({ r, g, b }: Rgb) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

function aHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function luminancia({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrasteBlanco = (c: Rgb) => 1.05 / (luminancia(c) + 0.05);

/** Oscurece hasta que el texto blanco tenga el contraste pedido. */
function legible(c: Rgb, minimo: number): Rgb {
  let x = { ...c };
  for (let i = 0; i < 40 && contrasteBlanco(x) < minimo; i++) {
    x = { r: x.r * 0.94, g: x.g * 0.94, b: x.b * 0.94 };
  }
  return x;
}

function aclarar(c: Rgb, t: number): Rgb {
  return { r: c.r + (255 - c.r) * t, g: c.g + (255 - c.g) * t, b: c.b + (255 - c.b) * t };
}

const distanciaTono = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const conColor = (g: Grupo) => g.s >= 0.25 && g.l > 0.08 && g.l < 0.92;

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer el logo.'));
    img.src = src;
  });
}

/** Varianza del laplaciano en escala de grises, solo en píxeles visibles: mide cuán definidos son los bordes. */
function nitidez(datos: Uint8ClampedArray, w: number, h: number): number {
  const gris = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = datos[i * 4 + 3] / 255;
    // Lo transparente cuenta como blanco: el borde del logo contra el fondo también es nitidez.
    const v = 0.299 * datos[i * 4] + 0.587 * datos[i * 4 + 1] + 0.114 * datos[i * 4 + 2];
    gris[i] = v * a + 255 * (1 - a);
  }
  let suma = 0;
  let suma2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gris[i - w] + gris[i + w] + gris[i - 1] + gris[i + 1] - 4 * gris[i];
      suma += lap;
      suma2 += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const media = suma / n;
  return suma2 / n - media * media;
}

export async function coloresDeLogo(src: string): Promise<ResultadoColoresLogo> {
  let img: HTMLImageElement;
  try {
    img = await cargarImagen(src);
  } catch (err) {
    return { ok: false, motivo: (err as Error).message };
  }
  const { naturalWidth: W, naturalHeight: H } = img;
  if (Math.min(W, H) < LADO_MINIMO || Math.max(W, H) < ANCHO_MINIMO) {
    return {
      ok: false,
      motivo: `El logo es muy pequeño (${W}×${H} px) para tomar sus colores con precisión. Súbelo con al menos ${ANCHO_MINIMO} px de ancho.`,
    };
  }

  const escala = Math.min(1, LADO_MUESTRA / Math.max(W, H));
  const w = Math.max(1, Math.round(W * escala));
  const h = Math.max(1, Math.round(H * escala));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, motivo: 'El navegador no permite analizar la imagen.' };
  ctx.drawImage(img, 0, 0, w, h);
  let datos: Uint8ClampedArray;
  try {
    datos = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { ok: false, motivo: 'No se pudo analizar el logo.' };
  }

  if (nitidez(datos, w, h) < NITIDEZ_MINIMA) {
    return {
      ok: false,
      motivo: 'El logo se ve borroso: los colores saldrían imprecisos. Súbelo con mejor resolución (idealmente PNG con fondo transparente).',
    };
  }

  // Agrupa tonos parecidos (4 bits por canal), sin fondo transparente ni blanco.
  const cubos = new Map<number, { r: number; g: number; b: number; n: number }>();
  let visibles = 0;
  for (let i = 0; i < datos.length; i += 4) {
    if (datos[i + 3] < 160) continue;
    const r = datos[i];
    const g = datos[i + 1];
    const b = datos[i + 2];
    const { s, l } = hsl({ r, g, b });
    if (l > 0.93 || (s < 0.1 && l > 0.82)) continue;
    visibles++;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = cubos.get(k) || { r: 0, g: 0, b: 0, n: 0 };
    c.r += r;
    c.g += g;
    c.b += b;
    c.n++;
    cubos.set(k, c);
  }
  if (visibles < 50) {
    return { ok: false, motivo: 'No encontramos colores en el logo: parece blanco o casi transparente.' };
  }

  // Une cubos vecinos en grupos (de mayor a menor presencia).
  const grupos: Grupo[] = [];
  for (const c of [...cubos.values()].sort((a, b) => b.n - a.n)) {
    const rgb = { r: c.r / c.n, g: c.g / c.n, b: c.b / c.n };
    const cerca = grupos.find((g) => Math.hypot(g.r - rgb.r, g.g - rgb.g, g.b - rgb.b) < 48);
    if (cerca) {
      const n = cerca.n + c.n;
      cerca.r = (cerca.r * cerca.n + rgb.r * c.n) / n;
      cerca.g = (cerca.g * cerca.n + rgb.g * c.n) / n;
      cerca.b = (cerca.b * cerca.n + rgb.b * c.n) / n;
      cerca.n = n;
    } else {
      grupos.push({ ...rgb, n: c.n, h: 0, s: 0, l: 0 });
    }
  }
  const relevantes = grupos
    .filter((g) => g.n / visibles >= PRESENCIA_MINIMA)
    .map((g) => ({ ...g, ...hsl(g) }))
    .sort((a, b) => b.n - a.n);
  if (!relevantes.length) {
    return { ok: false, motivo: 'No encontramos un color dominante en el logo.' };
  }

  const cromaticos = relevantes.filter(conColor);
  // Principal: un tono oscuro con presencia real (cabecera y títulos lo llevan sobre blanco);
  // si el logo no tiene ninguno, el color con más presencia, oscurecido después.
  const oscuro = cromaticos.find((g) => contrasteBlanco(g) >= CONTRASTE_BOTON && g.n / visibles >= 0.05);
  const principal = oscuro ?? cromaticos[0] ?? relevantes[0];
  const resto = cromaticos.filter((g) => g !== principal);
  const acento = [...resto]
    .filter((g) => distanciaTono(g.h, principal.h) >= 30)
    .sort((a, b) => b.s * b.n - a.s * a.n)[0];
  const secundario = resto.find((g) => g !== acento && distanciaTono(g.h, principal.h) >= 15 && (!acento || distanciaTono(g.h, acento.h) >= 15));

  const variante = aclarar(principal, 0.3);
  const colores: ColoresSugeridos = {
    colorPrincipal: aHex(legible(principal, CONTRASTE_BOTON)),
    colorSecundario: aHex(legible(secundario ?? variante, CONTRASTE_MINIMO)),
    colorTerciario: aHex(legible(acento ?? secundario ?? variante, CONTRASTE_MINIMO)),
  };
  return { ok: true, colores, paleta: relevantes.slice(0, 6).map(aHex) };
}
