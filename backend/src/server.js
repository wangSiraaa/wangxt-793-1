const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

const authRoutes = require('./routes/auth');
const exhibitorRoutes = require('./routes/exhibitor');
const personnelRoutes = require('./routes/personnel');
const batchRoutes = require('./routes/batch');
const verifyRoutes = require('./routes/verify');

app.use('/api/auth', authRoutes);
app.use('/api/exhibitors', exhibitorRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/verify', verifyRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '展会展商证件办理系统运行正常' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;
