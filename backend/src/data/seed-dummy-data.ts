export const SEED_CUSTOMERS = [
  {
    name: 'Rahul Verma',
    email: 'customer@rideai.com',
    phone: '+91 98765 43210',
    preferredLanguage: 'en',
    savedLocations: [
      {
        name: 'Home (Banjara Hills)',
        address: 'Plot 42, Road No 12, Banjara Hills, Hyderabad, Telangana 500034',
        latitude: 17.4180,
        longitude: 78.4420,
        category: 'HOME'
      },
      {
        name: 'Office (Mindspace Madhapur)',
        address: 'Building 9, Mindspace IT Park, Madhapur, Hyderabad 500081',
        latitude: 17.4390,
        longitude: 78.3810,
        category: 'WORK'
      }
    ]
  },
  {
    name: 'Venkatesh Rao',
    email: 'telugu@rideai.com',
    phone: '+91 91234 56789',
    preferredLanguage: 'te',
    savedLocations: [
      {
        name: 'ఇల్లు (Jubilee Hills)',
        address: 'Road No 36, Jubilee Hills, Hyderabad, Telangana 500033',
        latitude: 17.4312,
        longitude: 78.4116,
        category: 'HOME'
      }
    ]
  }
];

export const SEED_DRIVERS = [
  {
    name: 'Srinivas Reddy',
    email: 'driver1@rideai.com',
    phone: '+91 98480 11223',
    license: 'TS09-2023-8841',
    lat: 17.4160,
    lng: 78.4450,
    vehicle: {
      reg: 'TS09 FA 4210',
      model: 'Toyota Etios',
      color: 'Pearl White',
      type: 'SEDAN',
      seats: 4
    }
  },
  {
    name: 'Kalyan Kumar',
    email: 'driver2@rideai.com',
    phone: '+91 98480 22334',
    license: 'TS07-2022-1209',
    lat: 17.4490,
    lng: 78.3820,
    vehicle: {
      reg: 'TS07 AU 9821',
      model: 'Bajaj RE Auto',
      color: 'Yellow / Green',
      type: 'AUTO',
      seats: 3
    }
  },
  {
    name: 'Ramesh Naidu',
    email: 'driver3@rideai.com',
    phone: '+91 98480 33445',
    license: 'TS08-2021-3341',
    lat: 17.4420,
    lng: 78.3560,
    vehicle: {
      reg: 'TS08 EX 5544',
      model: 'Mahindra XUV700',
      color: 'Silver Metallic',
      type: 'SUV',
      seats: 6
    }
  },
  {
    name: 'Mahesh Chary',
    email: 'driver4@rideai.com',
    phone: '+91 98480 44556',
    license: 'TS10-2024-9912',
    lat: 17.4340,
    lng: 78.5020,
    vehicle: {
      reg: 'TS10 HB 1122',
      model: 'Maruti Suzuki Swift',
      color: 'Fire Red',
      type: 'HATCHBACK',
      seats: 4
    }
  },
  {
    name: 'Prasad Rao',
    email: 'driver5@rideai.com',
    phone: '+91 98480 55667',
    license: 'TS09-2020-7711',
    lat: 17.4320,
    lng: 78.4120,
    vehicle: {
      reg: 'TS09 PR 0001',
      model: 'BMW 3 Series',
      color: 'Sapphire Black',
      type: 'PREMIUM',
      seats: 4
    }
  },
  {
    name: 'Suresh Goud',
    email: 'driver6@rideai.com',
    phone: '+91 98480 66778',
    license: 'TS12-2023-4412',
    lat: 17.2420,
    lng: 78.4310,
    vehicle: {
      reg: 'TS12 SD 3399',
      model: 'Honda City',
      color: 'Sky Blue',
      type: 'SEDAN',
      seats: 4
    }
  }
];

export const SEED_PRICING_RULES = [
  { vehicleType: 'AUTO', baseFare: 30, perKmRate: 15, perMinuteRate: 1.5, minimumFare: 40 },
  { vehicleType: 'HATCHBACK', baseFare: 50, perKmRate: 18, perMinuteRate: 2, minimumFare: 70 },
  { vehicleType: 'SEDAN', baseFare: 80, perKmRate: 22, perMinuteRate: 2.5, minimumFare: 100 },
  { vehicleType: 'SUV', baseFare: 120, perKmRate: 30, perMinuteRate: 3.5, minimumFare: 150 },
  { vehicleType: 'PREMIUM', baseFare: 180, perKmRate: 40, perMinuteRate: 5, minimumFare: 250 }
];
