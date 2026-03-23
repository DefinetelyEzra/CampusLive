-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Create spatial index for locations
CREATE INDEX IF NOT EXISTS locations_geom_idx ON locations USING GIST (geom);

-- Update existing location records with geometry
UPDATE locations 
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
WHERE geom IS NULL;

-- Add geometry columns to location_bounds table
ALTER TABLE location_bounds ADD COLUMN IF NOT EXISTS center_geom geometry(Point, 4326);
ALTER TABLE location_bounds ADD COLUMN IF NOT EXISTS bounds_geom geometry(Polygon, 4326);

-- Create spatial indexes for bounds
CREATE INDEX IF NOT EXISTS location_bounds_center_geom_idx ON location_bounds USING GIST (center_geom);
CREATE INDEX IF NOT EXISTS location_bounds_bounds_geom_idx ON location_bounds USING GIST (bounds_geom);

-- Update existing bounds records with geometry
UPDATE location_bounds 
SET center_geom = ST_SetSRID(ST_MakePoint("centerLng", "centerLat"), 4326),
    bounds_geom = ST_Buffer(
        ST_SetSRID(ST_MakePoint("centerLng", "centerLat"), 4326)::geography, 
        "radiusMeters"
    )::geometry
WHERE center_geom IS NULL;

-- Create trigger function to auto-update geometry on location insert/update
CREATE OR REPLACE FUNCTION update_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for locations
DROP TRIGGER IF EXISTS locations_geom_trigger ON locations;
CREATE TRIGGER locations_geom_trigger
    BEFORE INSERT OR UPDATE OF latitude, longitude ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_location_geom();

-- Create trigger function for location bounds
CREATE OR REPLACE FUNCTION update_location_bounds_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.center_geom := ST_SetSRID(ST_MakePoint(NEW."centerLng", NEW."centerLat"), 4326);
    NEW.bounds_geom := ST_Buffer(
        ST_SetSRID(ST_MakePoint(NEW."centerLng", NEW."centerLat"), 4326)::geography,
        NEW."radiusMeters"
    )::geometry;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for location bounds
DROP TRIGGER IF EXISTS location_bounds_geom_trigger ON location_bounds;
CREATE TRIGGER location_bounds_geom_trigger
    BEFORE INSERT OR UPDATE OF "centerLat", "centerLng", "radiusMeters" ON location_bounds
    FOR EACH ROW
    EXECUTE FUNCTION update_location_bounds_geom();