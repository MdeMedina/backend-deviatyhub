import { IUser } from './domain';
export interface IApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: IApiError;
    meta?: any;
}
export interface IApiError {
    code: string;
    message: string;
    details?: any;
    stack?: string;
}
export interface IPaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}
export interface ILoginRequest {
    email: string;
    password?: string;
}
export interface ILoginResponse {
    accessToken: string;
    refreshToken: string;
    user: Partial<IUser>;
}
export interface IInviteUserRequest {
    email: string;
    roleId: string;
    clinicId: string;
}
export interface ISetPasswordRequest {
    token: string;
    password: string;
}
//# sourceMappingURL=api.d.ts.map