export interface BuyerAddressBlueprint {
  buyerId: string
  label: string
  contactName: string
  line1: string
  city: string
  state: string
  stateCode: string
  pincode: string
}

/** One default address per buyer, used both for the addresses subcollection and as the shipping snapshot on seeded orders. */
export const BUYER_ADDRESSES: BuyerAddressBlueprint[] = [
  {
    buyerId: 'buyer-retail-priya',
    label: 'Home',
    contactName: 'Priya Nair',
    line1: '14 Sea View Apartments, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '400050',
  },
  {
    buyerId: 'buyer-mechanic-imran',
    label: 'Workshop',
    contactName: 'Imran Sheikh',
    line1: 'Shop 4, Shivaji Nagar Auto Market',
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27',
    pincode: '411005',
  },
  {
    buyerId: 'buyer-garage-shreeganesh',
    label: 'Garage',
    contactName: 'Shree Ganesh Auto Works',
    line1: 'No. 22, Mysore Road Industrial Layout',
    city: 'Bengaluru',
    state: 'Karnataka',
    stateCode: '29',
    pincode: '560026',
  },
  {
    buyerId: 'buyer-fleet-swiftlogistics',
    label: 'Depot',
    contactName: 'Swift Logistics Fleet',
    line1: 'Plot 9, Sector 34 Logistics Park',
    city: 'Gurugram',
    state: 'Haryana',
    stateCode: '06',
    pincode: '122001',
  },
  {
    buyerId: 'buyer-reseller-partsbazaar',
    label: 'Warehouse',
    contactName: 'Parts Bazaar Reselling Co.',
    line1: '18 Canal Street, Burrabazar',
    city: 'Kolkata',
    state: 'West Bengal',
    stateCode: '19',
    pincode: '700007',
  },
  {
    buyerId: 'buyer-retail-arjun',
    label: 'Home',
    contactName: 'Arjun Mehta',
    line1: 'B-12 Green Park Extension',
    city: 'New Delhi',
    state: 'Delhi',
    stateCode: '07',
    pincode: '110016',
  },
]
