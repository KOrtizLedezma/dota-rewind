import express from "express";
import cors from "cors";
import summaryAdvancedRoute from "./routes/summary-advanced";
import resolveRoute from "./routes/resolve";

const app = express();

app.use(cors({ origin: "http://localhost:3000" })); // adjust for prod
app.use(express.json());

// health check (helps debug 404s)
app.get("/", (_req, res) => res.json({ ok: true, service: "api" }));
app.get("/v1/health", (_req, res) => res.json({ ok: true }));

// MOUNT ROUTES
app.use("/v1/players", summaryAdvancedRoute);
app.use("/v1", resolveRoute);

// 404 catcher (optional, for clarity)
app.use((_req, res) =>
  res.status(404).json({ error: { status: 404, message: "Not Found" } })
);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on :${port}`));
