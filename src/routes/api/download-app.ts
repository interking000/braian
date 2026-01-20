import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';

const activeBuilds = new Map<
  string,
  { tempDir: string; finalApkPath?: string; procs: Set<ReturnType<typeof spawn>> }
>();

type Body = {
  user_id?: string;
  token?: string;

  appName?: string;
  packageName?: string;

  logo_url?: string;
  logo_base64?: string; // data:image/*;base64,...
  logo_filename?: string;
  logo_mime?: string;

  cancel?: boolean;
  build_id?: string;
};

function safeTrim(v?: string) {
  return (v ?? '').toString().trim();
}

function isValidPackageName(pkg: string) {
  return /^[a-zA-Z]+[a-zA-Z0-9_]*(\.[a-zA-Z]+[a-zA-Z0-9_]*)+$/.test(pkg);
}

function slugApkName(name: string) {
  const cleaned = (name ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return cleaned || 'App';
}

function uniqueApkName(publicDownloads: string, baseNameNoExt: string) {
  const tryName = (n?: number) => (n ? `${baseNameNoExt}-${n}.apk` : `${baseNameNoExt}.apk`);
  let candidate = tryName();
  let i = 2;

  while (fs.existsSync(path.join(publicDownloads, candidate))) {
    candidate = tryName(i);
    i++;
    if (i > 9999) throw new Error('No pude asignar un nombre único al APK');
  }

  return candidate;
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * ✅ runCmd con logs PRO:
 * - imprime comando
 * - imprime stdout y stderr en vivo con prefijo
 * - junta stderr final para error
 */
function runCmd(
  tag: string,
  cmd: string,
  args: string[],
  procs: Set<ReturnType<typeof spawn>>,
  opts?: { cwd?: string }
) {
  return new Promise<void>((resolve, reject) => {
    console.log(`[${tag}] $ ${cmd} ${args.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(' ')}`);

    const p = spawn(cmd, args, {
      cwd: opts?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    procs.add(p);

    let stderr = '';

    p.stdout.on('data', (d) => {
      const s = d.toString();
      s.split('\n').filter(Boolean).forEach((line) => console.log(`[${tag}] ${line}`));
    });

    p.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      s.split('\n').filter(Boolean).forEach((line) => console.log(`[${tag}][ERR] ${line}`));
    });

    p.on('error', (err) => {
      procs.delete(p);
      reject(err);
    });

    p.on('close', (code) => {
      procs.delete(p);
      if (code === 0) return resolve();
      reject(new Error(`[${tag}] exit=${code} ${stderr.slice(-4000)}`));
    });
  });
}

/** ✅ Descarga a Buffer (URL) */
async function downloadToBuffer(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar logo: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

/** ✅ DataURL: acepta cualquier image/* en base64 */
function bufferFromDataUrlAny(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (!m) throw new Error('logo_base64 inválido (debe ser data:image/*;base64,...)');
  return Buffer.from(m[2], 'base64');
}

/** ✅ Protege el server */
function assertImageSize(buf: Buffer, maxBytes = 10 * 1024 * 1024) {
  if (!buf || !buf.length) throw new Error('Logo vacío');
  if (buf.length > maxBytes) throw new Error(`Logo demasiado pesado (máx ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
}

/** ✅ Convierte cualquier imagen soportada a PNG real 512x512 */
async function toPng512(input: Buffer) {
  return await sharp(input)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function walkFiles(dir: string, exts: string[], out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, exts, out);
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

function replaceAllInFile(filePath: string, from: string, to: string) {
  const txt = fs.readFileSync(filePath, 'utf8');
  if (!txt.includes(from)) return false;
  fs.writeFileSync(filePath, txt.split(from).join(to));
  return true;
}

function getManifestPackage(manifestPath: string) {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const m = manifest.match(/<manifest[^>]*\spackage="([^"]+)"/);
  return m?.[1] || '';
}

function setApktoolYmlRenamePackage(decompiledDir: string, newPkg: string) {
  const ymlPath = path.join(decompiledDir, 'apktool.yml');
  if (!fs.existsSync(ymlPath)) return;

  let yml = fs.readFileSync(ymlPath, 'utf8');

  const setOrAdd = (key: string, value: string) => {
    const re = new RegExp(`^\\s*${key}:\\s*.*$`, 'm');
    if (re.test(yml)) yml = yml.replace(re, `${key}: ${value}`);
    else yml += `\n${key}: ${value}\n`;
  };

  setOrAdd('renameManifestPackage', newPkg);

  if (/^\s*renameInstrumentationTargetPackage:\s*.*$/m.test(yml)) {
    yml = yml.replace(
      /^\s*renameInstrumentationTargetPackage:\s*.*$/m,
      `renameInstrumentationTargetPackage: ${newPkg}`
    );
  }

  fs.writeFileSync(ymlPath, yml);
}

function applyPackageRename(decompiledDir: string, newPkg: string) {
  const manifestPath = path.join(decompiledDir, 'AndroidManifest.xml');
  const oldPkg = getManifestPackage(manifestPath);
  if (!oldPkg) throw new Error('No pude leer package original del AndroidManifest.xml');

  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/package="[^"]+"/, `package="${newPkg}"`);
  fs.writeFileSync(manifestPath, manifest);

  const resDir = path.join(decompiledDir, 'res');
  const resXml = walkFiles(resDir, ['.xml']);
  for (const f of resXml) replaceAllInFile(f, oldPkg, newPkg);

  const smaliDirs = fs
    .readdirSync(decompiledDir)
    .filter((n) => n.startsWith('smali'))
    .map((n) => path.join(decompiledDir, n))
    .filter((p) => fs.existsSync(p));

  const oldSlash = oldPkg.replace(/\./g, '/');
  const newSlash = newPkg.replace(/\./g, '/');

  for (const sd of smaliDirs) {
    const smaliFiles = walkFiles(sd, ['.smali']);
    for (const f of smaliFiles) {
      replaceAllInFile(f, `L${oldSlash}/`, `L${newSlash}/`);
      replaceAllInFile(f, oldPkg, newPkg);
    }

    const oldPath = path.join(sd, oldSlash);
    const newPath = path.join(sd, newSlash);
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      ensureDir(path.dirname(newPath));
      fs.renameSync(oldPath, newPath);
    }
  }
}

function setAppLabel(decompiledDir: string, appName: string) {
  const stringsPath = path.join(decompiledDir, 'res', 'values', 'strings.xml');
  const manifestPath = path.join(decompiledDir, 'AndroidManifest.xml');

  if (fs.existsSync(stringsPath)) {
    let xml = fs.readFileSync(stringsPath, 'utf8');
    const safeName = escapeXml(appName);

    if (xml.includes('name="app_name"')) {
      xml = xml.replace(
        /<string\s+name="app_name">[\s\S]*?<\/string>/,
        `<string name="app_name">${safeName}</string>`
      );
    } else {
      xml = xml.replace(/<\/resources>/, `  <string name="app_name">${safeName}</string>\n</resources>`);
    }
    fs.writeFileSync(stringsPath, xml);
  }

  if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, 'utf8');
    if (/android:label="/.test(manifest)) {
      manifest = manifest.replace(/android:label="[^"]*"/, `android:label="@string/app_name"`);
    } else {
      manifest = manifest.replace(/<application\b/, `<application android:label="@string/app_name"`);
    }
    fs.writeFileSync(manifestPath, manifest);
  }
}

function parseIconRef(ref?: string) {
  if (!ref) return null;
  const m = ref.match(/^@([a-zA-Z0-9_]+)\/([a-zA-Z0-9_\.]+)$/);
  if (!m) return null;
  return { type: m[1], name: m[2] };
}

function getAppIconRefsFromManifest(manifestPath: string) {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const iconMatch = manifest.match(/android:icon="([^"]+)"/);
  const roundMatch = manifest.match(/android:roundIcon="([^"]+)"/);
  return { icon: iconMatch?.[1] || '', roundIcon: roundMatch?.[1] || '' };
}

function replaceResourceFiles(decompiledDir: string, _type: string, name: string, png: Buffer) {
  const resDir = path.join(decompiledDir, 'res');
  if (!fs.existsSync(resDir)) return;

  const folders = fs.readdirSync(resDir).map((f) => path.join(resDir, f));
  for (const folder of folders) {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) continue;

    const base = path.join(folder, `${name}`);
    const candidates = [`${base}.png`, `${base}.webp`];
    for (const c of candidates) {
      if (fs.existsSync(c)) fs.writeFileSync(c, png);
    }
  }
}

function parseAdaptiveIconDependencies(xmlContent: string) {
  const refs = Array.from(xmlContent.matchAll(/@([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/g)).map((m) => ({
    type: m[1],
    name: m[2],
  }));

  const key = (r: any) => `${r.type}/${r.name}`;
  const seen = new Set<string>();
  return refs.filter((r) => (seen.has(key(r)) ? false : (seen.add(key(r)), true)));
}

function applyLauncherIconKeepResourceName(decompiledDir: string, png: Buffer) {
  const manifestPath = path.join(decompiledDir, 'AndroidManifest.xml');
  const { icon, roundIcon } = getAppIconRefsFromManifest(manifestPath);

  const iconRef = parseIconRef(icon) || { type: 'mipmap', name: 'ic_launcher' };
  const roundRef = parseIconRef(roundIcon);

  replaceResourceFiles(decompiledDir, iconRef.type, iconRef.name, png);
  if (roundRef) replaceResourceFiles(decompiledDir, roundRef.type, roundRef.name, png);

  const adaptiveXmlPath = path.join(decompiledDir, 'res', 'mipmap-anydpi-v26', `${iconRef.name}.xml`);
  if (fs.existsSync(adaptiveXmlPath)) {
    const xml = fs.readFileSync(adaptiveXmlPath, 'utf8');
    const deps = parseAdaptiveIconDependencies(xml);
    for (const d of deps) replaceResourceFiles(decompiledDir, d.type, d.name, png);
  }

  const adaptiveRoundXmlPath = roundRef
    ? path.join(decompiledDir, 'res', 'mipmap-anydpi-v26', `${roundRef.name}.xml`)
    : '';

  if (adaptiveRoundXmlPath && fs.existsSync(adaptiveRoundXmlPath)) {
    const xml = fs.readFileSync(adaptiveRoundXmlPath, 'utf8');
    const deps = parseAdaptiveIconDependencies(xml);
    for (const d of deps) replaceResourceFiles(decompiledDir, d.type, d.name, png);
  }
}

export default {
  url: '/download-app',
  method: 'POST',

  // ✅ IMPORTANTÍSIMO: permitir payload grande (logo_base64)
  // Si tu Fastify ya tiene global bodyLimit, esto igual ayuda a nivel ruta.
  // (En Fastify funciona cuando el plugin lo respeta; en la mayoría de setups sí.)
  // @ts-ignore
  bodyLimit: 20 * 1024 * 1024, // 20MB

  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body || {}) as Body;

    const build_id = safeTrim(body.build_id) || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    console.log(`[APK] build_id=${build_id}`);

    const timestamp = Date.now().toString();
    const tempDir = path.join(__dirname, `../../../app/tmp_apk_${timestamp}`);
    const decompiledDir = path.join(tempDir, 'apk_decompiled');

    const baseApkPath = path.join(__dirname, '../../../frontend/public/static/apk/base.apk');
    const publicDownloads = path.join(__dirname, '../../../frontend/public/downloads');
    if (!fs.existsSync(publicDownloads)) fs.mkdirSync(publicDownloads, { recursive: true });

    const appName = safeTrim(body.appName) || 'DTunnel';
    const safeAppName = slugApkName(appName);

    const finalApkName = uniqueApkName(publicDownloads, safeAppName);
    const finalApkPath = path.join(publicDownloads, finalApkName);

    const keystoreDir = path.join(__dirname, '../../../keystore');
    const keystorePath = path.join(keystoreDir, 'my-release-key.jks');
    const keystorePass = 'keystorepass';
    const keyAlias = 'mykey';

    const cleanTemp = () => {
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    };

    const cleanAll = () => {
      cleanTemp();
      try {
        if (fs.existsSync(finalApkPath)) fs.unlinkSync(finalApkPath);
      } catch {}
      activeBuilds.delete(build_id);
    };

    try {
      // Cancel build
      if (body.cancel && safeTrim(body.build_id) && activeBuilds.has(body.build_id!)) {
        const st = activeBuilds.get(body.build_id!)!;
        for (const p of st.procs) {
          try { p.kill('SIGKILL'); } catch {}
        }
        try {
          if (st.tempDir && fs.existsSync(st.tempDir)) fs.rmSync(st.tempDir, { recursive: true, force: true });
        } catch {}
        activeBuilds.delete(body.build_id!);
        reply.status(204).send();
        return;
      }

      const user_id = safeTrim(body.user_id);
      const token = safeTrim(body.token);

      if (!user_id || !token) {
        reply.status(400).send(`Credenciales faltantes (user_id/token) build_id=${build_id}`);
        return;
      }

      const packageName = safeTrim(body.packageName);
      if (packageName && !isValidPackageName(packageName)) {
        reply.status(400).send(`Nombre de paquete inválido build_id=${build_id}`);
        return;
      }

      const procs = new Set<ReturnType<typeof spawn>>();
      activeBuilds.set(build_id, { tempDir, finalApkPath, procs });

      if (!fs.existsSync(keystoreDir)) fs.mkdirSync(keystoreDir, { recursive: true });

      if (!fs.existsSync(keystorePath)) {
        console.log('[APK] Creando keystore...');
        await runCmd(
          'KEYTOOL',
          'keytool',
          [
            '-genkeypair',
            '-alias', keyAlias,
            '-keyalg', 'RSA',
            '-keysize', '2048',
            '-validity', '36500',
            '-keystore', keystorePath,
            '-storepass', keystorePass,
            '-dname', 'CN=DTunnel, OU=Dev, O=MyCompany, L=City, ST=State, C=AR',
          ],
          procs
        );
      }

      ensureDir(tempDir);

      if (!fs.existsSync(baseApkPath)) {
        reply.status(500).send(`No existe base.apk build_id=${build_id}`);
        cleanAll();
        return;
      }

      console.log('[APK] Descompilando...');
      await runCmd('APKTOOL-DECOMPILE', 'apktool', ['d', '-f', baseApkPath, '-o', decompiledDir], procs);

      const assetsDir = path.join(decompiledDir, 'assets');
      ensureDir(assetsDir);

      fs.writeFileSync(
        path.join(assetsDir, 'credentials.json'),
        JSON.stringify({ user_id, token }, null, 2)
      );

      console.log('[APK] Aplicando nombre visible...');
      setAppLabel(decompiledDir, appName);

      if (packageName) {
        console.log('[APK] Aplicando packageName REAL...');
        applyPackageRename(decompiledDir, packageName);
        setApktoolYmlRenamePackage(decompiledDir, packageName);
      }

      // ✅ LOGO: cualquier image/* -> PNG 512
      let logoPng: Buffer | null = null;

      if (safeTrim(body.logo_base64)) {
        console.log('[APK] Logo desde base64...');
        const raw = bufferFromDataUrlAny(body.logo_base64!);
        assertImageSize(raw);
        logoPng = await toPng512(raw);
      } else if (safeTrim(body.logo_url)) {
        console.log('[APK] Logo desde URL...');
        const raw = await downloadToBuffer(body.logo_url!);
        assertImageSize(raw);
        logoPng = await toPng512(raw);
      }

      if (logoPng) {
        console.log('[APK] Aplicando icono...');
        applyLauncherIconKeepResourceName(decompiledDir, logoPng);
      }

      console.log('[APK] Recompilando...');
      const unsignedApk = path.join(tempDir, 'unsigned.apk');
      await runCmd('APKTOOL-BUILD', 'apktool', ['b', decompiledDir, '-o', unsignedApk], procs);

      console.log('[APK] Firmando (V1+V2+V3)...');
      await runCmd(
        'APKSIGNER',
        'apksigner',
        [
          'sign',
          '--ks', keystorePath,
          '--ks-pass', `pass:${keystorePass}`,
          '--key-pass', `pass:${keystorePass}`,
          '--ks-key-alias', keyAlias,
          '--v1-signing-enabled', 'true',
          '--v2-signing-enabled', 'true',
          '--v3-signing-enabled', 'true',
          '--out', finalApkPath,
          unsignedApk,
        ],
        procs
      );

      reply.header('Content-Type', 'text/plain');
      reply.header('x-build-id', build_id);
      reply.send(`/downloads/${finalApkName}`);

      cleanTemp();

      // borrar APK a los 5 minutos
      setTimeout(() => {
        try { if (fs.existsSync(finalApkPath)) fs.unlinkSync(finalApkPath); } catch {}
        activeBuilds.delete(build_id);
      }, 5 * 60 * 1000);

    } catch (err: any) {
      console.error('[ERROR] /download-app:', err);
      const msg = String(err?.message || err || 'unknown');
      cleanAll();
      reply.status(500).send(`Error al generar APK (build_id=${build_id})\n${msg}`);
    }
  },
} as RouteOptions;
