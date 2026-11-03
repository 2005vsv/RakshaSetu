const express = require('express');
const router = express.Router();
const controller = require('../controllers/inspectorController');
const auth = require('../middleware/auth');

router.get('/', auth, controller.listAvailable);

module.exports = router;
