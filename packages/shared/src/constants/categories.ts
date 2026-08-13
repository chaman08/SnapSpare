import { z } from 'zod'

export const subcategorySchema = z.object({
  slug: z.string(),
  name: z.string(),
})
export type Subcategory = z.infer<typeof subcategorySchema>

export const categoryNodeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  subcategories: z.array(subcategorySchema),
})
export type CategoryNode = z.infer<typeof categoryNodeSchema>

function sub(name: string): Subcategory {
  const slug = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return { slug, name }
}

function category(name: string, subcategoryNames: string[]): CategoryNode {
  const slug = name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return { slug, name, subcategories: subcategoryNames.map(sub) }
}

/** Top-level auto-parts taxonomy. Order here is the default catalog browse order. */
export const CATEGORY_TREE: CategoryNode[] = [
  category('Engine', [
    'Pistons & Rings',
    'Engine Gaskets',
    'Timing Belts & Chains',
    'Engine Mounts',
    'Cylinder Heads',
    'Camshafts & Crankshafts',
    'Oil Pumps',
    'Fuel Injectors',
    'Spark Plugs',
    'Turbochargers',
  ]),
  category('Brake', [
    'Brake Pads',
    'Brake Discs & Rotors',
    'Brake Shoes',
    'Brake Calipers',
    'Brake Master Cylinders',
    'Brake Lines & Hoses',
    'ABS Sensors',
    'Brake Drums',
  ]),
  category('Suspension & Steering', [
    'Shock Absorbers',
    'Struts',
    'Leaf Springs',
    'Coil Springs',
    'Control Arms',
    'Tie Rod Ends',
    'Ball Joints',
    'Steering Racks',
    'Bushings',
  ]),
  category('Electrical', [
    'Alternators',
    'Starter Motors',
    'Wiring Harness',
    'Relays & Fuses',
    'Sensors',
    'ECUs',
    'Ignition Coils',
    'Horns',
  ]),
  category('Filters', ['Air Filters', 'Oil Filters', 'Fuel Filters', 'Cabin Air Filters']),
  category('Lubricants & Fluids', [
    'Engine Oil',
    'Gear Oil',
    'Brake Fluid',
    'Coolant',
    'Power Steering Fluid',
    'Grease',
  ]),
  category('Body & Panels', [
    'Bumpers',
    'Fenders',
    'Doors',
    'Bonnets',
    'Mirrors',
    'Body Kits',
    'Mudguards',
  ]),
  category('Lighting', [
    'Headlights',
    'Tail Lights',
    'Fog Lights',
    'Indicators',
    'LED Bulbs',
    'Interior Lights',
  ]),
  category('Clutch & Transmission', [
    'Clutch Plates',
    'Clutch Kits',
    'Pressure Plates',
    'Gearboxes',
    'Transmission Belts',
    'CV Joints & Axles',
  ]),
  category('Cooling', [
    'Radiators',
    'Water Pumps',
    'Cooling Fans',
    'Thermostats',
    'Radiator Hoses',
  ]),
  category('Exhaust', [
    'Silencers & Mufflers',
    'Catalytic Converters',
    'Exhaust Pipes',
    'Exhaust Manifolds',
  ]),
  category('Tyres & Wheels', ['Tyres', 'Alloy Wheels', 'Steel Wheels', 'Valves & Caps']),
  category('Battery', [
    'Car Batteries',
    'Two-Wheeler Batteries',
    'Battery Chargers',
    'Battery Terminals',
  ]),
  category('Bearings', [
    'Wheel Bearings',
    'Engine Bearings',
    'Gearbox Bearings',
    'Axle Bearings',
  ]),
  category('Cables', [
    'Accelerator Cables',
    'Clutch Cables',
    'Speedometer Cables',
    'Brake Cables',
  ]),
  category('Consumables', [
    'Nuts & Bolts',
    'Gaskets & Seals',
    'Adhesives & Sealants',
    'Cleaning Supplies',
  ]),
  category('Accessories', [
    'Seat Covers',
    'Floor Mats',
    'Car Care',
    'Infotainment',
    'Phone Mounts',
    'Steering Covers',
  ]),
  category('Tools', [
    'Hand Tools',
    'Diagnostic Scanners',
    'Jacks & Stands',
    'Air Tools',
    'Tool Kits',
  ]),
]
