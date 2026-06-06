import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Image, Card, Select, Drawer, Descriptions } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import { personnelApi } from '../utils/api';

const { Option } = Select;

const PhotoAudit = () => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [auditForm] = Form.useForm();

  useEffect(() => {
    loadList();
  }, [page, pageSize]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await personnelApi.list({
        photoStatus: 'pending',
        auditStatus: 'pending',
        page,
        pageSize
      });
      setList(res.list.filter(item => item.photo_path));
      setTotal(res.total);
    } catch (err) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = (record) => {
    setCurrentItem(record);
    auditForm.resetFields();
    setAuditModalVisible(true);
  };

  const handleViewDetail = (record) => {
    setCurrentItem(record);
    setDetailVisible(true);
  };

  const handleAuditSubmit = async (values) => {
    try {
      await personnelApi.photoAudit(currentItem.id, values);
      message.success('审核完成');
      setAuditModalVisible(false);
      loadList();
    } catch (err) {
      message.error(err.error || '审核失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待审核' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已驳回' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    { 
      title: '照片', 
      dataIndex: 'photo_path', 
      key: 'photo_path', 
      width: 100,
      render: (photo) => photo ? (
        <Image width={60} height={72} src={photo} style={{ objectFit: 'cover', borderRadius: 4 }} />
      ) : <Tag color="default">未上传</Tag>
    },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '身份证号', dataIndex: 'id_card', key: 'id_card', width: 180 },
    { title: '公司', dataIndex: 'company_name', key: 'company_name' },
    { title: '证件类型', dataIndex: 'credential_type', key: 'credential_type', width: 100 },
    { title: '照片状态', dataIndex: 'photo_status', key: 'photo_status', width: 100, render: getStatusTag },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>查看</Button>
          <Button type="link" size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleAudit(record)}>审核</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 className="page-title">照片审核</h2>
      
      <Card>
        <Table
          loading={loading}
          columns={columns}
          dataSource={list}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); }
          }}
        />
      </Card>

      <Modal
        title="照片审核"
        open={auditModalVisible}
        onCancel={() => setAuditModalVisible(false)}
        footer={null}
        width={600}
      >
        {currentItem && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Image
                width={200}
                height={240}
                src={currentItem.photo_path}
                style={{ objectFit: 'cover', borderRadius: 8, border: '2px solid #1890ff' }}
              />
            </div>
            <p style={{ textAlign: 'center', marginBottom: 16 }}>
              <strong>{currentItem.name}</strong> - {currentItem.id_card}
            </p>
            <Form form={auditForm} layout="vertical" onFinish={handleAuditSubmit}>
              <Form.Item name="status" label="审核结果" rules={[{ required: true }]} initialValue="approved">
                <Select>
                  <Option value="approved">照片合格，通过</Option>
                  <Option value="rejected">照片不合格，驳回</Option>
                </Select>
              </Form.Item>
              <Form.Item name="rejectReason" label="驳回原因">
                <Input.TextArea rows={3} placeholder="照片不清晰、照片非本人、照片格式不符合要求等" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block>提交</Button>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Drawer
        title="人员详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentItem && (
          <>
            {currentItem.photo_path && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Image
                  width={200}
                  height={240}
                  src={currentItem.photo_path}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
            <Descriptions bordered column={1}>
              <Descriptions.Item label="姓名">{currentItem.name}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{currentItem.id_card}</Descriptions.Item>
              <Descriptions.Item label="公司">{currentItem.company_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="职位">{currentItem.position || '-'}</Descriptions.Item>
              <Descriptions.Item label="证件类型">{currentItem.credential_type}</Descriptions.Item>
              <Descriptions.Item label="照片状态">{getStatusTag(currentItem.photo_status)}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default PhotoAudit;
