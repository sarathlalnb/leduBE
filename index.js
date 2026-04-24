require("dotenv").config();
const express = require("express");
const cors = require("cors");
const router = require("./routes");
require("./dbConfig");

const server = new express();

server.use(cors());

server.use(express.json());

server.use(router);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is Running in ${PORT}`);
});
