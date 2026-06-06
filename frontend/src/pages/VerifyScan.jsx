import React, { useState, useEffect } from 'react';
import { Card, Input, Button, message, Space, Tag, Image, Descriptions, Result, Row, Col } from 'antd';
import { ScanOutlined, SearchOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { verifyApi } from '../utils/api';

const VerifyScan = () => {
  const [credentialId, setCredentialId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState([]);

  const handleScan = async () => {
    if (!credentialId.trim()) {
      message.warning('请输入证件ID');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyApi.scan({
        credentialId: credentialId.trim(),
        location: '主入口'
      });
      
      setVerifyResult(result);
      
      if (result.success) {
        message.success('核验通过');
      } else {
        message.error(`核验失败：${result.reason}`);
      }

      setRecentScans(prev => [
        { 
          id: Date.now(), 
          credentialId: credentialId.trim(), 
          result, 
          time: new Date().toLocaleString() 
        },
        ...prev.slice(0, 9)
      ]);
    } catch (err) {
      message.error(err.error || '核验失败');
      setVerifyResult({
        success: false,
        result: 'failed',
        reason: err.error || '系统错误',
        personnel: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div>
      <h2 className="page-title">扫码核验</h2>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="证件核验">
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                size="large"
                placeholder="请输入证件ID或扫码"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                onKeyPress={handleKeyPress}
                prefix={<ScanOutlined />}
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SearchOutlined />}
                loading={loading}
                onClick={handleScan}
              >
                核验
              </Button>
            </Space.Compact>

            <p style={{ color: '#999', fontSize: 12 }}>
              提示：请使用扫码枪扫描证件二维码，或手动输入人员ID进行核验
            </p>

            {verifyResult && (
              <div style={{ marginTop: 24 }}>
                {verifyResult.success ? (
                  <Result
                    status="success"
                    icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    title={<span className="verify-success">核验通过</span>}
                    subTitle={verifyResult.reason || '证件有效，允许入场'}
                  />
                ) : (
                  <Result
                    status="error"
                    icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                    title={<span className="verify-failed">核验失败</span>}
                    subTitle={verifyResult.reason || '证件无效'}
                  />
                )}

                {verifyResult.personnel && (
                  <Card size="small" style={{ marginTop: 16 }}>
                    <Descriptions column={1} size="small">
                      {verifyResult.personnel.photoPath && (
                        <Descriptions.Item label="照片">
                          <Image
                            width={100}
                            height={120}
                            src={verifyResult.personnel.photoPath}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="姓名">{verifyResult.personnel.name}</Descriptions.Item>
                      <Descriptions.Item label="身份证号">{verifyResult.personnel.idCard}</Descriptions.Item>
                      <Descriptions.Item label="公司">{verifyResult.personnel.companyName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="证件类型">
                        {{ exhibitor: '展商证', worker: '工作人员证', vip: 'VIP证', media: '媒体证' }[verifyResult.personnel.credentialType] || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="证件状态">
                        <Tag color={
                          verifyResult.personnel.credentialStatus === 'lost' ? 'red' :
                          verifyResult.personnel.credentialStatus === 'issued' ? 'green' :
                          verifyResult.personnel.credentialStatus === 'printed' ? 'blue' : 'default'
                        }>
                          {{ draft: '草稿', printed: '已制证', issued: '已发证', lost: '已挂失', cancelled: '已注销' }[verifyResult.personnel.credentialStatus] || '-'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="最近核验记录">
            {recentScans.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂无核验记录</p>
            ) : (
              recentScans.map(scan => (
                <Card 
                  key={scan.id}
                  size="small"
                  style={{ marginBottom: 8 }}
                  title={
                    <Space>
                      <span>证件ID: {scan.credentialId}</span>
                      {scan.result.success ? (
                        <Tag color="green" icon={<CheckCircleOutlined />}>通过</Tag>
                      ) : (
                        <Tag color="red" icon={<ExclamationCircleOutlined />}>失败</Tag>
                      )}
                    </Space>
                  }
                >
                  <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                    {scan.time} - {scan.result.reason || ''}
                    {scan.result.personnel?.name && ` - ${scan.result.personnel.name}`}
                  </p>
                </Card>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VerifyScan;
