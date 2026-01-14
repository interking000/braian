import { Render } from '../../../config/render-config';
import Authentication from '../../../middlewares/authentication';
import { lock } from '../../../middlewares/lock';
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify';

export default {
  url: '/categories',
  method: 'GET',
  onRequest: [Authentication.user, lock],
  handler: (req: FastifyRequest, reply: FastifyReply) => {
    Render.page(req, reply, '/categories/index.html', {
      user: req.user,
      active: 'categories',
      csrfToken: req.csrfProtection.generateCsrf(),
    });
  },
} as RouteOptions;

