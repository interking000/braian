import { Render } from '../../../config/render-config'
import Authentication from '../../../middlewares/authentication'
import { FastifyRequest, FastifyReply, RouteOptions } from 'fastify'

export default {
  url: '/cdn',
  method: 'GET',
  onRequest: [Authentication.user],
  handler: async (req: FastifyRequest, reply: FastifyReply) => {
    return Render.page(req, reply, '/cdn/index.html', {
      user: req.user,
      active: 'cdn',
      csrfToken: req.csrfProtection.generateCsrf(),
    })
  },
} as RouteOptions
