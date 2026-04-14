// Department configurations
export const DEPARTMENTS = {
  // market_analysis_sales: {
  //   name: 'Market Analysis & Sales',
  //   icon: 'fa-chart-line',
  //   color: 'blue',
  //   description: 'Focuses on market research, client acquisition, and sales targets.'
  // },
  // production_operations: {
  //   name: 'Production & Operations',
  //   icon: 'fa-cogs',
  //   color: 'green',
  //   description: 'Handles the actual creation, manufacturing, or operational delivery of products.'
  // },
  // it_engineering: {
  //   name: 'IT & Engineering',
  //   icon: 'fa-laptop-code',
  //   color: 'purple',
  //   description: 'Manages software development, system maintenance, and internal tech support.'
  // },
  // customer_support: {
  //   name: 'Customer Support',
  //   icon: 'fa-headset',
  //   color: 'yellow',
  //   description: 'Handles client tickets, troubleshooting, and user satisfaction.'
  // },
  // finance_accounting: {
  //   name: 'Finance & Accounting',
  //   icon: 'fa-coins',
  //   color: 'red',
  //   description: 'Manages payroll, company budgets, and financial reporting.'
  // }
};

// Work types
export const WORK_TYPES = {
  office: {
    name: 'Office Work',
    icon: 'fa-briefcase',
    description: 'Work done in office premises'
  },
  non_office: {
    name: 'Non-Office Work',
    icon: 'fa-laptop',
    description: 'Remote work or field work'
  }
};

// Admin credentials - Multiple admins with individual profiles
export const ADMIN_CREDENTIALS = [
  {
    email: 'somyapadhiyar@gmail.com',
    password: 'somya24092007',
    firstName: 'Somya',
    lastName: 'Padhiyar'
  },
  {
    email: 'mansidarji6429@gmail.com',
    password: 'mansi@6429',
    firstName: 'Mansi',
    lastName: 'Darji'
  },
  {
    email: 'diyachauhan17@gmail.com',
    password: 'diya@2004',
    firstName: 'Diya',
    lastName: 'Chauhan'
  }
];

// Late time threshold (10:30 AM)
export const LATE_THRESHOLD_HOUR = 10;
export const LATE_THRESHOLD_MINUTE = 30;

// Geofence configuration (Radius in meters)
export const GEOFENCE_RADIUS = 200; 

export const ALLOWED_LOCATIONS = [
  { name: "SoftCoding Solutions", lat: 23.0584434, lng: 72.5389127 },
  { name: "Lokmanya college", lat: 23.0239757, lng: 72.5295033 },
  { name: "Satyam Nagar Market", lat: 23.0090578, lng: 72.6346124 },
  { name: "Umiyanagar society", lat: 23.0096154, lng: 72.6448775 }
];
