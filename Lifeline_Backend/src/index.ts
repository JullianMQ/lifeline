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

app.get("/api/auth/google/callback/success", (c) => {
    return c.text("Success");
});

app.get("/api/auth/google/callback/error", (c) => {
    return c.text("Error, logging in please try again");
});

export default app
