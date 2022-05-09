const Joi = require('joi');

const userSchema = Joi.object({//Параметры пользователя
    email: Joi.string()
        .trim()
        .email({ minDomainSegments: 2 }),
    username: Joi.string()
        .trim()
        .alphanum()
        .min(3)
        .max(30)
        .required(),
    pass: Joi.string()
        .trim()
        .pattern(new RegExp('^.{6,30}$')),
    mainContactVal: Joi.string()
        .trim()
        .max(30)
        .required(),
    mainContactType: Joi.number().max(9).required(),
    reserveContactVal: Joi.string()
        .trim()
        .min(3)
        .max(30).allow(null, ''),
    reserveContactType: Joi.number().max(9).allow(null, '')
});
const idSchema = Joi.object({//ID пользователя/объявления
    id: Joi.number()
});
const adSchema = Joi.object({//Параметры объявления
    currency: Joi.number(),
    amountMin: Joi.number(),
    amountMax: Joi.number(),
    exchangeRate: Joi.number(),
    location: Joi.string()
        .trim()
        .min(3)
        .max(30)
        .required(),
    id: Joi.number().allow(null, '')
});
const loginSchema = Joi.object({//Логин пользователя
    login: Joi.string()
    .trim()
    .alphanum()
    .min(3)
    .max(30)
    .required()
});
const emailSchema = Joi.object({//Электропочта
    email: Joi.string()
    .trim()
    .email({ minDomainSegments: 2 })
});
const searchParams = Joi.object({//Параметры поиска объявлений
    currency: Joi.string(),
    amount: Joi.number(),
    location: Joi.string()
        .trim()
        .min(3)
        .max(30)
        .lowercase()
        .allow(null, '')
});
const passSchema = Joi.object({//Пароль пользователя
    pass: Joi.string()
        .trim()
        .pattern(new RegExp('^.{6,30}$'))
});
const messangerSchema = Joi.object({//Мессенджер
    mainContactVal: Joi.string()
        .trim()
        .max(30)
        .required(),
    mainContactType: Joi.number().max(9).required()
});
function validateData(type, dataToValidate){//Валидатор данных, в зависимости от параметров
    let schema;
    switch(type){
        case 'user': schema = userSchema; break;
        case 'id': schema = idSchema; break;
        case 'ad': schema = adSchema; break;
        case 'login': schema = loginSchema; break;
        case 'email': schema = emailSchema; break;
        case 'searchParams': schema = searchParams; break;
        case 'pass': schema = passSchema; break;
        case 'messanger': schema = messangerSchema; break;
        default: schema = idSchema; break;
    };
    const result = schema.validate(dataToValidate);
    if (!result.error) return result.value;
    else return false;
}
function validateUserdata(userdata){
    const result = userSchema.validate({ email: userdata.email, username: userdata.username, pass: userdata.pass,
        mainContactVal: userdata.mainContactVal, mainContactType: userdata.mainContactType, reserveContactVal: userdata.reserveContactVal, 
        reserveContactType: userdata.reserveContactType
    });
    if (!result.error) return result.value;
    else return false;
}
function validateId(id){
    const result = idSchema.validate({id: id});
    if (!result.error) return result.value.id;
    else return false;
}

module.exports = {
    validateUserdata,
    validateId,
    validateData
}