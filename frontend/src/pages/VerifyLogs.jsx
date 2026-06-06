import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Tag, Space, DatePicker, Select, Input, Image } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { verifyApi } from '../utils/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const VerifyLogs = () => {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [filters, setFilters] = useState({
    keyword: '',
    result: '',
    dateRange: null
  });

  useEffect(() => {
    loadList();
  }, [page, pageSize]);

  const loadList = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize, ...filters };
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      const res = await verifyApi.logs(params);
      setList(res.list);
      setTotal(res.total);
    } catch (err) {
      console.error('加载日志失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getResultTag = (result) => {
    const map = {
      success: { color: 'green', text: '通过' },
      failed: { color: 'red', text: '失败' },
      pending: { color: 'orange', text: '待处理' }
    };
    const r = map[result] || { color: 'default', text: result };
    return <Tag color={r.color}>{r.text}</Tag>;
  };

  const columns = [
    { 
      title: 'ID', 
      dataIndex: 'id', 
      key: 'id', 
      width: 100 
    },
    { 
      title: '证件ID', 
      dataIndex: 'credential_id', 
      key: 'credential_id', 
      width: 200 
    },
    { 
      title: '姓名', 
      dataIndex: 'personnel_name', 
      key: 'personnel_name', 
      width: 100 
    },
    { 
      title: '核验结果', 
      dataIndex: 'verify_result', 
      key: 'verify_result', 
      width: 100,
      render: getResultTag
    },
    { 
      title: '原因/说明', 
      dataIndex: 'verify_note', 
      key: 'verify_note',
      ellipsis: true
    },
    { 
      title: '核验位置', 
      dataIndex: 'verify_location', 
      key: 'verify_location', 
      width: 120 
    },
    { 
      title: '核验人', 
      dataIndex: 'operator_name', 
      key: 'operator_name', 
      width: 100 
    },
    { 
      title: '核验时间', 
      dataIndex: 'created_at', 
      key: 'created_at', 
      width: 160 
    }
  ];

  return (
    <div>
      <h2 className="page-title">核验日志</h2>
      
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索证件ID/姓名"
            style={{ width: 200 }}
            onSearch={(value) => {
              setFilters(prev => ({ ...prev, keyword: value }));
              setPage(1);
              setTimeout(loadList, 0);
            }}
            allowClear
          />
          <Select
            placeholder="核验结果"
            style={{ width: 120 }}
            allowClear
            onChange={(value) => {
              setFilters(prev => ({ ...prev, result: value }));
              setPage(1);
              setTimeout(loadList, 0);
            }}
          >
            <Option value="success">通过</Option>
            <Option value="failed">失败</Option>
          </Select>
          <RangePicker
            onChange={(dates) => {
              setFilters(prev => ({ ...prev, dateRange: dates }));
              setPage(1);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={loadList}>刷新</Button>
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
    </div>
  );
};

export default VerifyLogs;
