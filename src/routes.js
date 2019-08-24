import { Router } from 'express';

import UserController from './app/controllers/UserController';
import SessionController from './app/controllers/SessionController';
import authMiddleware from './app/middlewares/auth';

const routes = new Router();

routes.post('/users', UserController.store);
routes.post('/sessions', SessionController.store);

// o global middleare abaixo só vai valer para as rotas que estiverem depois dele
// o que estiver antes não vai ser aplicado
routes.use(authMiddleware);

routes.put('/users', UserController.update);

export default routes;
