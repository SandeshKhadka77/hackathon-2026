const express = require('express');
const { login, register, registerOrganization, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/register-organization', registerOrganization);
router.post('/login', login);
router.get('/me', requireAuth, me);

module.exports = router;
