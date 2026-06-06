const http = require('http');

const BASE_URL = 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api`;

let authToken = '';
let createdPersonnelIds = [];
let createdBatchId = null;
let defaultExhibitorId = 1;

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function makeOptions(path, method = 'GET', data = null) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (data) {
    options.headers['Content-Length'] = Buffer.byteLength(data);
  }
  return options;
}

async function login(username, password) {
  console.log(`\n[登录] 使用账号: ${username}`);
  const data = JSON.stringify({ username, password });
  const result = await request(makeOptions(`${API_BASE}/auth/login`, 'POST', data), data);
  if (result.statusCode === 200 && result.data.token) {
    authToken = result.data.token;
    console.log(`  ✓ 登录成功，角色: ${result.data.user?.role}`);
    return result.data;
  }
  throw new Error(`登录失败: ${JSON.stringify(result.data)}`);
}

async function getFirstExhibitorId() {
  const result = await request(makeOptions(`${API_BASE}/exhibitors?pageSize=1`));
  if (result.statusCode === 200 && result.data.list && result.data.list.length > 0) {
    defaultExhibitorId = result.data.list[0].id;
    console.log(`  获取到默认展商ID: ${defaultExhibitorId}`);
    return defaultExhibitorId;
  }
  return 1;
}

async function addPersonnel(person) {
  const personWithExhibitor = { ...person, exhibitorId: defaultExhibitorId };
  console.log(`\n[添加人员] ${person.name}, 身份证: ${person.id_card}`);
  const data = JSON.stringify(personWithExhibitor);
  const result = await request(makeOptions(`${API_BASE}/personnel`, 'POST', data), data);
  if (result.statusCode === 200 || result.statusCode === 201) {
    if (result.data.id) {
      createdPersonnelIds.push(result.data.id);
      console.log(`  ✓ 添加成功, ID: ${result.data.id}`);
      return result.data;
    } else if (result.data.conflict) {
      console.log(`  ⚠ 身份证重复，已保留原有记录, 原有ID: ${result.data.existingId}`);
      return { id: result.data.existingId, conflict: true };
    }
  }
  console.log(`  ✗ 添加失败: ${JSON.stringify(result.data)}`);
  return null;
}

async function getPersonnelList() {
  console.log(`\n[查询人员列表]`);
  const result = await request(makeOptions(`${API_BASE}/personnel?pageSize=100`));
  if (result.statusCode === 200) {
    console.log(`  ✓ 共 ${result.data.total} 条记录`);
    return result.data.list;
  }
  return [];
}

async function approvePhoto(personnelId) {
  console.log(`\n[照片审核通过] 人员ID: ${personnelId}`);
  const data = JSON.stringify({ status: 'approved' });
  const result = await request(makeOptions(`${API_BASE}/personnel/${personnelId}/photo-audit`, 'POST', data), data);
  if (result.statusCode === 200) {
    console.log(`  ✓ 照片审核通过`);
    return true;
  }
  console.log(`  ✗ 审核失败: ${JSON.stringify(result.data)}`);
  return false;
}

async function approveCredential(personnelId) {
  console.log(`\n[证件审核通过] 人员ID: ${personnelId}`);
  const data = JSON.stringify({ status: 'approved' });
  const result = await request(makeOptions(`${API_BASE}/personnel/${personnelId}/audit`, 'POST', data), data);
  if (result.statusCode === 200) {
    console.log(`  ✓ 证件审核通过`);
    return true;
  }
  console.log(`  ✗ 审核失败: ${JSON.stringify(result.data)}`);
  return false;
}

async function createBatch(batchName, personnelIds) {
  console.log(`\n[创建制证批次] ${batchName}, 人员数: ${personnelIds.length}`);
  const data = JSON.stringify({ batchName, personnelIds });
  const result = await request(makeOptions(`${API_BASE}/batches`, 'POST', data), data);
  if (result.statusCode === 200 && result.data.id) {
    createdBatchId = result.data.id;
    console.log(`  ✓ 批次创建成功, ID: ${result.data.id}, 批次号: ${result.data.batch_no}`);
    return result.data;
  }
  console.log(`  ✗ 创建失败: ${JSON.stringify(result.data)}`);
  return null;
}

async function getPersonnelDetail(personnelId) {
  console.log(`\n[查询人员详情] ID: ${personnelId}`);
  const result = await request(makeOptions(`${API_BASE}/personnel/${personnelId}`));
  if (result.statusCode === 200) {
    console.log(`  ✓ 姓名: ${result.data.name}, 证件状态: ${result.data.credential_status}, 锁定: ${result.data.is_locked}`);
    return result.data;
  }
  return null;
}

async function loseCredential(personnelId) {
  console.log(`\n[证件挂失] 人员ID: ${personnelId}`);
  const result = await request(makeOptions(`${API_BASE}/personnel/${personnelId}/lose`, 'POST', JSON.stringify({})), JSON.stringify({}));
  if (result.statusCode === 200) {
    console.log(`  ✓ 挂失成功`);
    return true;
  }
  console.log(`  ✗ 挂失失败: ${JSON.stringify(result.data)}`);
  return false;
}

async function verifyCredential(personnelId) {
  console.log(`\n[扫码核验] 人员ID: ${personnelId}`);
  const data = JSON.stringify({ credentialId: personnelId, location: '验收测试入口' });
  const result = await request(makeOptions(`${API_BASE}/verify/scan`, 'POST', data), data);
  if (result.statusCode === 200) {
    console.log(`  ✓ 核验结果: ${result.data.success ? '通过' : '失败'}, 原因: ${result.data.reason}`);
    return result.data;
  }
  console.log(`  ✗ 核验请求失败: ${JSON.stringify(result.data)}`);
  return null;
}

async function checkLockedFields(personnelId) {
  console.log(`\n[验证制证后字段锁定] 人员ID: ${personnelId}`);
  const data = JSON.stringify({ name: '修改后姓名', idCard: '110101199001019999' });
  const result = await request(makeOptions(`${API_BASE}/personnel/${personnelId}`, 'PUT', data), data);
  if (result.statusCode !== 200) {
    console.log(`  ✓ 字段锁定生效，修改被拒绝: ${result.data.error}`);
    return true;
  }
  console.log(`  ✗ 字段锁定未生效！修改成功了`);
  return false;
}

async function checkDuplicateIdCard() {
  console.log(`\n[测试1: 重复身份证导入冲突处理]`);
  console.log('='.repeat(60));
  
  console.log('\n步骤1: 添加第一个人员 (身份证: 110101199001011234)');
  const person1 = await addPersonnel({
    name: '张三',
    idCard: '110101199001011234',
    companyName: '测试科技有限公司',
    position: '工程师',
    credentialType: 'exhibitor'
  });
  
  console.log('\n步骤2: 尝试添加第二个人员 (使用相同身份证号)');
  const person2 = await addPersonnel({
    name: '李四',
    idCard: '110101199001011234',
    companyName: '另一家公司',
    position: '经理',
    credentialType: 'vip'
  });
  
  console.log('\n步骤3: 查询人员列表确认');
  const list = await getPersonnelList();
  const duplicateRecords = list.filter(p => p.id_card === '110101199001011234');
  console.log(`  身份证 110101199001011234 出现次数: ${duplicateRecords.length}`);
  
  if (duplicateRecords.length === 1) {
    console.log('  ✓ 重复身份证处理正确：只保留一条记录');
    const record = duplicateRecords[0];
    if (record.import_conflict === 1) {
      console.log('  ✓ 冲突标记已设置');
      console.log(`  ✓ 冲突说明: ${record.conflict_note || '无'}`);
    }
    return true;
  } else {
    console.log('  ✗ 重复身份证处理失败：存在多条相同身份证记录');
    return false;
  }
}

async function testLoseAndVerify() {
  console.log(`\n\n[测试2: 证件挂失后扫码核验失败]`);
  console.log('='.repeat(60));
  
  console.log('\n步骤1: 添加一个新人员用于测试挂失');
  const person = await addPersonnel({
    name: '王五',
    idCard: '110101198505055678',
    companyName: '挂失测试公司',
    position: '测试员',
    credentialType: 'exhibitor'
  });
  
  if (!person) {
    console.log('  ✗ 人员创建失败，无法继续测试');
    return false;
  }
  const personId = person.id;
  
  console.log('\n步骤2: 审核照片和证件');
  await approvePhoto(personId);
  await approveCredential(personId);
  
  console.log('\n步骤3: 创建制证批次并制证');
  const batch = await createBatch('挂失测试批次', [personId]);
  if (!batch) {
    console.log('  ✗ 制证批次创建失败');
    return false;
  }
  
  console.log('\n步骤4: 验证制证后字段锁定');
  const locked = await checkLockedFields(personId);
  
  console.log('\n步骤5: 制证后核验（应该通过）');
  const verifyBeforeLose = await verifyCredential(personId);
  const verifyPassedBefore = verifyBeforeLose && verifyBeforeLose.success;
  if (verifyPassedBefore) {
    console.log('  ✓ 制证后核验通过，状态正常');
  } else {
    console.log('  ✗ 制证后核验异常');
  }
  
  console.log('\n步骤6: 挂失证件');
  const lost = await loseCredential(personId);
  if (!lost) {
    console.log('  ✗ 挂失失败');
    return false;
  }
  
  console.log('\n步骤7: 挂失后核验（应该失败）');
  const verifyAfterLose = await verifyCredential(personId);
  const verifyFailedAfter = verifyAfterLose && !verifyAfterLose.success;
  
  if (verifyFailedAfter) {
    console.log('  ✓ 挂失后核验失败，符合预期');
    console.log(`  ✓ 失败原因: ${verifyAfterLose.reason}`);
  } else {
    console.log('  ✗ 挂失后核验仍然通过！这是BUG！');
  }
  
  return locked && verifyPassedBefore && verifyFailedAfter;
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  展会展商证件办理系统 - 验收测试');
  console.log('='.repeat(60));
  
  try {
    console.log('\n[准备] 等待服务启动...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n[准备] 登录系统...');
    await login('organizer', 'organizer');
    
    console.log('\n[准备] 获取默认展商ID...');
    await getFirstExhibitorId();
    
    const test1Result = await checkDuplicateIdCard();
    const test2Result = await testLoseAndVerify();
    
    console.log('\n\n' + '='.repeat(60));
    console.log('  测试结果汇总');
    console.log('='.repeat(60));
    console.log(`  测试1 - 重复身份证冲突处理: ${test1Result ? '✓ 通过' : '✗ 失败'}`);
    console.log(`  测试2 - 挂失后核验失败: ${test2Result ? '✓ 通过' : '✗ 失败'}`);
    console.log('='.repeat(60));
    
    const allPassed = test1Result && test2Result;
    if (allPassed) {
      console.log('\n  🎉 所有验收测试通过！');
    } else {
      console.log('\n  ❌ 部分测试未通过，请检查！');
    }
    console.log('='.repeat(60));
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (err) {
    console.error('\n❌ 测试执行出错:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runAllTests();
