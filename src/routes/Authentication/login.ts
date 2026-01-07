import { z } from 'zod';
import BCrypt from '../../utils/bcrypt';
import prisma from '../../config/prisma-client';
import SafeCallback from '../../utils/safe-callback';
import CookieManager from '../../utils/cookie-manager';
import csrfProtection from '../../middlewares/csrf-protection';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

const loginSchema = z.object({
  username: z.string().min(6).max(20),
  password: z.string().min(6).max(20),
});

export default {
  url: '/login',
  method: 'POST',
  onRequest: [csrfProtection],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = loginSchema.parse(req.body);

    const user = await SafeCallback(() =>
      prisma.user.findFirst({
        where: { username },
      })
    );

    if (!user || !BCrypt.compare(password, user.password)) {
      reply.status(401);
      reply.header('csrf-token', req.csrfProtection.generateCsrf());
      throw new Error('Usuario o Contraseña invalidos❌');
    }

    CookieManager.setCookiesLoggedIn(reply, user.id);

    reply.send({ status: 200, message: 'Exito🥳, aguarde lo estamos redirecionando' });
  },
} as RouteOptions;
