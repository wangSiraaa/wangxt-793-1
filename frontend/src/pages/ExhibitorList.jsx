import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Tag, Drawer, Descriptions, Card, Select } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { exhibitorApi } from '../utils/api';

const { Option } = Select;

const ExhibitorList = () => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [auditForm] = Form.useForm();

  useEffect(() => {
    loadList();
  }, [page, pageSize]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await exhibitorApi.list({ page, pageSize });
      setList(res.list);
      setTotal(res.total);
    } catch (err) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    form.setFieldsValue({
      companyName: record.company_name,
      companyCode: record.company_code,
      contactName: record.contact_name,
      contactPhone: record.contact_phone,
      contactEmail: record.contact_email,
      address: record.address
    });
    setAddModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingId) {
        await exhibitorApi.update(editingId, values);
        message.success('修改成功');
      } else {
        await exhibitorApi.create(values);
        message.success('添加成功');
      }
      setAddModalVisible(false);
      loadList();
    } catch (err) {
      message.error(err.error || '操作失败');
    }
  };

  const handleViewDetail = (record) => {
    setCurrentItem(record);
    setDetailVisible(true);
  };

  const handleAudit = (record) => {
    setCurrentItem(record);
    auditForm.resetFields();
    setAuditModalVisible(true);
  };

  const handleAuditSubmit = async (values) => {
    try {
      await exhibitorApi.audit(currentItem.id, values);
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
    { title: '公司名称', dataIndex: 'company_name', key: 'company_name' },
    { title: '公司编码', dataIndex: 'company_code', key: 'company_code', width: 120 },
    { title: '联系人', dataIndex: 'contact_name', key: 'contact_name', width: 100 },
    { title: '联系电话', dataIndex: 'contact_phone', key: 'contact_phone', width: 120 },
    { title: '邮箱', dataIndex: 'contact_email', key: 'contact_email' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: getStatusTag },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleAudit(record)}>审核</Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 className="page-title">展商管理</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加展商
          </Button>
        </Space>

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
        title={editingId ? '编辑展商' : '添加展商'}
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="companyName" label="公司名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="companyCode" label="公司编码" rules={[{ required: true }]}>
            <Input disabled={!!editingId} />
          </Form.Item>
          <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactEmail" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="审核展商"
        open={auditModalVisible}
        onCancel={() => setAuditModalVisible(false)}
        footer={null}
      >
        <Form form={auditForm} layout="vertical" onFinish={handleAuditSubmit}>
          <Form.Item name="status" label="审核结果" rules={[{ required: true }]}>
            <Select>
              <Option value="approved">通过</Option>
              <Option value="rejected">驳回</Option>
            </Select>
          </Form.Item>
          <Form.Item name="rejectReason" label="驳回原因">
            <Input.TextArea rows={3} placeholder="请输入驳回原因" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>提交</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="展商详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentItem && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="公司名称">{currentItem.company_name}</Descriptions.Item>
            <Descriptions.Item label="公司编码">{currentItem.company_code}</Descriptions.Item>
            <Descriptions.Item label="联系人">{currentItem.contact_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentItem.contact_phone}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{currentItem.contact_email || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址">{currentItem.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(currentItem.status)}</Descriptions.Item>
            {currentItem.reject_reason && (
              <Descriptions.Item label="驳回原因">{currentItem.reject_reason}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default ExhibitorList;
