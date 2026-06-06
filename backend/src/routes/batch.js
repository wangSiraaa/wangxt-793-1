const express = require('express');
const dayjs = require('dayjs');
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
      SELECT COUNT(*) as count FROM print_batches ${whereClause}
    `, ...params);
    const total = totalResult.count;
    
    const list = await all(`
      SELECT b.*, u.real_name as creator_name
      FROM print_batches b
      LEFT JOIN users u ON b.created_by = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(pageSize), offset);
    
    res.json({ list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('查询批次列表失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const batch = await get(`
      SELECT b.*, u.real_name as creator_name
      FROM print_batches b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ?
    `, req.params.id);
    
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    const personnel = await all(`
      SELECT p.*, e.company_name
      FROM personnel p
      LEFT JOIN exhibitors e ON p.exhibitor_id = e.id
      WHERE p.batch_id = ?
      ORDER BY p.created_at DESC
    `, req.params.id);
    
    res.json({ ...batch, personnel });
  } catch (err) {
    console.error('查询批次详情失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.post('/', authMiddleware, requireRole('printer', 'organizer'), async (req, res) => {
  try {
    const { batchName, personnelIds } = req.body;
    
    const batchNo = `BATCH${dayjs().format('YYYYMMDDHHmmss')}`;
    
    const result = await run(`
      INSERT INTO print_batches (batch_no, batch_name, total_count, created_by)
      VALUES (?, ?, ?, ?)
    `, batchNo, batchName || '', personnelIds ? personnelIds.length : 0, req.user.id);
    
    const batchId = result.lastID;
    
    if (personnelIds && personnelIds.length > 0) {
      let printedCount = 0;
      for (const id of personnelIds) {
        const updateResult = await run(`
          UPDATE personnel 
          SET batch_id = ?, credential_status = 'printed', is_locked = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND audit_status = 'approved' AND photo_status = 'approved'
        `, batchId, id);
        if (updateResult.changes > 0) {
          printedCount++;
        }
      }
      await run('UPDATE print_batches SET printed_count = ? WHERE id = ?', printedCount, batchId);
    }
    
    const batch = await get('SELECT * FROM print_batches WHERE id = ?', batchId);
    res.status(201).json(batch);
  } catch (err) {
    console.error('创建批次失败:', err);
    res.status(500).json({ error: '创建失败: ' + err.message });
  }
});

router.post('/:id/print', authMiddleware, requireRole('printer', 'organizer'), async (req, res) => {
  try {
    const { personnelIds } = req.body;
    
    const batch = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    if (batch.status === 'completed') {
      return res.status(400).json({ error: '批次已完成，不能再制证' });
    }
    
    if (personnelIds && personnelIds.length > 0) {
      let printedCount = 0;
      for (const id of personnelIds) {
        const updateResult = await run(`
          UPDATE personnel 
          SET batch_id = ?, credential_status = 'printed', is_locked = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND audit_status = 'approved' AND photo_status = 'approved' AND credential_status = 'draft'
        `, req.params.id, id);
        if (updateResult.changes > 0) {
          printedCount++;
        }
      }
      await run(`
        UPDATE print_batches 
        SET printed_count = printed_count + ?, total_count = total_count + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, printedCount, personnelIds.length, req.params.id);
    }
    
    await run(`
      UPDATE print_batches SET status = 'printing', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, req.params.id);
    
    const updated = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('制证失败:', err);
    res.status(500).json({ error: '制证失败: ' + err.message });
  }
});

router.post('/:id/complete', authMiddleware, requireRole('printer', 'organizer'), async (req, res) => {
  try {
    const batch = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    await run(`
      UPDATE print_batches SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, req.params.id);
    
    const updated = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('完成批次失败:', err);
    res.status(500).json({ error: '操作失败: ' + err.message });
  }
});

router.put('/:id', authMiddleware, requireRole('printer', 'organizer'), async (req, res) => {
  try {
    const { batchName } = req.body;
    
    const batch = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }
    
    await run(`
      UPDATE print_batches SET batch_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, batchName, req.params.id);
    
    const updated = await get('SELECT * FROM print_batches WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('更新批次失败:', err);
    res.status(500).json({ error: '更新失败: ' + err.message });
  }
});

module.exports = router;
