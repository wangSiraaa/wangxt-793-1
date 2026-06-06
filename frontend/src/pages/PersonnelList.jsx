import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  message,
  Space,
  Tag,
  Drawer,
  Descriptions,
  Image,
  InputNumber,
  Popconfirm,
  Card
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { personnelApi, exhibitorApi } from '../utils/api';

const { Option } = Select;

const PersonnelList = () => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exhibitors, setExhibitors] = useState([]);
  const [selectedExhibitor, setSelectedExhibitor] = useState(null);
  
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [currentPersonnel, setCurrentPersonnel] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [withdrawForm] = Form.useForm();
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadExhibitors();
  }, []);

  useEffect(() => {
    if (selectedExhibitor) {
      loadList();
    }
  }, [page, pageSize, selectedExhibitor]);

  const loadExhibitors = async () => {
    try {
      const res = await exhibitorApi.list({ pageSize: 100 });
      setExhibitors(res.list);
      if (res.list.length > 0) {
        setSelectedExhibitor(res.list[0].id);
      }
    } catch (err) {
      message.error('加载展商列表失败');
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await personnelApi.list({
        exhibitorId: selectedExhibitor,
        page,
        pageSize
      });
      setList(res.list);
      setTotal(res.total);
    } catch (err) {
      message.error('加载人员列表失败');
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
      name: record.name,
      idCard: record.id_card,
      phone: record.phone,
      gender: record.gender,
      position: record.position,
      credentialType: record.credential_type
    });
    setAddModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingId) {
        await personnelApi.update(editingId, values);
        message.success('修改成功');
      } else {
        await personnelApi.create({
          ...values,
          exhibitorId: selectedExhibitor
        });
        message.success('添加成功');
      }
      setAddModalVisible(false);
      loadList();
    } catch (err) {
      message.error(err.error || '操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await personnelApi.delete(id);
      message.success('删除成功');
      loadList();
    } catch (err) {
      message.error(err.error || '删除失败');
    }
  };

  const handleViewDetail = (record) => {
    setCurrentPersonnel(record);
    setDetailVisible(true);
  };

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('exhibitorId', selectedExhibitor);

    try {
      const result = await personnelApi.import(formData);
      setImportResult(result);
      message.success(`导入完成：成功${result.success}条，冲突${result.conflict}条，失败${result.failed}条`);
      loadList();
    } catch (err) {
      message.error('导入失败');
    }
    return false;
  };

  const handleLost = async (record) => {
    try {
      await personnelApi.lost(record.id);
      message.success('挂失成功');
      loadList();
    } catch (err) {
      message.error(err.error || '挂失失败');
    }
  };

  const handleWithdraw = (record) => {
    setCurrentPersonnel(record);
    withdrawForm.resetFields();
    setWithdrawModalVisible(true);
  };

  const handleWithdrawSubmit = async (values) => {
    try {
      await personnelApi.withdraw(currentPersonnel.id, values);
      message.success('撤回成功，资料已重置为待审核状态');
      setWithdrawModalVisible(false);
      loadList();
    } catch (err) {
      message.error(err.error || '撤回失败');
    }
  };

  const handleResubmit = async (record) => {
    try {
      await personnelApi.resubmit(record.id);
      message.success('资料已重新提交，等待审核');
      loadList();
    } catch (err) {
      message.error(err.error || '提交失败');
    }
  };

  const getWithdrawStatusTag = (status) => {
    const statusMap = {
      none: { color: 'default', text: '正常' },
      withdrawn: { color: 'orange', text: '已撤回' },
      resubmitted: { color: 'blue', text: '已重提' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
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

  const getCredentialTag = (status) => {
    const statusMap = {
      draft: { color: 'default', text: '草稿' },
      printed: { color: 'blue', text: '已制证' },
      issued: { color: 'green', text: '已发证' },
      lost: { color: 'red', text: '已挂失' },
      cancelled: { color: 'gray', text: '已注销' }
    };
    const s = statusMap[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '身份证号', dataIndex: 'id_card', key: 'id_card', width: 180 },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '职位', dataIndex: 'position', key: 'position', width: 100 },
    { 
      title: '证件类型', 
      dataIndex: 'credential_type', 
      key: 'credential_type', 
      width: 100,
      render: (type) => {
        const typeMap = { exhibitor: '展商证', worker: '工作人员证', vip: 'VIP证', media: '媒体证' };
        return typeMap[type] || type;
      }
    },
    { title: '照片状态', dataIndex: 'photo_status', key: 'photo_status', width: 100, render: getStatusTag },
    { title: '审核状态', dataIndex: 'audit_status', key: 'audit_status', width: 100, render: getStatusTag },
    { title: '证件状态', dataIndex: 'credential_status', key: 'credential_status', width: 100, render: getCredentialTag },
    { title: '撤回状态', dataIndex: 'withdraw_status', key: 'withdraw_status', width: 100, render: getWithdrawStatusTag },
    { 
      title: '撤回次数', 
      dataIndex: 'withdraw_count', 
      key: 'withdraw_count', 
      width: 80,
      render: (count) => count > 0 ? <Tag color="orange">{count}次</Tag> : null
    },
    { 
      title: '导入冲突', 
      dataIndex: 'import_conflict', 
      key: 'import_conflict', 
      width: 100,
      render: (val, record) => val === 1 ? <Tag color="orange" icon={<ExclamationCircleOutlined />}>冲突</Tag> : null
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          {(record.is_locked !== 1 || record.withdraw_status === 'withdrawn') && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
            </>
          )}
          {record.is_locked !== 1 && record.withdraw_status !== 'withdrawn' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
          {record.withdraw_status === 'withdrawn' && (
            <Popconfirm title="确定重新提交该资料？" onConfirm={() => handleResubmit(record)}>
              <Button type="link" size="small" type="primary">重新提交</Button>
            </Popconfirm>
          )}
          {record.is_locked !== 1 && record.withdraw_status !== 'withdrawn' && 
           (record.audit_status !== 'pending' || record.photo_status !== 'pending') && (
            <Button type="link" size="small" onClick={() => handleWithdraw(record)}>撤回重办</Button>
          )}
          {['printed', 'issued'].includes(record.credential_status) && (
            <Popconfirm title="确定挂失该证件？" onConfirm={() => handleLost(record)}>
              <Button type="link" size="small" danger>挂失</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2 className="page-title">人员管理</h2>
      
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            style={{ width: 250 }}
            placeholder="选择展商"
            value={selectedExhibitor}
            onChange={setSelectedExhibitor}
          >
            {exhibitors.map(e => (
              <Option key={e.id} value={e.id}>{e.company_name} ({e.company_code})</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectedExhibitor}>
            添加人员
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)} disabled={!selectedExhibitor}>
            导入Excel
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
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑人员' : '添加人员'}
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input disabled={currentPersonnel?.is_locked === 1} />
          </Form.Item>
          <Form.Item name="idCard" label="身份证号" rules={[{ required: true, message: '请输入身份证号' }]}>
            <Input disabled={currentPersonnel?.is_locked === 1} />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Select>
              <Option value="male">男</Option>
              <Option value="female">女</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input />
          </Form.Item>
          <Form.Item name="credentialType" label="证件类型" initialValue="exhibitor">
            <Select>
              <Option value="exhibitor">展商证</Option>
              <Option value="worker">工作人员证</Option>
              <Option value="vip">VIP证</Option>
              <Option value="media">媒体证</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>保存</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入人员名单"
        open={importModalVisible}
        onCancel={() => { setImportModalVisible(false); setImportResult(null); }}
        footer={null}
      >
        <p style={{ marginBottom: 16 }}>请上传Excel文件，需包含：姓名、身份证号、手机号、性别、职位、证件类型等列</p>
        <Upload.Dragger
          beforeUpload={handleImport}
          maxCount={1}
          accept=".xlsx,.xls"
        >
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        </Upload.Dragger>

        {importResult && (
          <div className="import-result">
            <h4>导入结果</h4>
            <p>总计: {importResult.total} 条</p>
            <p>成功: <Tag color="green">{importResult.success}</Tag> 条</p>
            <p>冲突: <Tag color="orange">{importResult.conflict}</Tag> 条</p>
            <p>失败: <Tag color="red">{importResult.failed}</Tag> 条</p>
            
            {importResult.conflicts && importResult.conflicts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h5>冲突记录：</h5>
                {importResult.conflicts.map((c, idx) => (
                  <div key={idx} className="conflict-item">
                    {c.note}
                  </div>
                ))}
              </div>
            )}
            
            {importResult.errors && importResult.errors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h5>错误记录：</h5>
                {importResult.errors.map((e, idx) => (
                  <div key={idx} className="conflict-item" style={{ background: '#fff1f0', borderLeftColor: '#ff4d4f' }}>
                    {e.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="撤回重办"
        open={withdrawModalVisible}
        onCancel={() => setWithdrawModalVisible(false)}
        footer={null}
      >
        <p style={{ marginBottom: 16 }}>
          撤回后资料将重置为待审核状态，可重新编辑后再次提交。
        </p>
        {currentPersonnel && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <p><strong>姓名：</strong>{currentPersonnel.name}</p>
            <p><strong>身份证号：</strong>{currentPersonnel.id_card}</p>
            <p><strong>当前照片状态：</strong>{getStatusTag(currentPersonnel.photo_status)}</p>
            <p><strong>当前审核状态：</strong>{getStatusTag(currentPersonnel.audit_status)}</p>
          </div>
        )}
        <Form form={withdrawForm} layout="vertical" onFinish={handleWithdrawSubmit}>
          <Form.Item name="reason" label="撤回原因" rules={[{ required: true, message: '请填写撤回原因' }]}>
            <Input.TextArea rows={3} placeholder="请填写撤回原因，如：资料有误需修改、照片需重新上传等" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>确认撤回</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="人员详情"
        width={600}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {currentPersonnel && (
          <>
            {currentPersonnel.photo_path && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Image
                  width={200}
                  height={240}
                  src={currentPersonnel.photo_path}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
            <Descriptions bordered column={1}>
              <Descriptions.Item label="姓名">{currentPersonnel.name}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{currentPersonnel.id_card}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentPersonnel.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="性别">
                {{ male: '男', female: '女', other: '其他' }[currentPersonnel.gender] || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="职位">{currentPersonnel.position || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属公司">{currentPersonnel.company_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="证件类型">
                {{ exhibitor: '展商证', worker: '工作人员证', vip: 'VIP证', media: '媒体证' }[currentPersonnel.credential_type] || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="照片状态">{getStatusTag(currentPersonnel.photo_status)}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{getStatusTag(currentPersonnel.audit_status)}</Descriptions.Item>
              <Descriptions.Item label="证件状态">{getCredentialTag(currentPersonnel.credential_status)}</Descriptions.Item>
              <Descriptions.Item label="撤回状态">{getWithdrawStatusTag(currentPersonnel.withdraw_status)}</Descriptions.Item>
              {currentPersonnel.withdraw_count > 0 && (
                <Descriptions.Item label="撤回次数">{currentPersonnel.withdraw_count} 次</Descriptions.Item>
              )}
              {currentPersonnel.withdraw_reason && (
                <Descriptions.Item label="撤回原因">{currentPersonnel.withdraw_reason}</Descriptions.Item>
              )}
              {currentPersonnel.photo_reject_reason && (
                <Descriptions.Item label="照片驳回原因">{currentPersonnel.photo_reject_reason}</Descriptions.Item>
              )}
              {currentPersonnel.audit_reject_reason && (
                <Descriptions.Item label="审核驳回原因">{currentPersonnel.audit_reject_reason}</Descriptions.Item>
              )}
              {currentPersonnel.conflict_note && (
                <Descriptions.Item label="冲突备注"><Tag color="orange">{currentPersonnel.conflict_note}</Tag></Descriptions.Item>
              )}
              <Descriptions.Item label="是否锁定">{currentPersonnel.is_locked === 1 ? '是（已制证）' : '否'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default PersonnelList;
