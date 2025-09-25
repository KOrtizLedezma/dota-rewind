import express from "express";
import cors from "cors";
import summaryRouter from "./routes/summary";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/v1", summaryRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API on :${PORT}`));
