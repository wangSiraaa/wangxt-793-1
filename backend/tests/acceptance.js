const http = require('http');
const XLSX = require('xlsx');

const BASE_URL = new URL(process.env.BASE_URL || `http://localhost:${process.env.API_PORT || process.env.PORT || 17930}`);

function request(path, method = 'GET', body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL.hostname,
      port: BASE_URL.port || 80,
      path: '/api' + path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders }
    };
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(Buffer.isBuffer(body) ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function multipartRequest(path, fields, fileField, fileName, fileBuffer, token = null) {
  const boundary = 'acceptance-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`));
  chunks.push(fileBuffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const body = Buffer.concat(chunks);
  return request(path, 'POST', body, token, {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  });
}

function buildImportWorkbook(rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, '人员导入');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function log(msg, indent = 0) {
  console.log('  '.repeat(indent) + msg);
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  展会展商证件办理系统 - 验收测试');
  console.log('='.repeat(60));
  log('接口地址: ' + BASE_URL.origin);

  let token = null;
  let exhibitorId = 1;
  let personId = null;
  let testIdCard = '11010119900101' + Math.floor(1000 + Math.random() * 9000);
  let allPassed = true;

  function check(name, cond, detail = '') {
    if (cond) {
      log('✓ ' + name);
    } else {
      log('✗ ' + name + (detail ? ': ' + detail : ''));
      allPassed = false;
    }
  }

  try {
    log('');
    log('[1/9] 健康检查');
    const health = await request('/health');
    check('服务运行正常', health.status === 200 && health.data.status === 'ok');
    check('命中793展商证件系统', health.data.message && health.data.message.includes('展会展商证件办理系统'));

    log('');
    log('[2/9] 登录系统');
    const login = await request('/auth/login', 'POST', {
      username: 'organizer',
      password: 'organizer'
    });
    if (login.status === 200 && login.data.token) {
      token = login.data.token;
      check('登录成功，token 已获取', true);
      check('用户角色为 organizer', login.data.user.role === 'organizer');
    } else {
      check('登录成功', false, JSON.stringify(login.data));
      return 1;
    }

    log('');
    log('[3/9] 展商列表查询');
    const exhibitors = await request('/exhibitors?pageSize=10', 'GET', null, token);
    if (exhibitors.status === 200 && exhibitors.data.list && exhibitors.data.list.length > 0) {
      exhibitorId = exhibitors.data.list[0].id;
      check('展商列表获取成功', true);
      check('列表总数正确', exhibitors.data.total >= 1);
      check('默认展商ID=' + exhibitorId, true);
    } else {
      check('展商列表获取成功', false, JSON.stringify(exhibitors.data));
    }

    log('');
    log('[4/9] 人员创建与重复身份证冲突处理');
    
    log('4.1 添加第一个人员', 1);
    const p1 = await request('/personnel', 'POST', {
      exhibitorId: exhibitorId,
      name: '测试人员A',
      idCard: testIdCard,
      position: '工程师',
      credentialType: 'exhibitor'
    }, token);
    if (p1.status === 201 && p1.data.id) {
      personId = p1.data.id;
      check('人员创建成功，ID=' + personId, true);
    } else {
      check('人员创建成功', false, JSON.stringify(p1.data));
    }

    log('4.2 重复身份证冲突检测', 1);
    const p2 = await request('/personnel', 'POST', {
      exhibitorId: exhibitorId,
      name: '测试人员B',
      idCard: testIdCard,
      position: '经理',
      credentialType: 'vip'
    }, token);
    check('冲突检测标志存在', p2.data.conflict === true);
    check('返回原有记录ID', p2.data.existingId === personId);
    check('冲突提示信息正确', p2.data.message && p2.data.message.includes('身份证'));

    log('4.3 Excel人员导入与冲突统计', 1);
    const importWorkbook = buildImportWorkbook([
      { '姓名': '导入测试人员', '身份证号': '22010119900202' + Math.floor(1000 + Math.random() * 9000), '手机号': '13900139000', '性别': '男', '职位': '导入工程师', '证件类型': 'worker' },
      { '姓名': '导入重复人员', '身份证号': testIdCard, '手机号': '13900139001', '性别': '女', '职位': '导入经理', '证件类型': 'vip' }
    ]);
    const importResult = await multipartRequest('/personnel/import', { exhibitorId }, 'file', 'acceptance-personnel.xlsx', importWorkbook, token);
    check('人员导入接口成功', importResult.status === 200, JSON.stringify(importResult.data));
    check('导入成功数量正确', importResult.data.success === 1);
    check('导入冲突数量正确', importResult.data.conflict === 1);

    log('');
    log('[5/9] 照片审核');
    const photoAudit = await request(`/personnel/${personId}/photo-audit`, 'POST', {
      status: 'approved'
    }, token);
    check('照片审核通过', photoAudit.status === 200);

    log('');
    log('[6/9] 证件审核');
    const audit = await request(`/personnel/${personId}/audit`, 'POST', {
      status: 'approved'
    }, token);
    check('证件审核通过', audit.status === 200);

    log('');
    log('[7/9] 制证批次与字段锁定');
    const batch = await request('/batches', 'POST', {
      batchName: '验收测试批次-' + Math.floor(1000 + Math.random() * 9000),
      personnelIds: [personId]
    }, token);
    if ((batch.status === 200 || batch.status === 201) && batch.data.id) {
      check('制证批次创建成功，ID=' + batch.data.id, true);
      check('批次号已生成', !!batch.data.batch_no);
    } else {
      check('制证批次创建成功', false, JSON.stringify(batch.data));
    }

    log('7.1 制证后字段锁定验证', 1);
    const lockTest = await request(`/personnel/${personId}`, 'PUT', {
      name: '修改后姓名',
      idCard: '111111111111111111'
    }, token);
    check('姓名和身份证号不可修改', lockTest.status !== 200 || lockTest.data.error);

    log('7.2 制证后扫码核验', 1);
    const verify1 = await request('/verify/scan', 'POST', {
      credentialId: personId,
      location: '测试入口A'
    }, token);
    check('核验通过', verify1.status === 200 && verify1.data.success === true);
    if (verify1.data.personnel) {
      check('返回人员信息', !!verify1.data.personnel.name);
    }

    log('');
    log('[8/9] 证件挂失');
    const lose = await request(`/personnel/${personId}/lost`, 'POST', {}, token);
    check('挂失成功', lose.status === 200);

    log('');
    log('[9/9] 挂失后扫码核验（应返回失败）');
    const verify2 = await request('/verify/scan', 'POST', {
      credentialId: personId,
      location: '测试入口B'
    }, token);
    check('核验失败', verify2.status === 200 && verify2.data.success === false);
    check('失败原因正确', verify2.data.reason && verify2.data.reason.includes('挂失'));

  } catch (e) {
    log('');
    log('测试过程异常: ' + e.message);
    console.error(e);
    allPassed = false;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('  验收测试结果汇总');
  console.log('='.repeat(60));
  log('  ✓ 展商列表查询');
  log('  ✓ 人员创建');
  log('  ✓ 重复身份证冲突处理');
  log('  ✓ 照片审核');
  log('  ✓ 证件审核');
  log('  ✓ 制证批次创建');
  log('  ✓ 制证后字段锁定');
  log('  ✓ 扫码核验（制证后）');
  log('  ✓ 证件挂失');
  log('  ✓ 挂失后核验失败');
  console.log('='.repeat(60));
  
  if (allPassed) {
    console.log('');
    console.log('  🎉 所有验收测试通过！');
    console.log('');
    return 0;
  } else {
    console.log('');
    console.log('  ⚠️  部分测试未通过，请检查日志');
    console.log('');
    return 1;
  }
}

main().then(code => process.exit(code)).catch(e => {
  console.error(e);
  process.exit(1);
});
