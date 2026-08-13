import type { FuelType, Transmission, VehicleClass } from '@snapspare/shared'

export interface SeedVariant {
  name: string
  fuelType: FuelType
  transmission: Transmission
  engineCc?: number
}

export interface SeedModel {
  slug: string
  name: string
  generation?: string
  yearFrom: number
  yearTo?: number
  variants: SeedVariant[]
}

export interface SeedMake {
  id: string
  name: string
  slug: string
  vehicleClass: VehicleClass
  models: SeedModel[]
}

function v(name: string, fuelType: FuelType, transmission: Transmission, engineCc?: number): SeedVariant {
  return { name, fuelType, transmission, engineCc }
}

export const MAKES: SeedMake[] = [
  {
    id: 'maruti-suzuki',
    name: 'Maruti Suzuki',
    slug: 'maruti-suzuki',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'swift',
        name: 'Swift',
        yearFrom: 2005,
        variants: [
          v('LXI', 'petrol', 'manual', 1197),
          v('VXI', 'petrol', 'manual', 1197),
          v('ZXI', 'petrol', 'manual', 1197),
          v('ZXI+ AMT', 'petrol', 'amt', 1197),
        ],
      },
      {
        slug: 'baleno',
        name: 'Baleno',
        yearFrom: 2015,
        variants: [
          v('Sigma', 'petrol', 'manual', 1197),
          v('Delta', 'petrol', 'manual', 1197),
          v('Zeta CVT', 'petrol', 'cvt', 1197),
        ],
      },
      {
        slug: 'wagonr',
        name: 'WagonR',
        yearFrom: 1999,
        variants: [
          v('LXI', 'petrol', 'manual', 998),
          v('VXI', 'petrol', 'manual', 998),
          v('VXI S-CNG', 'cng', 'manual', 998),
        ],
      },
      {
        slug: 'dzire',
        name: 'Dzire',
        yearFrom: 2008,
        variants: [
          v('LXI', 'petrol', 'manual', 1197),
          v('VXI', 'petrol', 'manual', 1197),
          v('ZXI AMT', 'petrol', 'amt', 1197),
          v('VXI S-CNG', 'cng', 'manual', 1197),
        ],
      },
      {
        slug: 'alto',
        name: 'Alto',
        yearFrom: 2000,
        variants: [
          v('Std', 'petrol', 'manual', 796),
          v('LXI', 'petrol', 'manual', 796),
          v('VXI S-CNG', 'cng', 'manual', 796),
        ],
      },
      {
        slug: 'ertiga',
        name: 'Ertiga',
        yearFrom: 2012,
        variants: [
          v('LXI', 'petrol', 'manual', 1462),
          v('ZXI', 'petrol', 'manual', 1462),
          v('ZDI Diesel', 'diesel', 'manual', 1248),
          v('VXI S-CNG', 'cng', 'manual', 1462),
        ],
      },
      {
        slug: 'brezza',
        name: 'Brezza',
        yearFrom: 2016,
        variants: [
          v('LXI', 'petrol', 'manual', 1462),
          v('VXI', 'petrol', 'manual', 1462),
          v('ZXI+ AT', 'petrol', 'automatic', 1462),
        ],
      },
    ],
  },
  {
    id: 'hyundai',
    name: 'Hyundai',
    slug: 'hyundai',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'i20',
        name: 'i20',
        yearFrom: 2008,
        variants: [
          v('Magna', 'petrol', 'manual', 1197),
          v('Sportz', 'petrol', 'manual', 1197),
          v('Asta IVT', 'petrol', 'cvt', 1197),
        ],
      },
      {
        slug: 'creta',
        name: 'Creta',
        yearFrom: 2015,
        variants: [
          v('E', 'petrol', 'manual', 1497),
          v('SX', 'petrol', 'manual', 1497),
          v('SX(O) Diesel', 'diesel', 'manual', 1493),
          v('SX AT', 'petrol', 'automatic', 1497),
        ],
      },
      {
        slug: 'venue',
        name: 'Venue',
        yearFrom: 2019,
        variants: [
          v('E', 'petrol', 'manual', 1197),
          v('S', 'petrol', 'manual', 1197),
          v('SX Turbo DCT', 'petrol', 'automatic', 998),
        ],
      },
      {
        slug: 'grand-i10',
        name: 'Grand i10',
        generation: 'Nios',
        yearFrom: 2019,
        variants: [
          v('Era', 'petrol', 'manual', 1197),
          v('Sportz', 'petrol', 'manual', 1197),
          v('Sportz CNG', 'cng', 'manual', 1197),
        ],
      },
    ],
  },
  {
    id: 'tata-passenger',
    name: 'Tata',
    slug: 'tata',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'nexon',
        name: 'Nexon',
        yearFrom: 2017,
        variants: [
          v('XE', 'petrol', 'manual', 1199),
          v('XZ+', 'petrol', 'manual', 1199),
          v('XZ+ Diesel', 'diesel', 'manual', 1497),
          v('EV Max', 'electric', 'automatic'),
        ],
      },
      {
        slug: 'punch',
        name: 'Punch',
        yearFrom: 2021,
        variants: [v('Pure', 'petrol', 'manual', 1199), v('Creative AMT', 'petrol', 'amt', 1199)],
      },
      {
        slug: 'altroz',
        name: 'Altroz',
        yearFrom: 2020,
        variants: [
          v('XE', 'petrol', 'manual', 1199),
          v('XZ Diesel', 'diesel', 'manual', 1497),
          v('iCNG', 'cng', 'manual', 1199),
        ],
      },
      {
        slug: 'tiago',
        name: 'Tiago',
        yearFrom: 2016,
        variants: [
          v('XE', 'petrol', 'manual', 1199),
          v('XZ+ AMT', 'petrol', 'amt', 1199),
          v('EV', 'electric', 'automatic'),
        ],
      },
    ],
  },
  {
    id: 'mahindra',
    name: 'Mahindra',
    slug: 'mahindra',
    vehicleClass: 'suv',
    models: [
      {
        slug: 'scorpio',
        name: 'Scorpio',
        generation: 'N',
        yearFrom: 2022,
        variants: [
          v('Z2', 'diesel', 'manual', 2184),
          v('Z8L', 'diesel', 'automatic', 2184),
          v('Z8 Petrol', 'petrol', 'manual', 1997),
        ],
      },
      {
        slug: 'thar',
        name: 'Thar',
        yearFrom: 2020,
        variants: [
          v('AX (O) Diesel', 'diesel', 'manual', 2184),
          v('LX Petrol AT', 'petrol', 'automatic', 1997),
        ],
      },
      {
        slug: 'xuv700',
        name: 'XUV700',
        yearFrom: 2021,
        variants: [
          v('MX Diesel', 'diesel', 'manual', 2198),
          v('AX7 Diesel AT', 'diesel', 'automatic', 2198),
          v('AX5 Petrol', 'petrol', 'manual', 1997),
        ],
      },
      {
        slug: 'bolero',
        name: 'Bolero',
        yearFrom: 2000,
        variants: [v('B4', 'diesel', 'manual', 1493), v('B6', 'diesel', 'manual', 1493)],
      },
    ],
  },
  {
    id: 'honda',
    name: 'Honda',
    slug: 'honda',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'city',
        name: 'City',
        yearFrom: 1998,
        variants: [
          v('V', 'petrol', 'manual', 1498),
          v('VX CVT', 'petrol', 'cvt', 1498),
          v('ZX', 'petrol', 'manual', 1498),
        ],
      },
      {
        slug: 'amaze',
        name: 'Amaze',
        yearFrom: 2013,
        variants: [v('E', 'petrol', 'manual', 1199), v('VX CVT', 'petrol', 'cvt', 1199)],
      },
    ],
  },
  {
    id: 'toyota',
    name: 'Toyota',
    slug: 'toyota',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'innova',
        name: 'Innova',
        generation: 'Crysta',
        yearFrom: 2016,
        variants: [v('GX Diesel', 'diesel', 'manual', 2393), v('ZX Diesel AT', 'diesel', 'automatic', 2393)],
      },
      {
        slug: 'fortuner',
        name: 'Fortuner',
        yearFrom: 2016,
        variants: [
          v('4x2 Diesel MT', 'diesel', 'manual', 2755),
          v('4x4 Diesel AT', 'diesel', 'automatic', 2755),
          v('Legender Petrol AT', 'petrol', 'automatic', 2694),
        ],
      },
    ],
  },
  {
    id: 'kia',
    name: 'Kia',
    slug: 'kia',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'seltos',
        name: 'Seltos',
        yearFrom: 2019,
        variants: [
          v('HTE', 'petrol', 'manual', 1497),
          v('HTX Diesel', 'diesel', 'manual', 1493),
          v('GTX+ DCT', 'petrol', 'automatic', 1353),
        ],
      },
      {
        slug: 'sonet',
        name: 'Sonet',
        yearFrom: 2020,
        variants: [v('HTE', 'petrol', 'manual', 1197), v('GTX+ DCT', 'petrol', 'automatic', 998)],
      },
    ],
  },
  {
    id: 'renault',
    name: 'Renault',
    slug: 'renault',
    vehicleClass: 'passenger_car',
    models: [
      {
        slug: 'kwid',
        name: 'Kwid',
        yearFrom: 2015,
        variants: [v('RXE', 'petrol', 'manual', 999), v('RXT AMT', 'petrol', 'amt', 999)],
      },
      {
        slug: 'triber',
        name: 'Triber',
        yearFrom: 2019,
        variants: [v('RXE', 'petrol', 'manual', 999), v('RXZ AMT', 'petrol', 'amt', 999)],
      },
    ],
  },
  {
    id: 'hero',
    name: 'Hero',
    slug: 'hero',
    vehicleClass: 'two_wheeler',
    models: [
      {
        slug: 'splendor',
        name: 'Splendor',
        yearFrom: 1994,
        variants: [
          v('Plus', 'petrol', 'manual', 97),
          v('Plus Xtec', 'petrol', 'manual', 97),
        ],
      },
      {
        slug: 'hf-deluxe',
        name: 'HF Deluxe',
        yearFrom: 2000,
        variants: [v('Kick Start', 'petrol', 'manual', 97), v('Self Start i3S', 'petrol', 'manual', 97)],
      },
    ],
  },
  {
    id: 'bajaj',
    name: 'Bajaj',
    slug: 'bajaj',
    vehicleClass: 'two_wheeler',
    models: [
      {
        slug: 'pulsar',
        name: 'Pulsar',
        generation: 'NS/N Series',
        yearFrom: 2001,
        variants: [
          v('150 Single Disc', 'petrol', 'manual', 149),
          v('NS200', 'petrol', 'manual', 199),
          v('220F', 'petrol', 'manual', 220),
        ],
      },
      {
        slug: 'platina',
        name: 'Platina',
        yearFrom: 2006,
        variants: [v('100 ES', 'petrol', 'manual', 102), v('110 H-Gear', 'petrol', 'manual', 115)],
      },
    ],
  },
  {
    id: 'honda-2w',
    name: 'Honda',
    slug: 'honda-two-wheelers',
    vehicleClass: 'two_wheeler',
    models: [
      {
        slug: 'activa',
        name: 'Activa',
        generation: '6G',
        yearFrom: 2001,
        variants: [v('Std', 'petrol', 'manual', 109), v('DLX', 'petrol', 'manual', 109)],
      },
      {
        slug: 'shine',
        name: 'Shine',
        yearFrom: 2006,
        variants: [v('Drum', 'petrol', 'manual', 124), v('Disc', 'petrol', 'manual', 124)],
      },
    ],
  },
  {
    id: 'tvs',
    name: 'TVS',
    slug: 'tvs',
    vehicleClass: 'two_wheeler',
    models: [
      {
        slug: 'jupiter',
        name: 'Jupiter',
        yearFrom: 2013,
        variants: [v('Std', 'petrol', 'manual', 109), v('ZX Disc', 'petrol', 'manual', 109)],
      },
      {
        slug: 'apache',
        name: 'Apache',
        generation: 'RTR',
        yearFrom: 2005,
        variants: [
          v('160 4V', 'petrol', 'manual', 159),
          v('RTR 200 4V', 'petrol', 'manual', 197),
        ],
      },
    ],
  },
  {
    id: 'royal-enfield',
    name: 'Royal Enfield',
    slug: 'royal-enfield',
    vehicleClass: 'two_wheeler',
    models: [
      {
        slug: 'classic',
        name: 'Classic',
        generation: '350',
        yearFrom: 2008,
        variants: [v('Halcyon', 'petrol', 'manual', 349), v('Chrome', 'petrol', 'manual', 349)],
      },
      {
        slug: 'hunter',
        name: 'Hunter',
        generation: '350',
        yearFrom: 2022,
        variants: [v('Retro', 'petrol', 'manual', 349), v('Metro Rebel', 'petrol', 'manual', 349)],
      },
    ],
  },
  {
    id: 'tata-commercial',
    name: 'Tata',
    slug: 'tata-commercial',
    vehicleClass: 'commercial_light',
    models: [
      {
        slug: 'ace',
        name: 'Ace',
        generation: 'Gold',
        yearFrom: 2005,
        variants: [
          v('CX Diesel', 'diesel', 'manual', 700),
          v('CNG', 'cng', 'manual', 700),
        ],
      },
      {
        slug: '407',
        name: '407',
        generation: 'Gold SFC',
        yearFrom: 1986,
        variants: [v('Diesel', 'diesel', 'manual', 2956)],
      },
    ],
  },
  {
    id: 'ashok-leyland',
    name: 'Ashok Leyland',
    slug: 'ashok-leyland',
    vehicleClass: 'commercial_light',
    models: [
      {
        slug: 'dost',
        name: 'Dost',
        generation: 'Plus',
        yearFrom: 2011,
        variants: [v('Diesel LI', 'diesel', 'manual', 1478), v('Diesel Strong', 'diesel', 'manual', 1478)],
      },
    ],
  },
]
