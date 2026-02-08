export interface User {
    name: string;
    role: string;
    contact: string;
    email: string;
    status: 'Active' | 'Inactive';
}

export interface Doctor {
    name: string;
    departments: string[];
    speciality: string;
    registeredOn: string;
    degree: string;
    registrationNumber: string;
    appointments: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
    uniquePatients: {
        daily: number;
        weekly: number;
        monthly: number;
        yearly: number;
    };
}

export interface ChartDataPoint {
    label: string;
    value: number;
}

export interface HospitalStats {
    uniquePatients: {
        daily: ChartDataPoint[];
        weekly: ChartDataPoint[];
        monthly: ChartDataPoint[];
        yearly: ChartDataPoint[];
    };
    appointments: {
        daily: ChartDataPoint[];
        weekly: ChartDataPoint[];
        monthly: ChartDataPoint[];
        yearly: ChartDataPoint[];
    };
}

export interface Hospital {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    contactNumber: string;
    email: string;
    hospitalType: string;
    partnerName: string;
    totalPatients: number;
    registeredOn: string;
    subscriptionMode: string;
    paymentMode: string;
    status: 'Active' | 'Inactive';
    users: User[];
    doctors: Doctor[];
    stats?: HospitalStats;
}

export const mockHospitals: Hospital[] = [
    {
        id: 'HOSP-001',
        name: 'City General Hospital',
        address: '123 Healthcare Ave',
        city: 'Metropolis',
        state: 'NY',
        contactNumber: '+1 (555) 123-4567',
        email: 'contact@citygeneral.com',
        hospitalType: 'General',
        partnerName: 'HealthCorp Inc.',
        totalPatients: 12450,
        registeredOn: '2023-01-15',
        subscriptionMode: 'Enterprise',
        paymentMode: 'Annual',
        status: 'Active',
        users: [
            { name: 'John Doe', role: 'Admin', contact: '+1 (555) 111-2222', email: 'john.doe@citygeneral.com', status: 'Active' },
            { name: 'Jane Smith', role: 'Receptionist', contact: '+1 (555) 333-4444', email: 'jane.smith@citygeneral.com', status: 'Active' },
            { name: 'Bob Johnson', role: 'Manager', contact: '+1 (555) 555-6666', email: 'bob.j@citygeneral.com', status: 'Inactive' }
        ],
        doctors: [
            {
                name: 'Dr. Sarah Wilson',
                speciality: 'Cardiology',
                degree: 'MD, PhD',
                departments: ['Cardiology', 'Internal Medicine'],
                registrationNumber: 'MED-2015-889',
                registeredOn: '2023-02-01',
                appointments: { daily: 12, weekly: 55, monthly: 210, yearly: 2400 },
                uniquePatients: { daily: 8, weekly: 40, monthly: 150, yearly: 1800 }
            },
            {
                name: 'Dr. Michael Chen',
                speciality: 'Neurology',
                degree: 'MBBS, MD',
                departments: ['Neurology'],
                registrationNumber: 'MED-2018-442',
                registeredOn: '2023-03-10',
                appointments: { daily: 8, weekly: 35, monthly: 140, yearly: 1600 },
                uniquePatients: { daily: 6, weekly: 28, monthly: 110, yearly: 1200 }
            }
        ],
        stats: {
            uniquePatients: {
                daily: [
                    { label: 'Mon', value: 45 },
                    { label: 'Tue', value: 52 },
                    { label: 'Wed', value: 49 },
                    { label: 'Thu', value: 60 },
                    { label: 'Fri', value: 55 },
                    { label: 'Sat', value: 40 },
                    { label: 'Sun', value: 35 }
                ],
                weekly: [
                    { label: 'Week 1', value: 320 },
                    { label: 'Week 2', value: 350 },
                    { label: 'Week 3', value: 310 },
                    { label: 'Week 4', value: 380 }
                ],
                monthly: [
                    { label: 'Jan', value: 1200 },
                    { label: 'Feb', value: 1350 },
                    { label: 'Mar', value: 1250 },
                    { label: 'Apr', value: 1400 },
                    { label: 'May', value: 1500 },
                    { label: 'Jun', value: 1600 }
                ],
                yearly: [
                    { label: '2021', value: 12000 },
                    { label: '2022', value: 14500 },
                    { label: '2023', value: 16800 },
                    { label: '2024', value: 18200 }
                ]
            },
            appointments: {
                daily: [
                    { label: 'Mon', value: 65 },
                    { label: 'Tue', value: 70 },
                    { label: 'Wed', value: 68 },
                    { label: 'Thu', value: 80 },
                    { label: 'Fri', value: 75 },
                    { label: 'Sat', value: 50 },
                    { label: 'Sun', value: 45 }
                ],
                weekly: [
                    { label: 'Week 1', value: 450 },
                    { label: 'Week 2', value: 480 },
                    { label: 'Week 3', value: 460 },
                    { label: 'Week 4', value: 510 }
                ],
                monthly: [
                    { label: 'Jan', value: 1800 },
                    { label: 'Feb', value: 1950 },
                    { label: 'Mar', value: 1900 },
                    { label: 'Apr', value: 2100 },
                    { label: 'May', value: 2200 },
                    { label: 'Jun', value: 2300 }
                ],
                yearly: [
                    { label: '2021', value: 18000 },
                    { label: '2022', value: 21000 },
                    { label: '2023', value: 24500 },
                    { label: '2024', value: 26000 }
                ]
            }
        }
    },
    {
        id: 'HOSP-002',
        name: 'Westside Medical Center',
        address: '456 West Ave',
        city: 'Metropolis',
        state: 'NY',
        contactNumber: '+1 (555) 987-6543',
        email: 'info@westside.com',
        hospitalType: 'Specialized',
        partnerName: 'MediGroup',
        totalPatients: 8500,
        registeredOn: '2023-06-20',
        subscriptionMode: 'Standard',
        paymentMode: 'Annual',
        status: 'Active',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-003',
        name: 'Sunshine Pediatrics',
        address: '789 Sunny Ln',
        city: 'Smallville',
        state: 'KS',
        contactNumber: '+1 (555) 246-8135',
        email: 'contact@sunshinepeds.com',
        hospitalType: 'Clinic',
        partnerName: 'Indepdendent',
        totalPatients: 3200,
        registeredOn: '2023-08-05',
        subscriptionMode: 'Basic',
        paymentMode: 'Monthly',
        status: 'Inactive',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-004',
        name: 'Oakwood Geriatrics',
        address: '101 Oak St',
        city: 'Gotham',
        state: 'NJ',
        contactNumber: '+1 (555) 135-7924',
        email: 'admin@oakwood.com',
        hospitalType: 'Specialized',
        partnerName: 'SeniorCare',
        totalPatients: 1500,
        registeredOn: '2023-09-12',
        subscriptionMode: 'Premium',
        paymentMode: 'Quarterly',
        status: 'Active',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-005',
        name: 'Lakeside Cardiology',
        address: '202 Lakeview Dr',
        city: 'Chicago',
        state: 'IL',
        contactNumber: '+1 (555) 864-2097',
        email: 'info@lakesidecardio.com',
        hospitalType: 'Specialized',
        partnerName: 'HeartHealth',
        totalPatients: 4200,
        registeredOn: '2023-10-30',
        subscriptionMode: 'Enterprise',
        paymentMode: 'Annual',
        status: 'Active',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-006',
        name: 'Grand View Hospital',
        address: '303 Grand Ave',
        city: 'Miami',
        state: 'FL',
        contactNumber: '+1 (555) 741-8520',
        email: 'info@grandview.org',
        hospitalType: 'General',
        partnerName: 'Sunshine Health',
        totalPatients: 9200,
        registeredOn: '2024-04-12',
        subscriptionMode: 'Standard',
        paymentMode: 'Credit Card',
        status: 'Active',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-007',
        name: 'Lakeside Medical',
        address: '404 Lake Dr',
        city: 'Detroit',
        state: 'MI',
        contactNumber: '+1 (555) 852-9630',
        email: 'support@lakesidemed.com',
        hospitalType: 'Clinic',
        partnerName: 'Detroit Care Systems',
        totalPatients: 3400,
        registeredOn: '2024-04-18',
        subscriptionMode: 'Basic',
        paymentMode: 'Card',
        status: 'Inactive',
        users: [],
        doctors: []
    },
    {
        id: 'HOSP-008',
        name: 'Mountain Care',
        address: '505 Mountain Way',
        city: 'Denver',
        state: 'CO',
        contactNumber: '+1 (555) 963-0147',
        email: 'contact@mountaincare.com',
        hospitalType: 'General',
        partnerName: 'Rocky Mountain Health',
        totalPatients: 6700,
        registeredOn: '2024-04-25',
        subscriptionMode: 'Premium',
        paymentMode: 'Bank Transfer',
        status: 'Active',
        users: [],
        doctors: []
    }
];
