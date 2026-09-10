const businesses = [
  { id: 1, name: 'Door Business', business_type: 'Door', status: 'pending_integration' },
  { id: 2, name: 'Electrical Plug Business', business_type: 'Electrical Plug', status: 'pending_integration' },
  { id: 3, name: 'Brandname Business', business_type: 'Brandname', status: 'pending_integration' },
  { id: 4, name: 'Clothing Business', business_type: 'Clothing', status: 'pending_integration' },
  { id: 5, name: 'Powerbank Business', business_type: 'Powerbank', status: 'pending_integration' },
  { id: 6, name: 'Projector Business', business_type: 'Projector', status: 'pending_integration' },
];

export const businessService = { getBusinesses: () => businesses };
