import { Hono } from "hono";
import type { AuthType } from "./lib/auth"
import auth from "./routes/auth";

const app = new Hono<{ Variables: AuthType }>({
    strict: false,
}).basePath('/api');

app.get('/', (c) => {
    return c.text('Hello World!');
});

const routes = [auth] as const;

routes.forEach((route) => {
    app.route("/", route);
});

export default app;
