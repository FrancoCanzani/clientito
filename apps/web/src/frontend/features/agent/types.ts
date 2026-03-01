export type NavigationCommand = {
  action: "navigate";
  path: string;
  params?: Record<string, string>;
};
