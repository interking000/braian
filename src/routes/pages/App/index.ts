import { Render } from '../../../config/render-config';
import formatDate from '../../../utils/format-date';
import Authentication from '../../../middlewares/authentication';
import { lock } from '../../../middlewares/lock';
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify';

export default {
  url: '/application',
  method: 'GET',
  onRequest: [Authentication.user, lock],
  handler: (req: FastifyRequest, reply: FastifyReply) => {
    Render.page(req, reply, '/application/index.html', {
      user: req.user,
      formatDate,
      active: 'application',
      csrfToken: req.csrfProtection.generateCsrf(),
    });
  },
} as RouteOptions;

