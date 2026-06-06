import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Tag,
  Card,
  Drawer,
  Descriptions,
  Checkbox,
  Select,
  Image
} from 'antd';
import { PlusOutlined, PrinterOutlined, CheckOutlined, EyeOutlined } from '@ant-design/icons';
import { batchApi, personnelApi } from '../utils/api';

const { Option } = Select;

const BatchList = () => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [availablePersonnel, setAvailablePersonnel] = useState([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadList();
    loadAvailablePersonnel();
  }, [page, pageSize]);

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await batchApi.list({ page, pageSize });
      setList(res.list);
      setTotal(res.total);
    } catch (err) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePersonnel = async () => {
    try {
      const res = await personnelApi.list({
        auditStatus: 'approved',
        photoStatus: 'approved',
        credentialStatus: 'draft',
        pageSize: 100
      });
      setAvailablePersonnel(res.list);
    } catch (err) {
      console.error('加载可制证人员失败:', err);
    }
  };

  const handleAdd = () => {
    setSelectedPersonnel([]);
    form.resetFields();
    setAddModalVisible(true);
  };

  const handleViewDetail = async (record) => {
    try {
      const detail = await batchApi.detail(record.id);
      setCurrentItem(detail);
      setDetailVisible(true);
    } catch (err) {
      message.error('加载详情失败');
    }
  };

  const handleSave = async (values) => {
    try {
      await batchApi.create({
        ...values,
        personnelIds: selectedPersonnel
      });
      message.success('批次创建成功');
      setAddModalVisible(false);
      loadList();
      loadAvailablePersonnel();
    } catch (err) {
      message.error(err.error || '创建失败');
    }
  };

  const handleComplete = async (record) => {
    try {
      await batchApi.complete(record.id);
      message.success('批次已完成');
      loadList();
    } catch (err) {
      message.error(err.error || '操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待制证' },
      printing: { color: 'blue', text: '制证中' },
      completed: { color: 'green', text: '已完成' },
      cancelled: { color: 'red', text: '已取消' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const getCredentialTag = (status) => {
    const statusMap = {
      draft: { color: 'default', text: '草稿' },
      printed: { color: 'blue', text: '已制证' },
      issued: { color: 'green', text: '已发证' },
      lost: { color: 'red', text: '已挂失' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no', width: 200 },
    { title: '批次名称', dataIndex: 'batch_name', key: 'batch_name' },
    { title: '总数', dataIndex: 'total_count', key: 'total_count', width: 80 },
    { title: '已制证', dataIndex: 'printed_count', key: 'printed_count', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: getStatusTag },
    { title: '创建人', dataIndex: 'creator_name', key: 'creator_name', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          {record.status !== 'completed' && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleComplete(record)}>完成</Button>
          )}
        </Space>
      )
    }
  ];

  const personnelColumns = [
    { 
      title: '照片', 
      dataIndex: 'photo_path', 
      key: 'photo_path', 
      width: 60,
      render: (photo) => photo ? (
        <Image width={40} height={48} src={photo} style={{ objectFit: 'cover', borderRadius: 2 }} />
      ) : '-'
    },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '身份证号', dataIndex: 'id_card', key: 'id_card', width: 160 },
    { title: '公司', dataIndex: 'company_name', key: 'company_name' },
    { title: '证件状态', dataIndex: 'credential_status', key: 'credential_status', width: 100, render: getCredentialTag }
  ];

  return (
    <div>
      <h2 className="page-title">制证批次</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            创建批次
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
        title="创建制证批次"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="batchName" label="批次名称" rules={[{ required: true }]}>
            <Input placeholder="如：第一批制证" />
          </Form.Item>
          
          <Form.Item label="选择制证人员">
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
              <Checkbox
                indeterminate={selectedPersonnel.length > 0 && selectedPersonnel.length < availablePersonnel.length}
                checked={selectedPersonnel.length === availablePersonnel.length && availablePersonnel.length > 0}
                onChange={(e) => {
                  setSelectedPersonnel(e.target.checked ? availablePersonnel.map(p => p.id) : []);
                }}
              >
                全选（{availablePersonnel.length} 人待制证）
              </Checkbox>
              <Checkbox.Group
                value={selectedPersonnel}
                onChange={setSelectedPersonnel}
                style={{ width: '100%' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {availablePersonnel.map(p => (
                    <Checkbox key={p.id} value={p.id}>
                      {p.name} - {p.id_card} - {p.company_name || '未知公司'}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </div>
          </Form.Item>
          
          <p style={{ color: '#666', marginBottom: 16 }}>
            已选择 {selectedPersonnel.length} 人
          </p>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<PrinterOutlined />}>
              创建批次并制证
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="批次详情"
        width={800}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentItem && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="批次号">{currentItem.batch_no}</Descriptions.Item>
              <Descriptions.Item label="批次名称">{currentItem.batch_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="总数">{currentItem.total_count}</Descriptions.Item>
              <Descriptions.Item label="已制证">{currentItem.printed_count}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(currentItem.status)}</Descriptions.Item>
              <Descriptions.Item label="创建人">{currentItem.creator_name || '-'}</Descriptions.Item>
            </Descriptions>
            
            <h4 style={{ marginBottom: 12 }}>批次人员</h4>
            <Table
              dataSource={currentItem.personnel || []}
              columns={personnelColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default BatchList;
