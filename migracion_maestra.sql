-- =========================================================================
-- FASE 1: ALTERACIÓN DE TABLAS (SIN PÉRDIDA DE DATOS)
-- =========================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendiente';

-- Restricciones CHECK
ALTER TABLE users ADD CONSTRAINT chk_weekly_budget CHECK (weekly_budget >= 0);
ALTER TABLE ingredients ADD CONSTRAINT chk_unit_price CHECK (unit_price >= 0);
ALTER TABLE inventory ADD CONSTRAINT chk_current_quantity CHECK (current_quantity >= 0);
ALTER TABLE recipe_ingredients ADD CONSTRAINT chk_required_quantity CHECK (required_quantity > 0);
ALTER TABLE shopping_list_items ADD CONSTRAINT chk_target_quantity CHECK (target_quantity > 0);
ALTER TABLE shopping_list_items ADD CONSTRAINT chk_total_price CHECK (total_price >= 0);
ALTER TABLE purchase_history ADD CONSTRAINT chk_total_cost CHECK (total_cost >= 0);
ALTER TABLE shopping_lists ADD CONSTRAINT chk_status CHECK (status IN ('pendiente', 'comprada', 'cancelada'));


-- =========================================================================
-- FASE 2: OBJETOS DE BASE DE DATOS (RÚBRICA PUNTO 4)
-- =========================================================================

-- A. TRIGGERS
CREATE OR REPLACE FUNCTION fn_audit_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_audit_updated_at();

DROP TRIGGER IF EXISTS trg_ingredients_updated_at ON ingredients;
CREATE TRIGGER trg_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION fn_audit_updated_at();

DROP TRIGGER IF EXISTS trg_recipes_updated_at ON recipes;
CREATE TRIGGER trg_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION fn_audit_updated_at();

DROP TRIGGER IF EXISTS trg_shopping_lists_updated_at ON shopping_lists;
CREATE TRIGGER trg_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists FOR EACH ROW EXECUTE FUNCTION fn_audit_updated_at();

CREATE OR REPLACE FUNCTION calculate_shopping_item_price() RETURNS TRIGGER AS $$
DECLARE ing_price DECIMAL(10,4);
BEGIN
    SELECT unit_price INTO ing_price FROM ingredients WHERE id = NEW.ingredient_id;
    IF ing_price IS NULL THEN ing_price := 0; END IF;
    NEW.total_price := NEW.target_quantity * ing_price; RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_shopping_item_price ON shopping_list_items;
CREATE TRIGGER trg_calculate_shopping_item_price BEFORE INSERT OR UPDATE ON shopping_list_items FOR EACH ROW EXECUTE FUNCTION calculate_shopping_item_price();

CREATE OR REPLACE FUNCTION clean_empty_inventory() RETURNS TRIGGER AS $$
BEGIN IF NEW.current_quantity <= 0 THEN DELETE FROM inventory WHERE id = NEW.id; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clean_empty_inventory ON inventory;
CREATE TRIGGER trg_clean_empty_inventory AFTER UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION clean_empty_inventory();


-- B. FUNCIONES
CREATE OR REPLACE FUNCTION fn_total_gastado(p_user_id UUID) RETURNS DECIMAL AS $$
DECLARE v_total DECIMAL(10,2);
BEGIN SELECT COALESCE(SUM(total_cost), 0) INTO v_total FROM purchase_history WHERE user_id = p_user_id; RETURN v_total; END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_obtener_refri_usuario(p_user_id UUID) RETURNS TABLE (ingrediente VARCHAR, cantidad DECIMAL, unidad VARCHAR) AS $$
BEGIN RETURN QUERY SELECT i.name::VARCHAR, inv.current_quantity, i.unit_default::VARCHAR FROM inventory inv JOIN ingredients i ON inv.ingredient_id = i.id WHERE inv.user_id = p_user_id; END; $$ LANGUAGE plpgsql;

-- C. VISTAS
CREATE OR REPLACE VIEW vw_recetas_completas AS SELECT r.id, r.title, COALESCE(u.name, 'Sistema') AS autor, r.is_custom FROM recipes r LEFT JOIN users u ON r.author_id = u.id;

CREATE OR REPLACE VIEW vw_costo_recetas AS SELECT r.title, SUM(ri.required_quantity * i.unit_price) AS costo_estimado_total FROM recipes r JOIN recipe_ingredients ri ON r.id = ri.recipe_id JOIN ingredients i ON ri.ingredient_id = i.id GROUP BY r.title;

CREATE OR REPLACE VIEW vw_reporte_hipotesis AS
WITH GastosSemanales AS (SELECT user_id, DATE_TRUNC('week', purchased_at) AS semana, SUM(total_cost) AS gasto_semanal FROM purchase_history GROUP BY user_id, DATE_TRUNC('week', purchased_at)),
PromedioSemanal AS (SELECT user_id, AVG(gasto_semanal) AS promedio_gasto_semanal FROM GastosSemanales GROUP BY user_id)
SELECT u.id AS user_id, u.name, u.weekly_budget AS presupuesto_declarado, COALESCE(ps.promedio_gasto_semanal, 0) AS gasto_promedio_con_app, (u.weekly_budget - COALESCE(ps.promedio_gasto_semanal, 0)) AS ahorro_promedio_semanal, CASE WHEN u.weekly_budget > 0 AND ps.promedio_gasto_semanal IS NOT NULL THEN ROUND(((u.weekly_budget - ps.promedio_gasto_semanal) / u.weekly_budget) * 100, 2) ELSE 0 END AS porcentaje_ahorro_semanal FROM users u LEFT JOIN PromedioSemanal ps ON u.id = ps.user_id;

-- D. PROCEDIMIENTOS ALMACENADOS
CREATE OR REPLACE PROCEDURE sp_comprar_lista_segura(p_list_id INT, p_user_id UUID) LANGUAGE plpgsql AS $$
BEGIN UPDATE shopping_lists SET status = 'comprada', updated_at = CURRENT_TIMESTAMP WHERE id = p_list_id AND user_id = p_user_id; IF NOT FOUND THEN RAISE EXCEPTION 'Lista no encontrada o no autorizada.'; END IF; COMMIT; END; $$;

CREATE OR REPLACE PROCEDURE sp_limpiar_listas_canceladas() LANGUAGE plpgsql AS $$
DECLARE cur_listas CURSOR FOR SELECT id FROM shopping_lists WHERE status = 'cancelada'; v_id INT;
BEGIN OPEN cur_listas; LOOP FETCH cur_listas INTO v_id; EXIT WHEN NOT FOUND; DELETE FROM shopping_lists WHERE id = v_id; END LOOP; CLOSE cur_listas; END; $$;

CREATE OR REPLACE PROCEDURE sp_escalar_receta(p_recipe_id INT, p_multiplicador DECIMAL) LANGUAGE plpgsql AS $$
BEGIN IF p_multiplicador <= 0 THEN RAISE EXCEPTION 'El multiplicador debe ser mayor a cero.'; END IF; UPDATE recipe_ingredients SET required_quantity = required_quantity * p_multiplicador WHERE recipe_id = p_recipe_id; END; $$;


-- =========================================================================
-- FASE 3: DATOS SEMILLA (SEED SEGURA A PRUEBA DE ERRORES)
-- =========================================================================

INSERT INTO ingredients (name, category, unit_price, unit_default) VALUES
('Tomate', 'Verduras', 3.6000, 'unidad'), 
('Cebolla', 'Verduras', 2.0190, 'unidad'), 
('Ajo', 'Verduras', 1.2000, 'unidad'), 
('Limón', 'Verduras', 4.2000, 'unidad'), 
('Chile', 'Verduras', 0.6300, 'unidad'), 
('Papa', 'Verduras', 7.2000, 'unidad'), 
('Pechuga de Pollo', 'Proteínas', 0.1450, 'g'), 
('Huevo Blanco', 'Proteínas', 3.7620, 'unidad'), 
('Atún en lata', 'Proteínas', 31.2200, 'unidad'),
('Arroz Súper Extra', 'Cereales', 0.0380, 'g'), 
('Frijol Negro', 'Leguminosas', 0.0450, 'g'), 
('Pasta Espagueti', 'Cereales', 0.0460, 'g'), 
('Queso Oaxaca', 'Lácteos', 0.1600, 'g'), 
('Leche Entera', 'Lácteos', 0.0370, 'ml'), 
('Aceite Vegetal', 'Abarrotes', 0.0450, 'ml')
ON CONFLICT (name) DO UPDATE SET unit_price = EXCLUDED.unit_price, unit_default = EXCLUDED.unit_default;

INSERT INTO recipes (title, instructions) 
SELECT 'Huevos a la Mexicana', '1. Picar tomate, cebolla y chile. 2. Sofreír en aceite. 3. Agregar los huevos y revolver.'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Huevos a la Mexicana');

INSERT INTO recipes (title, instructions) 
SELECT 'Arroz con Pollo', '1. Hervir la pechuga. 2. Sofreír el arroz. 3. Cocer todo junto con caldo de pollo.'
WHERE NOT EXISTS (SELECT 1 FROM recipes WHERE title = 'Arroz con Pollo');