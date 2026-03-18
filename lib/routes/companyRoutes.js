const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

// Public: list all companies
router.get('/', companyController.getAllCompanies);

// Public: create a company (used during registration)
router.post('/', companyController.createCompany);

module.exports = router;
