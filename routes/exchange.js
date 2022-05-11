const express = require('express');
const router = express.Router();
const exchange = require('../services/exchange');
/* Маршруты для работы с объявлениями */
/* Возвращает все объявления */
router.get('/', async function(req, res, next) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(await exchange.getMultiple(req.query.page, req.query.sortby));
  } catch (err) {
    console.error(`Ошибка получения списка предложений `, err.message);
    next(err);
  }
});
/* Возвращает объявление по ID */
router.post('/searchbyid', async function(req, res, next) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(await exchange.getByID(req.body));
  } catch (err) {
    console.error(`Ошибка получения объявления по ID `, err.message);
    next(err);
  }
});
/* Возвращает список предложений, удовлетворяющих критериям поиска пользователя  */
router.post('/searchbyparams', async function(req, res, next) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(await exchange.getByParams(req.body));
  } catch (err) {
    console.error(`Ошибка получения списка предложений по параметрам `, err.message);
    next(err);
  }
});
/* Возвращает все объявления автора */
router.post('/searchbyauthor', async function(req, res, next) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(await exchange.getMultipleByID(req.body));
  } catch (err) {
    console.error(`Ошибка получения списка объявлений автора`, err.message);
    next(err);
  }
});
/* Создает новое объявление */
router.post('/', async function(req, res, next) {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(await exchange.create(req.body));
    } catch (err) {
      console.error(`Ошибка создания объявления `, err.message);
      next(err);
    }
});
/* Редактирует существующее объявление */
router.put('/', async function(req, res, next) {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(await exchange.update(req.body));
    } catch (err) {
      console.error(`Ошибка редактирования объявления `, err.message);
      next(err);
    }
});
/* Удалить объявление по ID */
router.delete('/:id', async function(req, res, next) {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(await exchange.remove(req.params.id, req.body));
    } catch (err) {
      console.error(`Ошибка удаления объявления `, err.message);
      next(err);
    }
});

module.exports = router;