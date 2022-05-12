require('dotenv').config({path: './.env'});
const express = require("express");
const app = express();
const port = 4000;
//const port = process.env.PORT;
const exchangeRouter = require("./routes/exchange");
const authRouter = require("./routes/auth");
const citylistRouter = require("./routes/citylist");
const nodeMailer = require('nodemailer');
const cors = require('cors');


app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cors());
app.use(function (req, res, next) {

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', 'https://dollarhub.me/');

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});
app.get("/", (req, res) => {
  res.json({ message: "oki-doki, die!" });
});
app.use("/exchange", exchangeRouter);
app.use("/auth", authRouter);
app.use("/citylist", citylistRouter);
/* Обработчик ошибок middleware */
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(err.message, err.stack);
  res.status(statusCode).json({ message: err.message, toCap: 'Die mthfkr die!' });
  return;
});
app.post('/send-email', function (req, res) {
  let transporter = nodeMailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: {
          user: 'senorsacacorchos@yandex.ru',
          pass: 'Aaf141183'
      }
  });
  let mailOptions = {
      from: '"Krunal Lathiya" <xx@gmail.com>', // sender address
      to: 'litehost.manager@yandex.ru', // list of receivers
      subject: 'Confirm', // Subject line
      text: 'Confirm email', // plain text body
      html: '<b>NodeJS Email Tutorial</b>' // html body
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          return console.log(error);
      }
      console.log('Message %s sent: %s', info.messageId, info.response);
          res.render('index');
      });
});
/*
app.post('/send-email', function (req, res) {
  let transporter = nodeMailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: {
          user: 'senorsacacorchos@yandex.ru',
          pass: 'Aaf141183'
      }
  });
  let mailOptions = {
      from: '"Krunal Lathiya" <xx@gmail.com>', // sender address
      to: 'litehost.manager@yandex.ru', // list of receivers
      subject: 'Confirm', // Subject line
      text: 'Confirm email', // plain text body
      html: '<b>NodeJS Email Tutorial</b>' // html body
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          return console.log(error);
      }
      console.log('Message %s sent: %s', info.messageId, info.response);
          res.render('index');
      });
});
*/
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});