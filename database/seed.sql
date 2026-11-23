-- Default Seed Data for Buildmore Ventures LLP
-- Note: User accounts with hashed passwords are created via src/utils/initDb.js
-- or by running the seed helper so bcrypt hashes are generated cleanly.

USE `buildmore_inventory`;

INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES
  ('company_name', 'Buildmore Ventures LLP'),
  ('currency_symbol', '₹'),
  ('default_min_stock', '10'),
  ('available_units', '["Pieces","Kilograms","Grams","Litres","Bags","Boxes","Metres","Units","Tonnes","Sheets"]');

INSERT IGNORE INTO `categories` (`name`, `description`) VALUES
  ('Cement & Aggregates', 'OPC/PPC cement, sand, gravel, and concrete mixes'),
  ('Steel & Metals', 'TMT bars, structural steel, binding wire, and fasteners'),
  ('Plumbing & Pipes', 'PVC, CPVC, GI pipes, valves, and fittings'),
  ('Electrical', 'Cables, conduits, MCBs, switches, and lighting fixtures'),
  ('Paints & Finishes', 'Primers, emulsions, waterproofing, and adhesives'),
  ('Tools & Safety', 'Hand tools, power tools, helmets, gloves, and PPE');

INSERT IGNORE INTO `suppliers` (`name`, `contact_person`, `phone`, `email`, `address`) VALUES
  ('Apex Building Materials Pvt Ltd', 'Rajesh Kumar', '+91-98450-11223', 'sales@apexmaterials.in', 'Peenya Industrial Area, Bengaluru'),
  ('Metro Steel & Hardware', 'Suresh Nair', '+91-98801-44556', 'orders@metrosteel.in', 'SP Road, Bengaluru'),
  ('Kaveri Pipes & Fittings', 'Anita Desai', '+91-97412-77889', 'dispatch@kaveripipes.in', 'Bommasandra, Bengaluru');

