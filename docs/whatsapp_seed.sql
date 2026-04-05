-- Seed data for WhatsApp Module
INSERT INTO whatsapp_conversations (id, org_slug, status, priority, last_message, unread_count, user_name, user_phone, user_context) VALUES
('00000000-0000-0000-0000-000000000001', 'demo', 'human_required', 'high', 'Faz sentido esse blazer no meu perfil?', 3, 'Arthur Rezende', '+55 11 99999-0001', '{"styleIdentity": "Minimalismo de Elite", "intentScore": 82, "viewedProducts": ["Blazer Estruturado", "Oxford Noir"], "lastLookId": "1", "tryOnCount": 4}'),
('00000000-0000-0000-0000-000000000002', 'demo', 'ai_active', 'medium', 'Gostei da paleta sugerida.', 0, 'Carlos Eduardo', '+55 21 98888-7777', '{"styleIdentity": "Modern Authority", "intentScore": 54, "viewedProducts": ["Turtleneck Cashmere"], "lastLookId": "2", "tryOnCount": 1}');

INSERT INTO whatsapp_messages (conversation_id, org_slug, sender, text, created_at, type) VALUES
('00000000-0000-0000-0000-000000000001', 'demo', 'user', 'Ola! Vi os looks sugeridos pelo Venus.', NOW() - INTERVAL '60 minutes', 'text'),
('00000000-0000-0000-0000-000000000001', 'demo', 'ai', 'Ola, Arthur. Que prazer falar com voce. O ''Arquiteto do Amanha'' foi selecionado justamente para sua meta de projetar autoridade inabalavel. O que achou do ajuste estrutural dos ombros no seu Try-On?', NOW() - INTERVAL '30 minutes', 'text'),
('00000000-0000-0000-0000-000000000001', 'demo', 'user', 'Gostei muito, mas tenho uma duvida sobre o tecido. Ele amassa facil?', NOW() - INTERVAL '10 minutes', 'text'),
('00000000-0000-0000-0000-000000000001', 'demo', 'ai', 'Entendo sua preocupacao, Arthur. Utilizamos La Fria 150s, que possui uma memoria de fibra excepcional, perfeita para manter o vinco impecavel mesmo em viagens. Mas, quer ver um detalhe da trama em alta definicao?', NOW() - INTERVAL '5 minutes', 'text'),
('00000000-0000-0000-0000-000000000001', 'demo', 'user', 'Faz sentido esse blazer no meu perfil? Quero fechar agora.', NOW() - INTERVAL '1 minute', 'text'),

('00000000-0000-0000-0000-000000000002', 'demo', 'user', 'Interessante a analise de visagismo.', NOW() - INTERVAL '120 minutes', 'text'),
('00000000-0000-0000-0000-000000000002', 'demo', 'ai', 'Fico feliz que tenha notado, Carlos. Como sua face tem linhas mais angulares, a gola alta do Turtleneck Cashmere cria uma verticalidade que suaviza e ao mesmo tempo impõe respeito. O que achou da paleta Sombra Contemporanea?', NOW() - INTERVAL '116 minutes', 'text'),
('00000000-0000-0000-0000-000000000002', 'demo', 'user', 'Gostei da paleta sugerida.', NOW() - INTERVAL '60 minutes', 'text');
