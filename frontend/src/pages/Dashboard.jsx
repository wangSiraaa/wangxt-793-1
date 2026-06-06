import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  PrinterOutlined,
  IdcardOutlined,
  ExclamationCircleOutlined,
  ScanOutlined
} from '@ant-design/icons';
import { verifyApi } from '../utils/api';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await verifyApi.stats();
      setStats(data);
    } catch (err) {
      console.error('加载统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">仪表盘</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="总人员数"
              value={stats.totalPersonnel || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="审核通过"
              value={stats.approvedPersonnel || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已制证"
              value={stats.printedCredentials || 0}
              prefix={<PrinterOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已发证"
              value={stats.issuedCredentials || 0}
              prefix={<IdcardOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="已挂失"
              value={stats.lostCredentials || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="核验成功"
              value={stats.successVerify || 0}
              prefix={<ScanOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="核验失败"
              value={stats.failedVerify || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="制证批次"
              value={stats.totalBatches || 0}
              prefix={<PrinterOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="业务规则说明" style={{ marginTop: 16 }}>
        <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
          <li><Tag color="red">照片不合规</Tag> 要退回并阻止制证</li>
          <li><Tag color="blue">制证后</Tag> 不能修改姓名和身份证号</li>
          <li><Tag color="orange">重复身份证</Tag> 导入时只保留一条并记录冲突</li>
          <li><Tag color="red">证件挂失后</Tag> 扫码核验必须失败</li>
        </ul>
      </Card>
    </div>
  );
};

export default Dashboard;
