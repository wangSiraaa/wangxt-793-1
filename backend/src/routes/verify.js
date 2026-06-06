const express = require('express');
const { run, get, all, prepare } = require('../database/init');
const { authMiddleware, requireRole } = require('./auth');

const router = express.Router();

router.post('/scan', authMiddleware, requireRole('security', 'organizer'), async (req, res) => {
  try {
    const { credentialId, location } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: '证件ID为必填项' });
    }
    
    const personnel = await get(`
      SELECT p.*, e.company_name, e.company_code
      FROM personnel p
      LEFT JOIN exhibitors e ON p.exhibitor_id = e.id
      WHERE p.id = ?
    `, credentialId);
    
    if (!personnel) {
      await run(`
        INSERT INTO verify_logs (personnel_id, credential_id, verify_result, fail_reason, verified_by, location)
        VALUES (?, ?, 'failed', '证件不存在', ?, ?)
      `, 0, credentialId, req.user.id, location);
      
      return res.status(404).json({
        success: false,
        result: 'failed',
        reason: '证件不存在',
        personnel: null
      });
    }
    
    let verifyResult = 'success';
    let failReason = null;
    
    if (personnel.audit_status !== 'approved') {
      verifyResult = 'failed';
      failReason = '证件未通过审核';
    } else if (personnel.photo_status !== 'approved') {
      verifyResult = 'failed';
      failReason = '照片未通过审核';
    } else if (personnel.credential_status === 'lost') {
      verifyResult = 'failed';
      failReason = '证件已挂失';
    } else if (personnel.credential_status === 'cancelled') {
      verifyResult = 'failed';
      failReason = '证件已注销';
    } else if (!['printed', 'issued'].includes(personnel.credential_status)) {
      verifyResult = 'failed';
      failReason = '证件未制证';
    }
    
    await run(`
      INSERT INTO verify_logs (personnel_id, credential_id, verify_result, fail_reason, verified_by, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `, personnel.id, credentialId, verifyResult, failReason, req.user.id, location);
    
    if (verifyResult === 'failed') {
      return res.json({
        success: false,
        result: 'failed',
        reason: failReason,
        personnel: {
          id: personnel.id,
          name: personnel.name,
          idCard: personnel.id_card,
          companyName: personnel.company_name,
          credentialType: personnel.credential_type,
          credentialStatus: personnel.credential_status
        }
      });
    }
    
    res.json({
      success: true,
      result: 'success',
      personnel: {
        id: personnel.id,
        name: personnel.name,
        idCard: personnel.id_card,
        companyName: personnel.company_name,
        credentialType: personnel.credential_type,
        credentialStatus: personnel.credential_status,
        photoPath: personnel.photo_path
      }
    });
  } catch (err) {
    console.error('核验证件失败:', err);
    res.status(500).json({ error: '核验失败: ' + err.message });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { personnelId, verifyResult, page = 1, pageSize = 20, startDate, endDate } = req.query;
    const offset = (page - 1) * pageSize;
    
    const conditions = [];
    const params = [];
    
    if (personnelId) {
      conditions.push('v.personnel_id = ?');
      params.push(personnelId);
    }
    if (verifyResult) {
      conditions.push('v.verify_result = ?');
      params.push(verifyResult);
    }
    if (startDate) {
      conditions.push('v.verify_time >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('v.verify_time <= ?');
      params.push(endDate + ' 23:59:59');
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const totalResult = await get(`
      SELECT COUNT(*) as count FROM verify_logs v ${whereClause}
    `, ...params);
    const total = totalResult.count;
    
    const list = await all(`
      SELECT v.*, p.name, p.id_card, p.credential_type, e.company_name, u.real_name as verifier_name
      FROM verify_logs v
      LEFT JOIN personnel p ON v.personnel_id = p.id
      LEFT JOIN exhibitors e ON p.exhibitor_id = e.id
      LEFT JOIN users u ON v.verified_by = u.id
      ${whereClause}
      ORDER BY v.verify_time DESC
      LIMIT ? OFFSET ?
    `, ...params, parseInt(pageSize), offset);
    
    res.json({ list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    console.error('查询核验日志失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = {
      totalPersonnel: (await get('SELECT COUNT(*) as count FROM personnel')).count,
      approvedPersonnel: (await get('SELECT COUNT(*) as count FROM personnel WHERE audit_status = ?', 'approved')).count,
      printedCredentials: (await get('SELECT COUNT(*) as count FROM personnel WHERE credential_status IN (?, ?)', 'printed', 'issued')).count,
      issuedCredentials: (await get('SELECT COUNT(*) as count FROM personnel WHERE credential_status = ?', 'issued')).count,
      lostCredentials: (await get('SELECT COUNT(*) as count FROM personnel WHERE credential_status = ?', 'lost')).count,
      totalVerify: (await get('SELECT COUNT(*) as count FROM verify_logs')).count,
      successVerify: (await get('SELECT COUNT(*) as count FROM verify_logs WHERE verify_result = ?', 'success')).count,
      failedVerify: (await get('SELECT COUNT(*) as count FROM verify_logs WHERE verify_result = ?', 'failed')).count,
      totalBatches: (await get('SELECT COUNT(*) as count FROM print_batches')).count
    };
    
    res.json(stats);
  } catch (err) {
    console.error('查询统计数据失败:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

module.exports = router;
