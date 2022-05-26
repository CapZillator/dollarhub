require('dotenv').config({path: './.env'});
const express = require("express");
const app = express();
const port = 4000;
//const port = process.env.PORT;
const exchangeRouter = require("./routes/exchange");
const authRouter = require("./routes/auth");
const citylistRouter = require("./routes/citylist");
//const nodeMailer = require('nodemailer');
const cors = require('cors');

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cors());
app.get("/", (req, res) => {
  res.json({ message: "it's still working..." });
});
app.use("/exchange", exchangeRouter);
app.use("/auth", authRouter);
app.use("/citylist", citylistRouter);
/* Обработчик ошибок middleware */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(err.message, err.stack);
  res.status(statusCode).json({ message: err.message });
  return;
});
app.listen(port, () => {
  console.log(`Api listening at http://localhost:${port}`);
});