let navigate;

export const setNavigator = (nav) => {
  navigate = nav;
};

export const navigateTo = (path) => {
  if (navigate) navigate(path);
};