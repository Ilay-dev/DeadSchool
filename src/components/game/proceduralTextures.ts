import * as THREE from 'three';

function createCanvasTexture(
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  width = 256,
  height = 256,
  repeatX = 12,
  repeatY = 12
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

let cachedCobbleTex: THREE.CanvasTexture | null = null;
let cachedBrickTex: THREE.CanvasTexture | null = null;
let cachedHedgeTex: THREE.CanvasTexture | null = null;

export function getTerracottaCobbleTexture(baseHex = '#b8764f'): THREE.CanvasTexture {
  if (cachedCobbleTex) return cachedCobbleTex;
  cachedCobbleTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      // Grout lines & polygonal stone tiles like Screenshot 4
      ctx.strokeStyle = 'rgba(225, 198, 170, 0.55)';
      ctx.lineWidth = 3;

      const cell = 64;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          const shade = (Math.sin(x * 0.15 + y * 0.25) * 14) | 0;
          ctx.fillStyle = shade > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
          ctx.beginPath();
          ctx.moveTo(x + 4, y + 6);
          ctx.lineTo(x + cell - 6, y + 2);
          ctx.lineTo(x + cell - 2, y + cell - 8);
          ctx.lineTo(x + 8, y + cell - 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    },
    256,
    256,
    18,
    18
  );
  return cachedCobbleTex;
}

export function getWarmBrickWallTexture(baseHex = '#c59b6d'): THREE.CanvasTexture {
  if (cachedBrickTex) return cachedBrickTex;
  cachedBrickTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, w, h);

      const rows = 8;
      const cols = 4;
      const rowH = h / rows;
      const colW = w / cols;

      ctx.strokeStyle = 'rgba(72, 52, 34, 0.55)';
      ctx.lineWidth = 2.5;

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const y = r * rowH;
          ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
          ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);
          ctx.strokeRect(x, y, colW, rowH);
        }
      }
    },
    256,
    256,
    4,
    2
  );
  return cachedBrickTex;
}

export function getHedgeFoliageTexture(): THREE.CanvasTexture {
  if (cachedHedgeTex) return cachedHedgeTex;
  cachedHedgeTex = createCanvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#2d4c1e';
      ctx.fillRect(0, 0, w, h);

      const colors = ['#3a5f27', '#4e7735', '#233b17', '#658c42', '#325422'];
      for (let i = 0; i < 320; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
        const px = Math.abs(x) * w;
        const py = Math.abs(y) * h;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(px, py, 9, 5, (i % 6) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    256,
    256,
    3,
    2
  );
  return cachedHedgeTex;
}
