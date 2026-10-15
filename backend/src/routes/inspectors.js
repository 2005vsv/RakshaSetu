const express = require('express');
const router = express.Router();
const controller = require('../controllers/inspectorController');
const auth = require('../middleware/auth');

router.get('/', require('../middleware/auth'), (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Administrator access required' }), controller.listAvailable);

module.exports = router;


