#!/bin/bash

BASE="http://localhost:3001/api"

# 登录
echo "=== 登录 ==="
LOGIN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" -d '{"username":"organizer","password":"organizer"}')
echo $LOGIN
TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "TOKEN: $TOKEN"
AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== 测试1: 重复身份证冲突处理 ==="
echo "添加第一个人员:"
curl -s -X POST $BASE/personnel -H "Content-Type: application/json" -H "$AUTH" -d '{"exhibitorId":1,"name":"测试人员A","idCard":"110101199001011234","position":"工程师","credentialType":"exhibitor"}'
echo ""

echo "尝试添加相同身份证:"
curl -s -X POST $BASE/personnel -H "Content-Type: application/json" -H "$AUTH" -d '{"exhibitorId":1,"name":"测试人员B","idCard":"110101199001011234","position":"经理","credentialType":"vip"}'
echo ""

echo ""
echo "=== 测试2: 制证、挂失、核验 ==="
echo "添加新人员:"
RESULT=$(curl -s -X POST $BASE/personnel -H "Content-Type: application/json" -H "$AUTH" -d '{"exhibitorId":1,"name":"挂失测试员","idCard":"110101198505055678","position":"测试","credentialType":"exhibitor"}')
echo $RESULT
PERSON_ID=$(echo $RESULT | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
echo "人员ID: $PERSON_ID"

echo ""
echo "照片审核通过:"
curl -s -X POST $BASE/personnel/$PERSON_ID/photo-audit -H "Content-Type: application/json" -H "$AUTH" -d '{"status":"approved"}'
echo ""

echo "证件审核通过:"
curl -s -X POST $BASE/personnel/$PERSON_ID/audit -H "Content-Type: application/json" -H "$AUTH" -d '{"status":"approved"}'
echo ""

echo "创建制证批次:"
curl -s -X POST $BASE/batches -H "Content-Type: application/json" -H "$AUTH" -d "{\"batchName\":\"验收测试批次\",\"personnelIds\":[$PERSON_ID]}"
echo ""

echo ""
echo "制证后核验(应该通过):"
curl -s -X POST $BASE/verify/scan -H "Content-Type: application/json" -H "$AUTH" -d "{\"credentialId\":\"$PERSON_ID\",\"location\":\"测试入口\"}"
echo ""

echo ""
echo "制证后尝试修改姓名和身份证(应该被拒绝):"
curl -s -X PUT $BASE/personnel/$PERSON_ID -H "Content-Type: application/json" -H "$AUTH" -d '{"name":"修改后","idCard":"111111111111111111"}'
echo ""

echo ""
echo "挂失证件:"
curl -s -X POST $BASE/personnel/$PERSON_ID/lose -H "Content-Type: application/json" -H "$AUTH" -d '{}'
echo ""

echo ""
echo "挂失后核验(应该失败):"
curl -s -X POST $BASE/verify/scan -H "Content-Type: application/json" -H "$AUTH" -d "{\"credentialId\":\"$PERSON_ID\",\"location\":\"测试入口\"}"
echo ""

echo ""
echo "=== 测试完成 ==="
