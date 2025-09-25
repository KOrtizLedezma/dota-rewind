import express from "express";
import cors from "cors";
import advanced from "./routes/summary-advanced";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/v1", advanced);

// 404s as JSON
app.use((_req, res) =>
  res.status(404).json({ error: { status: 404, message: "Not found" } })
);

// ERROR HANDLER
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err?.response?.status || err?.status || 500;
  res.status(status).json({
    error: {
      status,
      message: err?.message || "Internal error",
      upstream: err?.response?.data ?? null,
    },
  });
});

app.listen(3001, () => console.log("API on :3001"));
