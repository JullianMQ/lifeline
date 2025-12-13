import { Hono } from 'hono'
import { AuthType } from './lib/auth'
import auth from './routes/auth'
import contacts from './routes/contacts'

const app = new Hono<{ Variables: AuthType }>({
    strict: false,
})

const routes = [auth, contacts] as const;

routes.forEach((route) => {
    app.basePath("/api").route("/", route);
});

export default app
