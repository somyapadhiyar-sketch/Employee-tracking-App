// Department configurations
export const DEPARTMENTS = {
  market_analysis_sales: {
    name: 'Market Analysis & Sales',
    icon: 'fa-chart-line',
    color: 'blue',
    description: 'Focuses on market research, client acquisition, and sales targets.'
  },
  production_operations: {
    name: 'Production & Operations',
    icon: 'fa-cogs',
    color: 'green',
    description: 'Handles the actual creation, manufacturing, or operational delivery of products.'
  },
  it_engineering: {
    name: 'IT & Engineering',
    icon: 'fa-laptop-code',
    color: 'purple',
    description: 'Manages software development, system maintenance, and internal tech support.'
  },
  customer_support: {
    name: 'Customer Support',
    icon: 'fa-headset',
    color: 'yellow',
    description: 'Handles client tickets, troubleshooting, and user satisfaction.'
  },
  finance_accounting: {
    name: 'Finance & Accounting',
    icon: 'fa-coins',
    color: 'red',
    description: 'Manages payroll, company budgets, and financial reporting.'
  }
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

// Admin credentials - Updated by Somya
export const ADMIN_CREDENTIALS = {
  email: 'somyapadhiyar@gmail.com',
  password: 'somya24092007'
};

// Late time threshold (10:30 AM)
export const LATE_THRESHOLD_HOUR = 10;
export const LATE_THRESHOLD_MINUTE = 30;
