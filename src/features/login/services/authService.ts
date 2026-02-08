export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
}

export interface LoginResponse {
    token: string;
    user: User;
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (email === 'admin@cms.com' && password === 'admin') {
        const mockUser: User = {
            id: 'USR-ADMIN-001',
            email: 'admin@cms.com',
            name: 'Admin User',
            role: 'admin'
        };

        return {
            token: 'mock-jwt-token-xyz-123',
            user: mockUser
        };
    }

    throw new Error('Invalid email or password');
};

export const logout = async (): Promise<void> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    // In a real app, this might invalidate the token on the server
};
