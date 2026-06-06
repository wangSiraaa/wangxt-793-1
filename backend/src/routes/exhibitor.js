const express = require('express');
const { run, get, all, prepare } = require('../database/init');
const { authMiddleware, requireRole } = require('./auth');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = '';
    const params = [];
    
    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }
    
    const totalResult = await get(`
      SELECT COUNT(*) as count FROM exhibitors ${whereClause}
    `, ...params);
    const total = totalResult.count;
    
    const exhibitors = await all(`
      SELECT e.*, u.real_name as creator_name 
      FROM exhibitors e 
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(pageSize), offset);
    
    res.json({ list: exhibitors, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('查询展商列表失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const exhibitor = await get(`
      SELECT e.*, u.real_name as creator_name 
      FROM exhibitors e 
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = ?
    `, req.params.id);
    
    if (!exhibitor) {
      return res.status(404).json({ error: '展商不存在' });
    }
    
    res.json(exhibitor);
  } catch (err) {
    console.error('查询展商详情失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { companyName, companyCode, contactName, contactPhone, contactEmail, address, businessLicense } = req.body;
    
    if (!companyName || !companyCode || !contactName || !contactPhone) {
      return res.status(400).json({ error: '公司名称、公司编码、联系人、联系电话为必填项' });
    }
    
    const existing = await get('SELECT id FROM exhibitors WHERE company_code = ?', companyCode);
    if (existing) {
      return res.status(400).json({ error: '公司编码已存在' });
    }
    
    const result = await run(`
      INSERT INTO exhibitors (company_name, company_code, contact_name, contact_phone, contact_email, address, business_license, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, companyName, companyCode, contactName, contactPhone, contactEmail, address, businessLicense, req.user.id);
    
    const exhibitor = await get('SELECT * FROM exhibitors WHERE id = ?', result.lastID);
    res.status(201).json(exhibitor);
  } catch (err) {
    console.error('创建展商失败:', err);
    res.status(500).json({ error: '创建失败: ' + err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { companyName, contactName, contactPhone, contactEmail, address, businessLicense } = req.body;
    
    const exhibitor = await get('SELECT * FROM exhibitors WHERE id = ?', req.params.id);
    if (!exhibitor) {
      return res.status(404).json({ error: '展商不存在' });
    }
    
    await run(`
      UPDATE exhibitors 
      SET company_name = ?, contact_name = ?, contact_phone = ?, contact_email = ?, address = ?, business_license = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, companyName, contactName, contactPhone, contactEmail, address, businessLicense, req.params.id);
    
    const updated = await get('SELECT * FROM exhibitors WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('更新展商失败:', err);
    res.status(500).json({ error: '更新失败: ' + err.message });
  }
});

router.post('/:id/audit', authMiddleware, requireRole('organizer'), async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }
    
    const exhibitor = await get('SELECT * FROM exhibitors WHERE id = ?', req.params.id);
    if (!exhibitor) {
      return res.status(404).json({ error: '展商不存在' });
    }
    
    await run(`
      UPDATE exhibitors SET status = ?, reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, status, status === 'rejected' ? rejectReason : null, req.params.id);
    
    const updated = await get('SELECT * FROM exhibitors WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('审核展商失败:', err);
    res.status(500).json({ error: '审核失败: ' + err.message });
  }
});

module.exports = router;
