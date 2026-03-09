import dotenv from 'dotenv';
dotenv.config();
import cors from 'cors';
import express from 'express';
import inventoryRoutes from './routes/inventoryRoutes';
import shoppingListRoutes from './routes/shoppingListRoutes';


const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shopping-lists', shoppingListRoutes);

app.get('/api/health', (req, res) => {
  res.json({ message: '🧠 Servicio de Inventario (Módulo 3) operando al 100%' });
});

app.listen(PORT as number, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});