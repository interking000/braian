import { Render } from '../../../config/render-config';
import Authentication from '../../../middlewares/authentication';
import { FastifyReply, FastifyRequest, RouteOptions } from 'fastify';

export default {
  url: '/acceso',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    return Render.page(req, reply, '/acceso/index.html', {
      user: req.user,
      active: 'acceso',
      csrfToken: req.csrfProtection.generateCsrf(),
    });
  },
} as RouteOptions;
