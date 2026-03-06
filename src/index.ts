import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ message: '🧠 Servicio de Inventario (Módulo 3) operando al 100%' });
});

app.listen(PORT, () => {
  console.log(`🧊 Servicio de Inventario corriendo en http://localhost:${PORT}`);
});