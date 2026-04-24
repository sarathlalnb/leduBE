require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./routes");
require("./dbConfig");

const server = new express();

const corsOriginRaw = process.env.CORS_ORIGIN;
const corsOrigins = corsOriginRaw
  ? corsOriginRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : "*";

server.use(
  cors({
    origin: corsOrigins,
    credentials: String(process.env.CORS_CREDENTIALS).toLowerCase() === "true",
  })
);

server.use(express.json());

server.use(router);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is Running in ${PORT}`);
});
