-- Limpar catálogo existente (Tome cuidado se houver produtos reais que deseja manter)
DELETE FROM products;

-- 45 PEÇAS PREMIUM "WOW EFFECT" - VENUS ENGINE
INSERT INTO products (name, category, primary_color, style, type, price_range, image_url, external_url) VALUES 
-- ALFAIATARIA & BLAZERS (ROUPA)
('Blazer Double-Breasted Wool', 'Blazer', 'Preto', 'Elegante', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1596783049182-38662ce2534f?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/b01'),
('Blazer de Linho Estruturado', 'Blazer', 'Bege', 'Minimalista', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/b02'),
('Blazer Spencer de Seda', 'Blazer', 'Vinho', 'Sensual Refinado', 'roupa', 'Premium', 'https://plus.unsplash.com/premium_photo-1669704098750-7cd22c35ba9a?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/b03'),
('Capa Alfaiataria Monocromática', 'Blazer', 'Off-White', 'Elegante', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1589465885857-44edb59bbff2?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/b04'),

-- CAMISAS (ROUPA)
('Camisa de Seda Pura Ponto Ajour', 'Camisa', 'Branco', 'Clássico', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1598032895397-b9472444bf93?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/c01'),
('Camisa Gola Laço Fluida', 'Camisa', 'Preto', 'Romântico Moderno', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/c02'),
('Camisa Oversized Estruturada', 'Camisa', 'Azul Marinho', 'Moderno', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1604644401890-0bd678c83788?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/c03'),
('Regata de Modal Gola Alta', 'Camisa', 'Verde Sofisticado', 'Minimalista', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/c04'),

-- CALÇAS (ROUPA)
('Calça Pantalona Alfaiataria', 'Calça', 'Preto', 'Elegante', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1594633312681-425c7ccA5d?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/p01'),
('Calça Flare Cintura Alta', 'Calça', 'Off-White', 'Clássico', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/p02'),
('Calça Slouchy de Couro', 'Calça', 'Vinho', 'Sensual Refinado', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1594633313593-cb40da00dcA4?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/p03'),
('Calça Reta de Lã Fria', 'Calça', 'Azul Marinho', 'Elegante', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1495121605156-91e8601c0a6b?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/p04'),

-- VESTIDOS & SAIAS (ROUPA)
('Vestido Midi Drapeado', 'Vestido', 'Vinho', 'Sensual Refinado', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1566207274740-0f8aa6268800?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/v01'),
('Vestido Chemise de Linho', 'Vestido', 'Bege', 'Minimalista', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1601288496920-b6154fe3626a?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/v02'),
('Vestido Tubinho Estruturado', 'Vestido', 'Preto', 'Elegante', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1572804013309-8c98e09f584e?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/v03'),
('Saia Lápis de Alfaiataria', 'Saia', 'Preto', 'Elegante', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1583496661160-c5a4d4678125?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/s01'),
('Saia Plissada Metálica', 'Saia', 'Prateado', 'Moderno', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1582142306909-195724d33ffc?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/s02'),
('Saia Midi Evase Texturizada', 'Saia', 'Off-White', 'Clássico', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/s03'),

-- BOLSAS (ACESSÓRIO)
('Bolsa Tiracolo Minimalista Couro', 'Bolsa', 'Preto', 'Minimalista', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a01'),
('Maxi Tote Estruturada', 'Bolsa', 'Bege', 'Elegante', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a02'),
('Bolsa Clutch Geométrica', 'Bolsa', 'Dourado', 'Sensual Refinado', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a03'),
('Bolsa Hobo de Suede', 'Bolsa', 'Vinho', 'Moderno', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a04'),

-- RELÓGIOS (ACESSÓRIO)
('Relógio Mesh Classique Dourado', 'Relogio', 'Dourado', 'Elegante', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a05'),
('Relógio Analógico Fundo Negro', 'Relogio', 'Prata', 'Minimalista', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a06'),
('Relógio Retangular Vintage', 'Relogio', 'Dourado', 'Clássico', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1434056886845-dac89ffe9b56?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a07'),

-- ÓCULOS (ACESSÓRIO)
('Óculos Cat Eye Acrícilico', 'Oculos', 'Preto', 'Sensual Refinado', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a08'),
('Óculos Geométrico Hex', 'Oculos', 'Dourado', 'Moderno', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1473496169904-658ba37448eb?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a09'),
('Óculos Aviador Minimalista', 'Oculos', 'Prata', 'Elegante', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a10'),

-- COLARES & BRINCOS (ACESSÓRIO)
('Corrente Elos Groumet', 'Colar', 'Dourado', 'Elegante', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1599643478514-4a1101142b78?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a11'),
('Colar Ponto de Luz Safira', 'Colar', 'Prata', 'Minimalista', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a12'),
('Brinco Argola Tubular', 'Brinco', 'Dourado', 'Clássico', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a13'),
('Brinco Ear Cuff Cascata', 'Brinco', 'Prata', 'Moderno', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a14'),

-- CINTOS (ACESSÓRIO)
('Cinto em Couro Fivela Dourada', 'Cinto', 'Preto', 'Elegante', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1628148906969-9e8cce505bdf?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a15'),
('Cinto Fino Texturizado Python', 'Cinto', 'Bege', 'Sensual Refinado', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1553655110-d0fb02fe9cf6?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a16'),
('Cinto Corset Obí', 'Cinto', 'Vinho', 'Moderno', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/a17'),

-- EXPANSÃO DE CATALOGO: EXTRAS ELEGANTES
('Blazer Cropped Linho', 'Blazer', 'Branco', 'Moderno', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1596783049182-38662ce2534f?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/bx1'),
('Pantalona Fluida Risca de Giz', 'Calça', 'Cinza', 'Elegante', 'roupa', 'Médio', 'https://images.unsplash.com/photo-1594633312681-425c7ccA5d?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/cx1'),
('Cardigan de Cashmere Alongado', 'Casaco', 'Bege', 'Conforto', 'roupa', 'Premium', 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/cx2'),
('Scarpin Salto Bloco Couro', 'Sapato', 'Preto', 'Elegante', 'acessorio', 'Médio', 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/sx1'),
('Bota Chelsea Urban', 'Sapato', 'Vinho', 'Moderno', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/sx2'),
('Anel Solitário Cristal Rígido', 'Anel', 'Prata', 'Minimalista', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1605100804763-247f67b2548e?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/ax1'),
('Gargantilha Aro Sólido', 'Colar', 'Dourado', 'Sensual Refinado', 'acessorio', 'Premium', 'https://images.unsplash.com/photo-1599643478514-4a1101142b78?auto=format&fit=crop&q=80&w=600&h=800', 'https://shop.venus.com/ax2');
