-- Phase 2: amenities/nearby-locations master list (section 11)

insert into amenities (key, label, kind, is_system) values
  ('pool', 'Pool', 'AMENITY', true),
  ('gym', 'Gym', 'AMENITY', true),
  ('lobby', 'Lobby', 'AMENITY', true),
  ('security', 'Security', 'AMENITY', true),
  ('elevator', 'Elevator', 'AMENITY', true),
  ('parking', 'Parking', 'AMENITY', true),
  ('playground', 'Playground', 'AMENITY', true),
  ('function_room', 'Function Room', 'AMENITY', true),
  ('pet_friendly', 'Pet Friendly', 'AMENITY', true),
  ('wifi', 'Wi-Fi', 'AMENITY', true),
  ('air_conditioning', 'Air Conditioning', 'AMENITY', true),

  ('mall', 'Mall', 'NEARBY', true),
  ('airport', 'Airport', 'NEARBY', true),
  ('hospital', 'Hospital', 'NEARBY', true),
  ('school', 'School', 'NEARBY', true),
  ('transport', 'Transport', 'NEARBY', true),
  ('business_district', 'Business District', 'NEARBY', true),
  ('tourist_attraction', 'Tourist Attraction', 'NEARBY', true)
on conflict (key) do nothing;
