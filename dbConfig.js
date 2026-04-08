const mongoose = require("mongoose");

mongoose
  .connect(process.env.connectionString)
  .then((res) => {
    console.log("SuccessFully Connected to mongoDB");
  })
  .catch((err) => console.log(err));
