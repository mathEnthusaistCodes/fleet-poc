import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fleet:fleetpass@localhost:5432/fleet',
});

const MAKES = ['Ford', 'Chevrolet', 'Toyota', 'Mercedes-Benz', 'Volvo', 'Freightliner', 'Kenworth', 'Peterbilt'];
const MODELS: Record<string, string[]> = {
  'Ford': ['F-150', 'Transit', 'E-350'],
  'Chevrolet': ['Silverado', 'Express', 'Colorado'],
  'Toyota': ['Tundra', 'Tacoma', 'Sienna'],
  'Mercedes-Benz': ['Sprinter', 'Actros', 'Arocs'],
  'Volvo': ['VNL', 'VNR', 'FH'],
  'Freightliner': ['Cascadia', 'M2', '108SD'],
  'Kenworth': ['T680', 'T880', 'W990'],
  'Peterbilt': ['579', '567', '389'],
};
const FUEL_TYPES = ['diesel', 'gasoline', 'electric', 'hybrid'] as const;
const FIRST_NAMES = ['James', 'Maria', 'Robert', 'Lisa', 'David', 'Jennifer', 'Michael', 'Sarah', 'William', 'Emily', 'Daniel', 'Karen', 'Carlos', 'Ana', 'Raj', 'Priya'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Kim', 'Chen'];

const NYC_LAT = 40.7128;
const NYC_LNG = -74.0060;
const LA_LAT = 34.0522;
const LA_LNG = -118.2437;
const CHI_LAT = 41.8781;
const CHI_LNG = -87.6298;
const HOU_LAT = 29.7604;
const HOU_LNG = -95.3698;

const ROUTES = [
  { name: 'NYC-DC', origin: { lat: NYC_LAT, lng: NYC_LNG }, dest: { lat: 38.9072, lng: -77.0369 }, dist: 365 },
  { name: 'LA-SF', origin: { lat: LA_LAT, lng: LA_LNG }, dest: { lat: 37.7749, lng: -122.4194 }, dist: 559 },
  { name: 'CHI-Detroit', origin: { lat: CHI_LAT, lng: CHI_LNG }, dest: { lat: 42.3314, lng: -83.0458 }, dist: 462 },
  { name: 'Houston-Dallas', origin: { lat: HOU_LAT, lng: HOU_LNG }, dest: { lat: 32.7767, lng: -96.7970 }, dist: 362 },
  { name: 'Seattle-Portland', origin: { lat: 47.6062, lng: -122.3321 }, dest: { lat: 45.5152, lng: -122.6784 }, dist: 278 },
  { name: 'Miami-Orlando', origin: { lat: 25.7617, lng: -80.1918 }, dest: { lat: 28.5383, lng: -81.3792 }, dist: 378 },
  { name: 'Denver-SLC', origin: { lat: 39.7392, lng: -104.9903 }, dest: { lat: 40.7608, lng: -111.8910 }, dist: 854 },
  { name: 'Phoenix-Tucson', origin: { lat: 33.4484, lng: -112.0740 }, dest: { lat: 32.2226, lng: -110.9747 }, dist: 188 },
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function generate() {
  const client = await pool.connect();
  try {
    console.log('Creating tables if not exist...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY, make VARCHAR(100) NOT NULL, model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL, license_plate VARCHAR(20) UNIQUE NOT NULL,
        vin VARCHAR(17) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active',
        fuel_type VARCHAR(20) NOT NULL, fuel_capacity DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY, name VARCHAR(200) NOT NULL, email VARCHAR(200) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL, license_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'available', assigned_vehicle_id UUID REFERENCES vehicles(id),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY, name VARCHAR(200) NOT NULL, vehicle_id UUID REFERENCES vehicles(id),
        driver_id UUID REFERENCES drivers(id), origin_lat DECIMAL(10,7) NOT NULL,
        origin_lng DECIMAL(10,7) NOT NULL, dest_lat DECIMAL(10,7) NOT NULL,
        dest_lng DECIMAL(10,7) NOT NULL, distance_km DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'planned', started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gps_readings (
        id UUID PRIMARY KEY, vehicle_id UUID NOT NULL, lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL, speed DECIMAL(10,2), heading DECIMAL(5,2),
        fuel_level DECIMAL(5,2), engine_temp DECIMAL(5,2), odometer DECIMAL(10,2),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('Clearing existing data...');
    await client.query('DELETE FROM gps_readings');
    await client.query('DELETE FROM routes');
    await client.query('DELETE FROM drivers');
    await client.query('DELETE FROM vehicles');

    console.log('Generating 50 vehicles...');
    const vehicleIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const id = uuidv4();
      vehicleIds.push(id);
      const make = pick(MAKES);
      const models = MODELS[make];
      const year = Math.floor(randomBetween(2018, 2025));
      const fuelType = pick(FUEL_TYPES);
      const fuelCap = fuelType === 'electric' ? randomBetween(60, 100) : randomBetween(80, 150);
      await client.query(
        `INSERT INTO vehicles (id, make, model, year, license_plate, vin, status, fuel_type, fuel_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, make, pick(models), year, `FL-${String(i + 1).padStart(4, '0')}`, `${make.substring(0, 3).toUpperCase()}${String(i).padStart(14, '0')}`, pick(['active', 'active', 'active', 'idle', 'maintenance']), fuelType, fuelCap]
      );
    }

    console.log('Generating 30 drivers...');
    const driverIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const id = uuidv4();
      driverIds.push(id);
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const assignedVehicle = i < 25 ? vehicleIds[i] : null;
      await client.query(
        `INSERT INTO drivers (id, name, email, phone, license_number, status, assigned_vehicle_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, `${firstName} ${lastName}`, `driver${i}@fleet.com`, `+1${String(Math.floor(randomBetween(2000000000, 9999999999)))}`, `DL-${String(i).padStart(6, '0')}`, assignedVehicle ? 'on_route' : 'available', assignedVehicle]
      );
    }

    console.log('Generating 200 routes...');
    const routeIds: string[] = [];
    const routeVehicleMap: { routeId: string; vehicleId: string }[] = [];
    for (let i = 0; i < 200; i++) {
      const id = uuidv4();
      routeIds.push(id);
      const route = pick(ROUTES);
      const vehicleId = pick(vehicleIds);
      routeVehicleMap.push({ routeId: id, vehicleId });
      const driverId = pick(driverIds);
      const status = pick(['planned', 'in_progress', 'completed', 'completed', 'completed']);
      const startedAt = status !== 'planned' ? new Date(Date.now() - randomBetween(3600000, 86400000 * 7)).toISOString() : null;
      const completedAt = status === 'completed' ? new Date(Date.now() - randomBetween(0, 86400000 * 2)).toISOString() : null;
      const distanceKm = route.dist + randomBetween(-20, 20);
      await client.query(
        `INSERT INTO routes (id, name, vehicle_id, driver_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, status, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, route.name, vehicleId, driverId, route.origin.lat, route.origin.lng, route.dest.lat, route.dest.lng, distanceKm, status, startedAt, completedAt]
      );
    }

    console.log('Generating GPS breadcrumbs (~100K readings)...');
    let readingCount = 0;
    const batchSize = 500;
    for (const { routeId, vehicleId } of routeVehicleMap) {
      const numReadings = Math.floor(randomBetween(10, 60));
      const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
      const stepLat = (route.dest.lat - route.origin.lat) / numReadings;
      const stepLng = (route.dest.lng - route.origin.lng) / numReadings;
      const baseTime = Date.now() - randomBetween(86400000, 86400000 * 30);

      for (let j = 0; j < numReadings; j++) {
        const lat = route.origin.lat + stepLat * j + randomBetween(-0.01, 0.01);
        const lng = route.origin.lng + stepLng * j + randomBetween(-0.01, 0.01);
        const speed = randomBetween(30, 75);
        const heading = randomBetween(0, 360);
        const fuelLevel = randomBetween(20, 98);
        const engineTemp = randomBetween(80, 110);
        const odometer = 50000 + randomBetween(-1000, 50000);
        const recordedAt = new Date(baseTime + j * 60000).toISOString();

        const readingId = uuidv4();
        await client.query(
          `INSERT INTO gps_readings (id, vehicle_id, lat, lng, speed, heading, fuel_level, engine_temp, odometer, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [readingId, vehicleId, lat, lng, speed, heading, fuelLevel, engineTemp, odometer, recordedAt]
        );
        readingCount++;
      }
    }

    console.log(`\n✅ Data generation complete!`);
    console.log(`   Vehicles: 50`);
    console.log(`   Drivers: 30`);
    console.log(`   Routes: 200`);
    console.log(`   GPS Readings: ${readingCount}`);
  } catch (err) {
    console.error('Error generating data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

generate();
