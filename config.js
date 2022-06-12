const config = {
    db: {
      connectionLimit : 10,
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    },
    listPerPage: 15,
    adsLimit: 4
  };
  module.exports = config;