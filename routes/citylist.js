const express = require('express');
const router = express.Router();
const citylist = require('../services/citylist');
/* Маршруты для работы с городами */
/* Возвращает список основных городов */
router.get('/', async function(req, res, next) {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(await citylist.getList());
    } catch (err) {
      console.error(`Ошибка получения списка городов`, err.message);
      next(err);
    }
});

module.exports = router;