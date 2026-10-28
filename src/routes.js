// API endpoints are built by functions, never inlined at the call sites:
// the URL layout lives in one place and every caller stays readable.
export const routes = {
  loginPath: () => "/api/v1/login",
  signupPath: () => "/api/v1/signup",
  channelsPath: () => "/api/v1/channels",
  channelPath: (id) => `/api/v1/channels/${id}`,
  messagesPath: () => "/api/v1/messages",
};
