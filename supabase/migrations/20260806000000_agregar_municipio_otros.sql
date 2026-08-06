INSERT INTO municipios (nombre, provincia)
SELECT 'Otros', 'Corrientes'
WHERE NOT EXISTS (
    SELECT 1 FROM municipios WHERE nombre = 'Otros'
);
