import type { APIRoute, GetStaticPaths } from 'astro';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import InitCanvasKit from 'canvaskit-wasm/full';
import { getPageMeta } from '../../config/seo';
import { apiService } from '../../api';

interface PageData {
  title: string;
}

const structure = await apiService.getStructure();
const pages: Record<string, PageData> = {};

const indexMeta = getPageMeta('fizica', 'teoretic');
pages['index'] = {
  title: indexMeta.title,
};

for (const [subject, pagesList] of Object.entries(structure)) {
  for (const page of pagesList) {
    if (subject === 'fizica' && page === 'teoretic') continue;
    const meta = getPageMeta(subject, page);
    pages[`${subject}/${page}`] = {
      title: meta.title,
    };
  }
}

pages['notite/info'] = {
  title: 'Notițe informatică liceu (C++, Algoritmi)',
};

pages['notite/romana'] = {
  title: 'Schițe și scheme vizuale pentru bac la română',
};

export const getStaticPaths: GetStaticPaths = async () => {
  return Object.keys(pages).map((key) => ({
    params: { route: `${key}.png` },
  }));
};

let canvasKitInstance: Awaited<ReturnType<typeof InitCanvasKit>> | null = null;

async function getCanvasKit() {
  if (!canvasKitInstance) {
    canvasKitInstance = await InitCanvasKit();
  }
  return canvasKitInstance;
}

function getLogoBuffer() {
  const pngPath = path.resolve('public/assets/img/logo/atom-w.png');
  const svgPath = path.resolve('public/assets/img/logo/atom-w.svg');

  if (fs.existsSync(pngPath)) {
    return fs.readFileSync(pngPath);
  }
  if (fs.existsSync(svgPath)) {
    try {
      execSync(`inkscape "${svgPath}" -w 512 -h 512 -o "${pngPath}"`);
      if (fs.existsSync(pngPath)) {
        return fs.readFileSync(pngPath);
      }
    } catch {
      try {
        execSync(`convert "${svgPath}" -resize 512x512 "${pngPath}"`);
        if (fs.existsSync(pngPath)) {
          return fs.readFileSync(pngPath);
        }
      } catch {}
    }
  }
  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const route = params.route;
  if (!route) {
    return new Response('Not Found', { status: 404 });
  }

  const key = route.replace(/\.png$/, '');
  const page = pages[key];
  if (!page) {
    return new Response('Not Found', { status: 404 });
  }

  const CK = await getCanvasKit();

  const fontPath = path.resolve('public/assets/fonts/inter-medium.woff2');
  const fontBuffer = fs.readFileSync(fontPath);
  const logoPngBuffer = getLogoBuffer();

  const fontMgr = CK.FontMgr.FromData(fontBuffer.buffer);
  if (!fontMgr) {
    return new Response('Failed to load font', { status: 500 });
  }
  const logoImg = logoPngBuffer ? CK.MakeImageFromEncoded(logoPngBuffer) : null;

  const width = 1200;
  const height = 630;
  const surface = CK.MakeSurface(width, height);
  if (!surface) {
    return new Response('Failed to create surface', { status: 500 });
  }

  const canvas = surface.getCanvas();
  const currentYear = new Date().getFullYear();

  // 1. Background Gradient (Navy blue to deep purple gradient matching reference)
  const bgPaint = new CK.Paint();
  bgPaint.setShader(
    CK.Shader.MakeLinearGradient(
      [0, 0],
      [width, height],
      [
        CK.Color(11, 17, 35, 1),
        CK.Color(18, 23, 53, 1),
        CK.Color(38, 16, 68, 1),
      ],
      [0, 0.5, 1],
      CK.TileMode.Clamp,
    ),
  );
  canvas.drawRect(CK.XYWHRect(0, 0, width, height), bgPaint);

  // 2. Top-Left White Atom Logo + Site Title
  if (logoImg) {
    const logoPaint = new CK.Paint();
    canvas.drawImageRect(
      logoImg,
      CK.XYWHRect(0, 0, logoImg.width(), logoImg.height()),
      CK.XYWHRect(60, 50, 48, 48),
      logoPaint,
    );
  }

  // Site Title: Cuza.pages.dev
  const siteTitleStyle = new CK.ParagraphStyle({
    textStyle: {
      color: CK.Color(255, 255, 255, 1),
      fontSize: 30,
      fontFamilies: ['Inter'],
      fontStyle: { weight: CK.FontWeight.Normal },
    },
  });
  const siteTitleBuilder = CK.ParagraphBuilder.Make(siteTitleStyle, fontMgr);
  siteTitleBuilder.addText('CuzaPages');
  const siteTitleP = siteTitleBuilder.build();
  siteTitleP.layout(width);
  canvas.drawParagraph(siteTitleP, 122, 60);

  // 3. Dynamic Title from page prop
  const startX = 60;
  const maxTitleWidth = 1080;
  const titleY = 200;

  let titleFontSize = 58;
  if (page.title.length > 50) {
    titleFontSize = 46;
  } else if (page.title.length > 35) {
    titleFontSize = 52;
  }

  const titleStyle = new CK.ParagraphStyle({
    textStyle: {
      color: CK.Color(255, 255, 255, 1),
      fontSize: titleFontSize,
      heightMultiplier: 1.18,
      fontFamilies: ['Inter'],
      fontStyle: { weight: CK.FontWeight.Normal },
    },
  });
  const titleBuilder = CK.ParagraphBuilder.Make(titleStyle, fontMgr);
  titleBuilder.addText(page.title);
  const titleP = titleBuilder.build();
  titleP.layout(maxTitleWidth);
  canvas.drawParagraph(titleP, startX, titleY);

  const titleHeight = titleP.getHeight();

  // 4. Description: '${currentYear} și anii anteriori'
  const descY = titleY + titleHeight + 20;
  const descText = `${currentYear} și anii anteriori`;

  const descStyle = new CK.ParagraphStyle({
    textStyle: {
      color: CK.Color(203, 213, 225, 0.92),
      fontSize: 38,
      fontFamilies: ['Inter'],
      fontStyle: { weight: CK.FontWeight.Normal },
    },
  });
  const descBuilder = CK.ParagraphBuilder.Make(descStyle, fontMgr);
  descBuilder.addText(descText);
  const descP = descBuilder.build();
  descP.layout(maxTitleWidth);
  canvas.drawParagraph(descP, startX, descY);

  // 5. Bottom Right Pill Button: 'BAC ${currentYear}'
  const btnText = `BAC ${currentYear}`;
  const btnStyle = new CK.ParagraphStyle({
    textStyle: {
      color: CK.Color(15, 23, 42, 1),
      fontSize: 26,
      fontFamilies: ['Inter'],
      fontStyle: { weight: CK.FontWeight.Bold },
    },
  });
  const btnBuilder = CK.ParagraphBuilder.Make(btnStyle, fontMgr);
  btnBuilder.addText(btnText);
  const btnP = btnBuilder.build();
  btnP.layout(width);

  const textWidth = Math.ceil(btnP.getMaxIntrinsicWidth());
  const pillW = textWidth + 40;
  const pillH = 56;
  const pillX = width - 60 - pillW;
  const pillY = height - 60 - pillH;

  const pillRRect = CK.RRectXY(CK.XYWHRect(pillX, pillY, pillW, pillH), 16, 16);
  const pillFill = new CK.Paint();
  pillFill.setColor(CK.Color(255, 255, 255, 1));
  canvas.drawRRect(pillRRect, pillFill);

  canvas.drawParagraph(btnP, pillX + 20, pillY + 15);

  // 6. Output PNG Buffer
  const image = surface.makeImageSnapshot();
  const pngBytes = image.encodeToBytes(CK.ImageFormat.PNG, 95);
  surface.dispose();

  if (!pngBytes) {
    return new Response('Failed to encode PNG', { status: 500 });
  }

  return new Response(Buffer.from(pngBytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Robots-Tag': 'noindex',
    },
  });
};
