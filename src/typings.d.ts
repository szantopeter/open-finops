declare module '@auth0/auth0-angular' {
  export interface AuthService {
    isAuthenticated$: any;
    user$: any;
    loginWithRedirect: (...args: any[]) => Promise<any>;
    logout: (...args: any[]) => void;
    getAccessTokenSilently: any;
  }
  export const AuthService: any;
}
