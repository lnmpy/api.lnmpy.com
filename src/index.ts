import { Hono } from "hono";
import { requestId } from "hono/request-id";

import clashConverter from "./clash_converter";
import googleBase64Favicon from "./google_base64_favicon";

const app = new Hono();

app.use("*", requestId());
app.route("/clash_converter", clashConverter);
app.route("/google_base64_favicon", googleBase64Favicon);
app.use("/", requestId());
app.notFound((c) => {
	return c.text("api not found", 404);
});
export default app;
