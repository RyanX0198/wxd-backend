// Mock JWT - 今天用简单token，明天用真实JWT
export const jwt = {
  sign: (payload: any) => {
    // Mock token: base64编码的用户信息
    return 'mock_token_' + Buffer.from(JSON.stringify(payload)).toString('base64');
  },
  
  verify: (token: string) => {
    try {
      if (token.startsWith('mock_token_')) {
        const base64 = token.replace('mock_token_', '');
        return JSON.parse(Buffer.from(base64, 'base64').toString());
      }
      throw new Error('Invalid token');
    } catch {
      throw new Error('Invalid token');
    }
  }
};
