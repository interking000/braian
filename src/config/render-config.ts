import path from 'path';
import fs from 'fs';
import { eta } from '../http';
import AESCrypt from '../utils/crypto';
import { FastifyRequest, FastifyReply } from 'fastify';

const pages = path.resolve(__dirname, '../../frontend/pages');

const PASSWORD = '7223fd56-e21d-4191-8867-f3c67601122a';

export class Render {
  static async page(
    req: FastifyRequest,
    reply: FastifyReply,
    filename: string,
    options?: object
  ) {
    // ✅ normalizar: si viene "/login/index.html" lo convertimos a "login/index.html"
    const clean = filename.startsWith('/') ? filename.slice(1) : filename;
    const file = path.join(pages, clean);

    let content = '';
    try {
      // ✅ leer archivo real (no resolver "template")
      content = fs.readFileSync(file, 'utf8');
    } catch (err) {
      reply.status(500).send({
        ok: false,
        error: 'TEMPLATE_NOT_FOUND',
        file,
      });
      return;
    }

    // ✅ si algún día reactivás encriptación, dejé esto listo
    // if (process.env.ENCRYPT_FILES !== PASSWORD) {
    //   const decrypted = AESCrypt.decrypt(PASSWORD, content);
    //   if (!decrypted) {
    //     reply.status(500).send({ ok: false, error: 'Could not decrypt file' });
    //     return;
    //   }
    //   content = decrypted;
    // }

    const res = eta.renderString(content, { ...options });
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.send(res);
  }
}
