const express = require('express');
const { uploadDocument, getDocuments, updateDocumentExpiry } = require('../controllers/documentController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/', requireAuth, getDocuments);
router.post('/upload', requireAuth, upload.single('file'), uploadDocument);
router.patch('/expiry', requireAuth, updateDocumentExpiry);

module.exports = router;
