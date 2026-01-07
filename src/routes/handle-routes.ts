import csrf from '../utils/csrf-protection';
import { Render } from '../config/render-config';
import HandlerErrors from '../errors/handler-errors';
import { FastifyInstance, RouteOptions } from 'fastify';
import fs from 'fs';
import path from 'path';

function getAllRoutes(dir: string): string[] {
  let results: string[] = [];
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results = results.concat(getAllRoutes(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
      // Excluir handle-routes para evitar recursion infinita
      if (!fullPath.endsWith('handle-routes.ts') && !fullPath.endsWith('handle-routes.js')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

export default function handler(fastify: FastifyInstance, _: any, done: () => void) {
  const routes = getAllRoutes(__dirname);
  const registeredRoutes = new Set<string>();

  routes.forEach((file) => {
    try {
      const route: RouteOptions = require(file).default;
      if (route && route.url) {
        const key = `${route.method}-${route.url}`;
        if (!registeredRoutes.has(key)) {
          fastify.route(route);
          registeredRoutes.add(key);
        } else {
          console.log(`Ruta duplicada ignorada: ${key}`);
        }
      }
    } catch (err) {
      console.error('Error cargando ruta:', file, err);
    }
  });

  fastify.decorateRequest('csrfProtection', { getter: () => csrf });

  fastify.setNotFoundHandler((req, reply) => {
    reply.status(404);
    Render.page(req, reply, '/404/index.html');
  });

  fastify.setErrorHandler(HandlerErrors);

  done();
}