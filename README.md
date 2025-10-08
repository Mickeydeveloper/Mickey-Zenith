import React, { useState } from 'react';

const 水费机器人 = () => {
  const [表号, 设置表号] = useState('');
  const [读数, 设置读数] = useState('');
  const [账单, 设置账单] = useState(null);

  const 提交处理 = (事件) => {
    事件.preventDefault();
    const 计算账单 = parseFloat(读数) * 1.25;
    设置账单(`表号 ${表号} 的预计水费为：TZS ${计算账单.toFixed(2)}`);
  };

  return (
    <div style={样式.容器}>
      <h1 style={样式.标题}>💧 水费机器人</h1>
      <form onSubmit={提交处理} style={样式.表单}>
        <label style={样式.标签}>表号：</label>
        <input
          type="text"
          value={表号}
          onChange={(e) => 设置表号(e.target.value)}
          style={样式.输入框}
          required
        />

        <label style={样式.标签}>当前读数：</label>
        <input
          type="number"
          value={读数}
          onChange={(e) => 设置读数(e.target.value)}
          style={样式.输入框}
          required
        />

        <button type="submit" style={样式.按钮}>生成账单</button>
      </form>

      {账单 && <p style={样式.结果}>{账单}</p>}
    </div>
  );
};

const 样式 = {
  容器: {
    maxWidth: '500px',
    margin: 'auto',
    padding: '2rem',
    background: '#f9f9f9',
    borderRadius: '10px',
    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif',
  },
  标题: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    color: '#007bff',
  },
  表单: {
    display: 'flex',
    flexDirection: 'column',
  },
  标签: {
    marginBottom: '0.5rem',
    fontWeight: 'bold',
  },
  输入框: {
    padding: '0.5rem',
    marginBottom: '1rem',
    borderRadius: '5px',
    border: '1px solid #ccc',
  },
  按钮: {
    padding: '0.7rem',
    background
