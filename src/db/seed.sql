INSERT INTO drivers (telegram_id, name, phone, vehicle_type, seats, vehicle_number, status, location, location_updated_at, location_share_started_at, is_approved, is_enabled, referral_code) VALUES
  (1000000001, 'Sunil Perera',      '+94771000001', 'car', 4, 'BW-SP-101', 'available', ST_MakePoint(8.2030, 48.8578)::geography, NOW(), NOW(), true,  true,  'aaaa0001'),
  (1000000002, 'Kasun Silva',       '+94771000002', 'tuk', 3, 'BW-KS-202', 'available', ST_MakePoint(8.2100, 48.8610)::geography, NOW(), NOW(), true,  true,  'aaaa0002'),
  (1000000003, 'Priya Fernando',    '+94771000003', 'van', 8, 'BW-PF-303', 'available', ST_MakePoint(8.2200, 48.8650)::geography, NOW(), NOW(), true,  true,  'aaaa0003'),
  (1000000004, 'Nimal Jayawardena', '+94771000004', 'suv', 6, 'BW-NJ-404', 'available', ST_MakePoint(8.2400, 48.8720)::geography, NOW(), NOW(), true,  true,  'aaaa0004'),
  (1000000005, 'Roshan de Mel',     '+94771000005', 'car', 4, 'BW-RM-505', 'busy',      ST_MakePoint(8.2700, 48.8800)::geography, NOW(), NOW(), true,  true,  'aaaa0005'),
  (1000000006, 'Pending Driver',    '+94771000006', 'car', 4, 'BW-PD-606', 'offline',   ST_MakePoint(8.2040, 48.8585)::geography, NOW(), NOW(), false, true,  'aaaa0006'),
  (1000000007, 'Offline Driver',    '+94771000007', 'car', 4, 'BW-OD-707', 'offline',   ST_MakePoint(8.2050, 48.8590)::geography, NOW(), NOW(), true,  true,  'aaaa0007')
ON CONFLICT (telegram_id) DO NOTHING;
