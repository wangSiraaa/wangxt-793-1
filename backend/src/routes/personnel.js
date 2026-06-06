const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { run, get, all, prepare } = require('../database/init');
const { authMiddleware, requireRole } = require('./auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { exhibitorId, auditStatus, photoStatus, credentialStatus, credentialType, page = 1, pageSize = 20, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    const conditions = [];
    const params = [];
    
    if (exhibitorId) {
      conditions.push('p.exhibitor_id = ?');
      params.push(exhibitorId);
    }
    if (auditStatus) {
      conditions.push('p.audit_status = ?');
      params.push(auditStatus);
    }
    if (photoStatus) {
      conditions.push('p.photo_status = ?');
      params.push(photoStatus);
    }
    if (credentialStatus) {
      conditions.push('p.credential_status = ?');
      params.push(credentialStatus);
    }
    if (credentialType) {
      conditions.push('p.credential_type = ?');
      params.push(credentialType);
    }
    if (keyword) {
      conditions.push('(p.name LIKE ? OR p.id_card LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const totalResult = await get(`
      SELECT COUNT(*) as count FROM personnel p ${whereClause}
    `, ...params);
    const total = totalResult.count;
    
    const list = await all(`
      SELECT p.*, e.company_name, e.company_code, b.batch_no
      FROM personnel p
      LEFT JOIN exhibitors e ON p.exhibitor_id = e.id
      LEFT JOIN print_batches b ON p.batch_id = b.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(pageSize), offset);
    
    res.json({ list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('查询人员列表失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const personnel = await get(`
      SELECT p.*, e.company_name, e.company_code, b.batch_no
      FROM personnel p
      LEFT JOIN exhibitors e ON p.exhibitor_id = e.id
      LEFT JOIN print_batches b ON p.batch_id = b.id
      WHERE p.id = ?
    `, req.params.id);
    
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    res.json(personnel);
  } catch (err) {
    console.error('查询人员详情失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { exhibitorId, name, idCard, phone, gender, position, credentialType } = req.body;
    
    if (!exhibitorId || !name || !idCard) {
      return res.status(400).json({ error: '展商ID、姓名、身份证号为必填项' });
    }
    
    const existing = await get('SELECT id FROM personnel WHERE id_card = ?', idCard);
    let importConflict = 0;
    let conflictNote = null;
    
    if (existing) {
      importConflict = 1;
      conflictNote = `身份证号 ${idCard} 已存在，保留原有记录`;
      return res.json({ 
        conflict: true, 
        existingId: existing.id,
        message: conflictNote 
      });
    }
    
    const result = await run(`
      INSERT INTO personnel (exhibitor_id, name, id_card, phone, gender, position, credential_type, import_conflict, conflict_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, exhibitorId, name, idCard, phone, gender, position, credentialType || 'exhibitor', importConflict, conflictNote);
    
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', result.lastID);
    res.status(201).json(personnel);
  } catch (err) {
    console.error('创建人员失败:', err);
    res.status(500).json({ error: '创建失败: ' + err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, idCard, phone, gender, position, credentialType } = req.body;
    
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (personnel.is_locked === 1) {
      if (name !== personnel.name || idCard !== personnel.id_card) {
        return res.status(400).json({ error: '已制证的人员姓名和身份证号不能修改' });
      }
    }
    
    await run(`
      UPDATE personnel 
      SET name = ?, id_card = ?, phone = ?, gender = ?, position = ?, credential_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      personnel.is_locked === 1 ? personnel.name : name,
      personnel.is_locked === 1 ? personnel.id_card : idCard,
      phone, gender, position, credentialType || personnel.credential_type,
      req.params.id
    );
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('更新人员失败:', err);
    res.status(500).json({ error: '更新失败: ' + err.message });
  }
});

router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  const { exhibitorId } = req.body;
  
  if (!exhibitorId) {
    return res.status(400).json({ error: '展商ID为必填项' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: '请上传Excel文件' });
  }
  
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const results = {
      total: data.length,
      success: 0,
      conflict: 0,
      failed: 0,
      conflicts: [],
      errors: []
    };
    
    for (const item of data) {
      try {
        const name = item['姓名'] || item.name;
        const idCard = item['身份证号'] || item.idCard || item['身份证'];
        const phone = item['手机号'] || item.phone || item['电话'];
        const gender = item['性别'] || item.gender;
        const position = item['职位'] || item.position;
        const credentialType = item['证件类型'] || item.credentialType || 'exhibitor';
        
        if (!name || !idCard) {
          results.failed++;
          results.errors.push({ row: item, reason: '姓名和身份证号为必填项' });
          continue;
        }
        
        const existing = await get('SELECT id, name FROM personnel WHERE id_card = ?', idCard);
        
        if (existing) {
          results.conflict++;
          results.conflicts.push({
            idCard,
            name,
            existingName: existing.name,
            existingId: existing.id,
            note: `身份证号 ${idCard} 已存在（原记录：${existing.name}），保留原有记录`
          });
          continue;
        }
        
        const genderMap = { '男': 'male', '女': 'female', 'male': 'male', 'female': 'female' };
        const dbGender = genderMap[gender] || 'other';
        
        await run(`
          INSERT INTO personnel (exhibitor_id, name, id_card, phone, gender, position, credential_type, import_conflict, conflict_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, exhibitorId, name, idCard, phone, dbGender, position, credentialType, 0, null);
        results.success++;
      } catch (rowErr) {
        results.failed++;
        results.errors.push({ row: item, reason: rowErr.message });
      }
    }
    
    fs.unlinkSync(req.file.path);
    
    res.json(results);
  } catch (err) {
    console.error('导入失败:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

router.post('/:id/photo', authMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: '请上传照片' });
    }
    
    const photoPath = `/uploads/${req.file.filename}`;
    
    await run(`
      UPDATE personnel SET photo_path = ?, photo_status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, photoPath, req.params.id);
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('上传照片失败:', err);
    res.status(500).json({ error: '上传失败: ' + err.message });
  }
});

router.post('/:id/photo-audit', authMiddleware, requireRole('organizer'), async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }
    
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    await run(`
      UPDATE personnel SET photo_status = ?, photo_reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, status, status === 'rejected' ? rejectReason : null, req.params.id);
    
    if (status === 'rejected') {
      await run(`
        UPDATE personnel SET audit_status = 'rejected', audit_reject_reason = ?, credential_status = 'draft'
        WHERE id = ?
      `, `照片审核不通过: ${rejectReason}`, req.params.id);
    }
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('照片审核失败:', err);
    res.status(500).json({ error: '审核失败: ' + err.message });
  }
});

router.post('/:id/audit', authMiddleware, requireRole('organizer'), async (req, res) => {
  try {
    const { status, rejectReason } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审核状态' });
    }
    
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (status === 'approved' && personnel.photo_status !== 'approved') {
      return res.status(400).json({ error: '照片审核通过后才能进行证件审核' });
    }
    
    await run(`
      UPDATE personnel SET audit_status = ?, audit_reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, status, status === 'rejected' ? rejectReason : null, req.params.id);
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('证件审核失败:', err);
    res.status(500).json({ error: '审核失败: ' + err.message });
  }
});

router.post('/:id/lost', authMiddleware, async (req, res) => {
  try {
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (!['printed', 'issued'].includes(personnel.credential_status)) {
      return res.status(400).json({ error: '只有已制证或已发证的证件才能挂失' });
    }
    
    await run(`
      UPDATE personnel SET credential_status = 'lost', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, req.params.id);
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('挂失失败:', err);
    res.status(500).json({ error: '挂失失败: ' + err.message });
  }
});

router.post('/:id/issue', authMiddleware, requireRole('organizer', 'printer'), async (req, res) => {
  try {
    const { receiverName, notes } = req.body;
    
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (personnel.credential_status !== 'printed') {
      return res.status(400).json({ error: '只有已制证的证件才能发证' });
    }
    
    await run(`
      INSERT INTO issue_records (personnel_id, issued_by, receiver_name, notes)
      VALUES (?, ?, ?, ?)
    `, req.params.id, req.user.id, receiverName, notes);
    
    await run(`
      UPDATE personnel SET credential_status = 'issued', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, req.params.id);
    
    const updated = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('发证失败:', err);
    res.status(500).json({ error: '发证失败: ' + err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const personnel = await get('SELECT * FROM personnel WHERE id = ?', req.params.id);
    if (!personnel) {
      return res.status(404).json({ error: '人员不存在' });
    }
    
    if (personnel.is_locked === 1) {
      return res.status(400).json({ error: '已制证的人员不能删除' });
    }
    
    await run('DELETE FROM personnel WHERE id = ?', req.params.id);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('删除失败:', err);
    res.status(500).json({ error: '删除失败: ' + err.message });
  }
});

module.exports = router;
