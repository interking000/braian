// /download-app route (Fastify) — APK builder PRO
// - Logs claros (captura stdout/stderr con tail)
// - Zipalign BEFORE sign
// - Apksigner verify AFTER sign (con print-certs)
// - Errores devueltos con motivo real
// - Cancel build (mata procesos)
// - Limpieza segura
//
// Requisitos en el servidor (PATH):
//   - apktool
//   - zipalign (Android SDK build-tools)
//   - apksigner (Android SDK build-tools)
//   - keytool (Java JDK)
//   - node >= 18 (para fetch)
//
// NOTA: Si el usuario ya tiene instalada una app con MISMO packageName pero OTRA firma,
// Android mostrará "App no instalada". En ese caso: desinstalar la anterior o cambiar packageName.

import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';

type Body = {
  user_id?: string;
  token?: string;

  appName?: string;
  packageName?: string;

  logo_url?: string;
  logo_base64?: string; // data:image/*;base64,...
  logo_filename?: string;

  cancel?: boolean;
  build_id?: string;
};

const activeBuilds = new Map<
  string,
  { tempDir: string; finalApkPath?: string; procs: Set<ReturnType<typeof spawn>> }
>();

function safeTrim(v?: string) {
  return (v ?? '').toString().trim();
}

function isValidPackageName(pkg: string) {
  // com.company.app_name
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

function tailLines(s: string, maxLines = 60) {
  const lines = s.split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
}

async function runCmd(
  cmd: string,
  args: string[],
  procs: Set<ReturnType<typeof spawn>>,
  opts?: { cwd?: string; label?: string; timeoutMs?: number }
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd: opts?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    procs.add(p);

    let stdout = '';
    let stderr = '';

    p.stdout.on('data', (d) => (stdout += d.toString()));
    p.stderr.on('data', (d) => (stderr += d.toString()));

    const label = opts?.label ?? cmd;

    const t = opts?.timeoutMs
      ? setTimeout(() => {
          try {
            p.kill('SIGKILL');
          } catch {}
        }, opts.timeoutMs)
      : null;

    p.on('error', (err) => {
      if (t) clearTimeout(t);
      procs.delete(p);
      reject(new Error(`[${label}] spawn error: ${err.message}`));
    });

    p.on('close', (code) => {
      if (t) clearTimeout(t);
      procs.delete(p);

      if (code === 0) return resolve({ code: 0, stdout, stderr });

      const outT = tailLines(stdout, 60);
      const errT = tailLines(stderr, 60);

      reject(
        new Error(
          `[${label}] exit=${code}\n` +
            `CMD: ${cmd} ${args.join(' ')}\n` +
            (errT ? `--- STDERR (tail) ---\n${errT}\n` : '') +
            (outT ? `--- STDOUT (tail) ---\n${outT}\n` : '')
        )
      );
    });
  });
}

/** ✅ Descarga logo a Buffer */
async function downloadToBufferWithMime(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar logo: ${res.status}`);
  const mime = (res.headers.get('content-type') || '').toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  return { mime, buf };
}

/** ✅ DataURL: acepta cualquier image/* en base64 */
function bufferFromDataUrlAny(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
  if (!m) throw new Error('logo_base64 inválido (debe ser data:image/*;base64,...)');
  return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') };
}

/** ✅ Protege el server */
function assertImageSize(buf: Buffer, maxBytes = 6 * 1024 * 1024) {
  if (!buf || !buf.length) throw new Error('Logo vacío');
  if (buf.length > maxBytes) throw new Error('Logo demasiado pesado (máx 6MB)');
}

/** ✅ Convierte cualquier imagen soportada a PNG real 512x512 */
async function toPngBuffer(input: Buffer) {
  return await sharp(input).resize(512, 512, { fit: 'cover' }).png({ compressionLevel: 9 }).toBuffer();
}

/** ====== Package rename helpers ====== */

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

  // 1) Manifest package
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  manifest = manifest.replace(/package="[^"]+"/, `package="${newPkg}"`);
  fs.writeFileSync(manifestPath, manifest);

  // 2) res XML refs
  const resDir = path.join(decompiledDir, 'res');
  for (const f of walkFiles(resDir, ['.xml'])) replaceAllInFile(f, oldPkg, newPkg);

  // 3) smali refs + paths
  const smaliDirs = fs
    .readdirSync(decompiledDir)
    .filter((n) => n.startsWith('smali'))
    .map((n) => path.join(decompiledDir, n))
    .filter((p) => fs.existsSync(p));

  const oldSlash = oldPkg.replace(/\./g, '/');
  const newSlash = newPkg.replace(/\./g, '/');

  for (const sd of smaliDirs) {
    for (const f of walkFiles(sd, ['.smali'])) {
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

/** ====== App label ====== */

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
      xml = xml.replace(
        /<\/resources>/,
        `  <string name="app_name">${safeName}</string>\n</resources>`
      );
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

/** ====== Icon replace (keep resource name) ====== */

function parseIconRef(ref?: string) {
  if (!ref) return null;
  const m = ref.match(/^@([a-zA-Z0-9_]+)\/([a-zA-Z0-9_.]+)$/);
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

  const key = (r: { type: string; name: string }) => `${r.type}/${r.name}`;
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

  const adaptiveXmlPath = path.join(
    decompiledDir,
    'res',
    'mipmap-anydpi-v26',
    `${iconRef.name}.xml`
  );

  if (fs.existsSync(adaptiveXmlPath)) {
    const xml = fs.readFileSync(adaptiveXmlPath, 'utf8');
    for (const d of parseAdaptiveIconDependencies(xml)) replaceResourceFiles(decompiledDir, d.type, d.name, png);
  }

  const adaptiveRoundXmlPath = roundRef
    ? path.join(decompiledDir, 'res', 'mipmap-anydpi-v26', `${roundRef.name}.xml`)
    : '';

  if (adaptiveRoundXmlPath && fs.existsSync(adaptiveRoundXmlPath)) {
    const xml = fs.readFileSync(adaptiveRoundXmlPath, 'utf8');
    for (const d of parseAdaptiveIconDependencies(xml)) replaceResourceFiles(decompiledDir, d.type, d.name, png);
  }
}

function safeUnlink(p: string) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function safeRmDir(p: string) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  } catch {}
}

export default {
  url: '/download-app',
  method: 'POST',
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body || {}) as Body;

    const build_id = safeTrim(body.build_id) || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const timestamp = Date.now().toString();

    const tempDir = path.join(__dirname, `../../../app/tmp_apk_${timestamp}`);
    const decompiledDir = path.join(tempDir, 'apk_decompiled');

    const baseApkPath = path.join(__dirname, '../../../frontend/public/static/apk/base.apk');
    const publicDownloads = path.join(__dirname, '../../../frontend/public/downloads');
    ensureDir(publicDownloads);

    const appName = safeTrim(body.appName) || 'DTunnel';
    const safeAppName = slugApkName(appName);

    const finalApkName = uniqueApkName(publicDownloads, safeAppName);
    const finalApkPath = path.join(publicDownloads, finalApkName);

    // ⚠️ Ideal: keystore fuera del deploy y persistente (NO regenerar nunca si querés updates)
    const keystoreDir = path.join(__dirname, '../../../keystore');
    const keystorePath = path.join(keystoreDir, 'my-release-key.jks');
    const keystorePass = process.env.APK_KEYSTORE_PASS || 'keystorepass';
    const keyAlias = process.env.APK_KEY_ALIAS || 'mykey';
    const keyPass = process.env.APK_KEY_PASS || keystorePass;

    const cleanTemp = () => safeRmDir(tempDir);

    const cleanAll = () => {
      cleanTemp();
      safeUnlink(finalApkPath);
      activeBuilds.delete(build_id);
    };

    try {
      // Cancel build (kill)
      if (body.cancel && safeTrim(body.build_id) && activeBuilds.has(body.build_id!)) {
        const st = activeBuilds.get(body.build_id!)!;
        for (const p of st.procs) {
          try {
            p.kill('SIGKILL');
          } catch {}
        }
        safeRmDir(st.tempDir);
        activeBuilds.delete(body.build_id!);
        reply.status(204).send();
        return;
      }

      const user_id = safeTrim(body.user_id);
      const token = safeTrim(body.token);

      if (!user_id || !token) {
        reply.status(400).send('Credenciales faltantes');
        return;
      }

      const packageName = safeTrim(body.packageName);
      if (packageName && !isValidPackageName(packageName)) {
        reply.status(400).send('Nombre de paquete inválido');
        return;
      }

      const procs = new Set<ReturnType<typeof spawn>>();
      activeBuilds.set(build_id, { tempDir, finalApkPath, procs });

      ensureDir(keystoreDir);

      // Create keystore if missing (solo para DEV).
      // En PROD: pre-creala y montala permanente, nunca regenerar, o rompés updates.
      if (!fs.existsSync(keystorePath)) {
        await runCmd(
          'keytool',
          [
            '-genkeypair',
            '-alias',
            keyAlias,
            '-keyalg',
            'RSA',
            '-keysize',
            '2048',
            '-validity',
            '36500',
            '-keystore',
            keystorePath,
            '-storepass',
            keystorePass,
            '-keypass',
            keyPass,
            '-dname',
            'CN=DTunnel, OU=Dev, O=MyCompany, L=City, ST=State, C=AR',
          ],
          procs,
          { label: 'keytool genkeypair', timeoutMs: 120_000 }
        );
      }

      ensureDir(tempDir);

      if (!fs.existsSync(baseApkPath)) {
        reply.status(500).send('No existe base.apk');
        cleanAll();
        return;
      }

      // 1) Decompile
      await runCmd('apktool', ['d', '-f', baseApkPath, '-o', decompiledDir], procs, {
        label: 'apktool decompile',
        timeoutMs: 300_000,
      });

      // 2) Write assets/credentials.json
      const assetsDir = path.join(decompiledDir, 'assets');
      ensureDir(assetsDir);
      fs.writeFileSync(path.join(assetsDir, 'credentials.json'), JSON.stringify({ user_id, token }, null, 2));

      // 3) App label
      setAppLabel(decompiledDir, appName);

      // 4) Package rename (optional)
      if (packageName) {
        applyPackageRename(decompiledDir, packageName);
        setApktoolYmlRenamePackage(decompiledDir, packageName);
      }

      // 5) Logo -> PNG -> apply
      let logoPng: Buffer | null = null;

      if (safeTrim(body.logo_base64)) {
        const parsed = bufferFromDataUrlAny(body.logo_base64!);
        assertImageSize(parsed.buf);
        logoPng = await toPngBuffer(parsed.buf);
      } else if (safeTrim(body.logo_url)) {
        const dl = await downloadToBufferWithMime(body.logo_url!);
        assertImageSize(dl.buf);
        logoPng = await toPngBuffer(dl.buf);
      }

      if (logoPng) {
        applyLauncherIconKeepResourceName(decompiledDir, logoPng);
      }

      // 6) Build
      const unsignedApk = path.join(tempDir, 'unsigned.apk');
      await runCmd('apktool', ['b', decompiledDir, '-o', unsignedApk], procs, {
        label: 'apktool build',
        timeoutMs: 600_000,
      });

      // 7) Zipalign (BEFORE sign)
      const alignedApk = path.join(tempDir, 'aligned.apk');
      await runCmd('zipalign', ['-f', '4', unsignedApk, alignedApk], procs, {
        label: 'zipalign',
        timeoutMs: 60_000,
      });

      // 8) Sign
      await runCmd(
        'apksigner',
        [
          'sign',
          '--ks',
          keystorePath,
          '--ks-pass',
          `pass:${keystorePass}`,
          '--key-pass',
          `pass:${keyPass}`,
          '--ks-key-alias',
          keyAlias,
          '--v1-signing-enabled',
          'true',
          '--v2-signing-enabled',
          'true',
          '--v3-signing-enabled',
          'true',
          '--out',
          finalApkPath,
          alignedApk,
        ],
        procs,
        { label: 'apksigner sign', timeoutMs: 120_000 }
      );

      // 9) Verify (AFTER sign)
      await runCmd('apksigner', ['verify', '--verbose', '--print-certs', finalApkPath], procs, {
        label: 'apksigner verify',
        timeoutMs: 60_000,
      });

      // Response
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      reply.header('x-build-id', build_id);
      reply.send(`/downloads/${finalApkName}`);

      // Clean temp decompile/build artifacts
      cleanTemp();

      // Delete final APK after 5 minutes
      setTimeout(() => {
        safeUnlink(finalApkPath);
        activeBuilds.delete(build_id);
      }, 5 * 60 * 1000);
    } catch (err: any) {
      console.error('[ERROR] /download-app:', err);

      const msg = String(err?.message || err || 'Error desconocido');
      const short = msg.length > 8000 ? msg.slice(0, 8000) + '\n...recortado' : msg;

      cleanAll();
      reply.status(500).send(short);
    }
  },
} as RouteOptions;

