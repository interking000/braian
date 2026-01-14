import { Render } from '../../../config/render-config';
import formatDate from '../../../utils/format-date';
import Authentication from '../../../middlewares/authentication';
import { lock } from '../../../middlewares/lock';
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify';

export default {
  url: '/configs',
  method: 'GET',
  onRequest: [Authentication.user, lock],
  handler: (req: FastifyRequest, reply: FastifyReply) => {
    Render.page(req, reply, '/configs/index.html', {
      user: req.user,
      formatDate,
      active: 'configs',
      csrfToken: req.csrfProtection.generateCsrf(),
    });
  },
} as RouteOptions;

