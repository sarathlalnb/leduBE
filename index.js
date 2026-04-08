require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./routes");
require("./dbConfig");

const server = new express();

server.use(cors());

server.use(express.json());

server.use(router);

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => {
  console.log(`Server is Running in ${PORT}`);
});
