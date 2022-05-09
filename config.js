//const dotenv = require('dotenv').config({path: './.env'});

const config = {
    db: {
      /* don't expose password or any sensitive info, done only for demo */
      /*
      connectionLimit : 10,
      host: "localhost",
      user: "root",
      password: "secret",
      database: "obmennik"
      connectionLimit : 10,
      host: "162.241.123.51",
      user: "dollaymv_kassir",
      password: "!Aaf141183",
      database: "dollaymv_obmennik"

      connectionLimit : 10,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
      */
      connectionLimit : 10,
      host: "162.241.123.51",
      user: "dollaymv_kassir",
      password: "!Aaf141183",
      database: "dollaymv_obmennik"
    },
    listPerPage: 15,
    adsLimit: 4
  };
  /*
      db: {
      host: dotenv.parsed.DB_HOST,
      user: dotenv.parsed.DB_USER,
      password: dotenv.parsed.DB_PASS,
      database: dotenv.parsed.DB_NAME
    },
    listPerPage: 100,
  };
  */
  module.exports = config;