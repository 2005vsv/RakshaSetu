// backend/src/routes/efir.js
const express = require('express');
const router = express.Router();
const efirController = require('../controllers/efirController');
const auth = require('../middleware/auth');
const admin = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Administrator access required' });

// Existing routes
router.get('/pending', auth, admin, efirController.listPending);
router.post('/verify/:id', auth, admin, efirController.verify);
router.post('/assign/:id', auth, admin, efirController.assign);
router.post('/send/:id', auth, admin, efirController.sendCopy);
router.delete('/:id', auth, admin, efirController.reject);

router.post('/', auth, efirController.createEfir);

router.get('/:id', auth, efirController.getEfirById);

module.exports = router;
